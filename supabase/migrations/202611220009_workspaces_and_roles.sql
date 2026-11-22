-- Add independent club roles while retaining membership identities and existing data.
begin;
create table public.club_membership_roles (
 club_id uuid not null,user_id uuid not null,role text not null check(role in ('admin','coach')),
 created_at timestamptz not null default now(),primary key(club_id,user_id,role),
 foreign key(club_id,user_id) references public.club_memberships(club_id,user_id) on delete cascade
);
insert into public.club_membership_roles(club_id,user_id,role,created_at)
 select club_id,user_id,role,created_at from public.club_memberships;
alter table public.club_membership_roles enable row level security;
create policy own_roles_read on public.club_membership_roles for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.club_membership_roles from public,anon,authenticated;
grant select on public.club_membership_roles to authenticated;
comment on column public.club_memberships.role is 'Legacy compatibility field. Authorisation uses club_membership_roles from migration 009.';
-- Tie session grants to the coach role itself, not just membership of the club.
alter table public.session_coaches add column membership_role text not null default 'coach' check(membership_role='coach');
alter table public.session_coaches add foreign key(club_id,coach_user_id,membership_role)
 references public.club_membership_roles(club_id,user_id,role) on delete cascade;
create or replace function private.is_club_admin(p_club_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.club_membership_roles where club_id=p_club_id and user_id=(select auth.uid()) and role='admin');
$$;
create or replace function public.create_club(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then raise exception 'Invalid club name' using errcode = '22023'; end if;
 -- Serialize onboarding for this account; refreshing/retrying cannot create duplicate clubs.
 perform 1 from auth.users where id = v_user for update;
 if not found then raise exception 'Sign in required' using errcode = '42501'; end if;
 if exists(select 1 from public.club_memberships where user_id = v_user) then
   raise exception 'This account already has a club membership' using errcode = '23505';
 end if;
 insert into public.clubs(name) values (btrim(p_name)) returning id into v_id;
 insert into public.club_memberships(club_id,user_id,role) values(v_id,v_user,'admin');
 insert into public.club_membership_roles(club_id,user_id,role) values(v_id,v_user,'admin');
 insert into public.club_audit(club_id,actor_id,action) values(v_id,v_user,'club_created');
 return v_id;
end; $$;

create or replace function public.invite_coach(p_club_id uuid,p_email text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(p_email)); v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email' using errcode='22023'; end if;
 -- Serialize membership/invitation changes per club. All mutation RPCs use this lock first.
 perform 1 from public.clubs where id=p_club_id for update;
 if exists(select 1 from public.club_membership_roles m join auth.users u on u.id=m.user_id where m.club_id=p_club_id and m.role='coach' and lower(btrim(u.email))=v_email) then raise exception 'Already a coach' using errcode='23505'; end if;
 if exists(select 1 from public.coach_invitations i where club_id=p_club_id and email=v_email and status='pending' and expires_at>now() and exists(select 1 from public.club_membership_roles m where m.club_id=i.club_id and m.user_id=i.created_by and m.role='admin')) then raise exception 'Invitation already pending' using errcode='23505'; end if;
 update public.coach_invitations set status='revoked',responded_at=now() where club_id=p_club_id and email=v_email and status='pending';
 insert into public.coach_invitations(club_id,email,created_by) values(p_club_id,v_email,auth.uid()) returning id into v_id;
 insert into public.club_audit(club_id,actor_id,invitation_id,action) values(p_club_id,auth.uid(),v_id,'coach_invited');
 return v_id;
end; $$;

create or replace function public.revoke_coach_invitation(p_club_id uuid,p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=p_club_id for update;
 update public.coach_invitations set status='revoked',responded_at=now() where id=p_invitation_id and club_id=p_club_id and status='pending';
 if found then insert into public.club_audit(club_id,actor_id,invitation_id,action) values(p_club_id,auth.uid(),p_invitation_id,'coach_invitation_revoked'); end if;
end; $$;

create or replace function public.respond_coach_invitation(p_invitation_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv public.coach_invitations%rowtype; v_club uuid; v_email text:=private.confirmed_email();
begin
 if v_email is null then raise exception 'Confirmed account required' using errcode='42501'; end if;
 if p_accept is null then raise exception 'Invalid response' using errcode='22023'; end if;
 select club_id into v_club from public.coach_invitations where id=p_invitation_id and email=v_email;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_club for update;
 select * into v_inv from public.coach_invitations where id=p_invitation_id for update;
 if v_inv.status<>'pending' or v_inv.expires_at<=now() or not exists(select 1 from public.club_membership_roles where club_id=v_inv.club_id and user_id=v_inv.created_by and role='admin') then
   raise exception 'Invitation unavailable' using errcode='22023';
 end if;
 if p_accept then
  -- Explicit acceptance adds the coach role without replacing an independent admin role.
  if exists(select 1 from public.club_membership_roles where club_id=v_club and user_id=auth.uid() and role='coach') then raise exception 'Already a coach' using errcode='23505'; end if;
  insert into public.club_memberships(club_id,user_id,role) values(v_club,auth.uid(),'coach') on conflict(club_id,user_id) do nothing;
  insert into public.club_membership_roles(club_id,user_id,role) values(v_club,auth.uid(),'coach');
 end if;
 update public.coach_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now(),accepted_by=case when p_accept then auth.uid() else null end where id=p_invitation_id;
 insert into public.club_audit(club_id,actor_id,target_user_id,invitation_id,action) values(v_club,auth.uid(),auth.uid(),p_invitation_id,case when p_accept then 'coach_invitation_accepted' else 'coach_invitation_declined' end);
end; $$;

create or replace function public.remove_coach(p_club_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=p_club_id for update;
 delete from public.club_membership_roles where club_id=p_club_id and user_id=p_user_id and role='coach';
 if not found then raise exception 'Coach membership not found' using errcode='22023'; end if;
 -- FK cascade removes session grants even when an admin role keeps the membership alive.
 delete from public.club_memberships m where m.club_id=p_club_id and m.user_id=p_user_id
  and not exists(select 1 from public.club_membership_roles r where r.club_id=m.club_id and r.user_id=m.user_id);
 select lower(btrim(email)) into v_email from auth.users where id=p_user_id;
 update public.coach_invitations set status='revoked',responded_at=now() where club_id=p_club_id and status='pending' and email=v_email;
 insert into public.club_audit(club_id,actor_id,target_user_id,action) values(p_club_id,auth.uid(),p_user_id,'coach_removed');
end; $$;

create or replace function public.club_coaches(p_club_id uuid,p_page integer default 1,p_invite_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_page integer; v_total integer; v_itotal integer; v_ipage integer; v_members jsonb; v_invites jsonb;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select count(*) into v_total from public.club_membership_roles where club_id=p_club_id and role='coach';
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into v_members from (
  select m.user_id,u.email,m.created_at from public.club_membership_roles m join auth.users u on u.id=m.user_id where m.club_id=p_club_id and m.role='coach' order by m.created_at desc,m.user_id limit 25 offset (v_page-1)*25
 ) m;
 select count(*) into v_itotal from public.coach_invitations where club_id=p_club_id;
 v_ipage:=greatest(1,least(coalesce(p_invite_page,1),greatest(1,(v_itotal+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into v_invites from (
  select id,email,case when status='pending' and expires_at<=now() then 'expired' when status='pending' and not exists(select 1 from public.club_membership_roles m where m.club_id=i.club_id and m.user_id=i.created_by and m.role='admin') then 'unavailable' else status end as status,created_at,expires_at from public.coach_invitations i where club_id=p_club_id order by created_at desc,id desc limit 25 offset (v_ipage-1)*25
 ) i;
 return jsonb_build_object('coaches',v_members,'invitations',v_invites,'page',v_page,'pages',greatest(1,(v_total+24)/25),'total',v_total,'invitePage',v_ipage,'invitePages',greatest(1,(v_itotal+24)/25),'inviteTotal',v_itotal);
end; $$;

create or replace function public.my_coach_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_email text:=private.confirmed_email();v_links jsonb;v_invites jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_links from (
  select c.id,c.name,m.created_at from public.club_membership_roles m join public.clubs c on c.id=m.club_id where m.user_id=auth.uid() and m.role='coach' order by lower(c.name),c.id
 ) c;
 select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into v_invites from (
  select i.id,c.name as club_name,i.expires_at from public.coach_invitations i join public.clubs c on c.id=i.club_id where i.email=v_email and i.status='pending' and i.expires_at>now()
  and exists(select 1 from public.club_membership_roles where club_id=i.club_id and user_id=i.created_by and role='admin')
  order by i.created_at desc,i.id desc
 ) i;
 return jsonb_build_object('clubs',v_links,'invitations',v_invites,'emailConfirmed',v_email is not null);
end; $$;

create or replace function private.session_access(p_id uuid,p_edit boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.training_sessions s where s.id=p_id and
 (private.is_club_admin(s.club_id) or exists(select 1 from public.session_coaches g join public.club_membership_roles m on m.club_id=g.club_id and m.user_id=g.coach_user_id where g.session_id=s.id and g.coach_user_id=auth.uid() and m.role='coach' and (not p_edit or g.can_manage))));
$$;
create or replace function public.assign_session_coach(p_id uuid,p_user_id uuid,p_can_manage boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v.status<>'planned' or p_can_manage is null then raise exception 'Session is closed or grant invalid' using errcode='22023'; end if;
 -- FK and row lock prevent removal/re-invitation from reviving stale assignments.
 perform 1 from public.club_membership_roles where club_id=v.club_id and user_id=p_user_id and role='coach' for key share;
 if not found then raise exception 'Current approved coach required' using errcode='22023'; end if;
 insert into public.session_coaches(session_id,club_id,coach_user_id,can_manage,assigned_by) values(p_id,v.club_id,p_user_id,p_can_manage,auth.uid())
 on conflict(session_id,coach_user_id) do update set can_manage=excluded.can_manage,assigned_by=excluded.assigned_by,assigned_at=now();
 insert into public.club_audit(club_id,actor_id,target_user_id,session_id,action) values(v.club_id,auth.uid(),p_user_id,p_id,'session_coach_assigned');
end; $$;

create or replace function public.list_training_sessions(p_club_id uuid default null,p_status text default 'all',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_page integer;v_items jsonb;
begin
 if auth.uid() is null or (p_club_id is not null and not private.is_club_admin(p_club_id)) then raise exception 'Access denied' using errcode='42501';end if;
 if p_status is null or p_status not in ('all','planned','closed','cancelled') then raise exception 'Invalid filter' using errcode='22023';end if;
 select count(*) into v_total from public.training_sessions s where (p_status='all' or s.status=p_status) and
 ((p_club_id is not null and s.club_id=p_club_id) or (p_club_id is null and exists(select 1 from public.session_coaches g join public.club_membership_roles m on m.club_id=g.club_id and m.user_id=g.coach_user_id where g.session_id=s.id and g.coach_user_id=auth.uid() and m.role='coach')));
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_items from (
  select s.*,c.name as club_name from public.training_sessions s join public.clubs c on c.id=s.club_id where (p_status='all' or s.status=p_status) and
  ((p_club_id is not null and s.club_id=p_club_id) or (p_club_id is null and exists(select 1 from public.session_coaches g join public.club_membership_roles m on m.club_id=g.club_id and m.user_id=g.coach_user_id where g.session_id=s.id and g.coach_user_id=auth.uid() and m.role='coach')))
  order by s.scheduled_at desc nulls last,s.created_at desc,s.id limit 25 offset (v_page-1)*25
 ) r;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pages',greatest(1,(v_total+24)/25));
end; $$;

create function public.my_workspaces() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_coach jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(w) order by w.label,w.key),'[]'::jsonb) into v_items from (
  select 'admin:'||c.id::text as key,'Manage '||c.name as label,'Club administration'::text as description,
   '/club/'||c.id::text as href
  from public.club_membership_roles r join public.clubs c on c.id=r.club_id
  where r.user_id=auth.uid() and r.role='admin'
 ) w;
 v_coach:=public.my_coach_workspace();
 if jsonb_array_length(v_coach->'clubs')>0 or jsonb_array_length(v_coach->'invitations')>0 then
  v_items:=v_items||jsonb_build_array(jsonb_build_object('key','coach','label','Coach','description','Your club links, invitations and assigned sessions','href','/coach'));
 end if;
 return v_items;
end; $$;
revoke all on function public.my_workspaces() from public,anon;
grant execute on function public.my_workspaces() to authenticated;
commit;
