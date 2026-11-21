-- Apply after migrations 001 and 002. Invitations do not grant rider/session access.
begin;
create table public.coach_invitations (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id),
 email text not null check (email=lower(btrim(email)) and char_length(email) between 3 and 254),
 status text not null default 'pending' check(status in ('pending','accepted','revoked','declined')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 responded_at timestamptz,
 accepted_by uuid references auth.users(id)
);
create index coach_invites_club_idx on public.coach_invitations(club_id,created_at desc);
create index coach_invites_email_idx on public.coach_invitations(email) where status='pending';
create unique index coach_invites_pending_idx on public.coach_invitations(club_id,email) where status='pending';
alter table public.coach_invitations enable row level security;
create policy coach_invites_admin_read on public.coach_invitations for select to authenticated using(private.is_club_admin(club_id));
revoke all on public.coach_invitations from public,anon,authenticated;
grant select on public.coach_invitations to authenticated;
alter table public.club_audit add column target_user_id uuid references auth.users(id);
alter table public.club_audit add column invitation_id uuid references public.coach_invitations(id);
alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed'));

-- Read the current, confirmed account email, not user-editable metadata or stale JWT email.
create function private.confirmed_email() returns text
language sql stable security definer set search_path='' as $$
 select lower(btrim(email)) from auth.users where id=(select auth.uid()) and email_confirmed_at is not null;
$$;
revoke all on function private.confirmed_email() from public,anon,authenticated;

create function public.invite_coach(p_club_id uuid,p_email text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(p_email)); v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email' using errcode='22023'; end if;
 -- Serialize membership/invitation changes per club. All mutation RPCs use this lock first.
 perform 1 from public.clubs where id=p_club_id for update;
 if exists(select 1 from public.club_memberships m join auth.users u on u.id=m.user_id where m.club_id=p_club_id and lower(btrim(u.email))=v_email) then raise exception 'Already a club member' using errcode='23505'; end if;
 if exists(select 1 from public.coach_invitations i where club_id=p_club_id and email=v_email and status='pending' and expires_at>now() and exists(select 1 from public.club_memberships m where m.club_id=i.club_id and m.user_id=i.created_by and m.role='admin')) then raise exception 'Invitation already pending' using errcode='23505'; end if;
 update public.coach_invitations set status='revoked',responded_at=now() where club_id=p_club_id and email=v_email and status='pending';
 insert into public.coach_invitations(club_id,email,created_by) values(p_club_id,v_email,auth.uid()) returning id into v_id;
 insert into public.club_audit(club_id,actor_id,invitation_id,action) values(p_club_id,auth.uid(),v_id,'coach_invited');
 return v_id;
end; $$;

create function public.revoke_coach_invitation(p_club_id uuid,p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=p_club_id for update;
 update public.coach_invitations set status='revoked',responded_at=now() where id=p_invitation_id and club_id=p_club_id and status='pending';
 if found then insert into public.club_audit(club_id,actor_id,invitation_id,action) values(p_club_id,auth.uid(),p_invitation_id,'coach_invitation_revoked'); end if;
end; $$;

create function public.respond_coach_invitation(p_invitation_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv public.coach_invitations%rowtype; v_club uuid; v_email text:=private.confirmed_email();
begin
 if v_email is null then raise exception 'Confirmed account required' using errcode='42501'; end if;
 if p_accept is null then raise exception 'Invalid response' using errcode='22023'; end if;
 select club_id into v_club from public.coach_invitations where id=p_invitation_id and email=v_email;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_club for update;
 select * into v_inv from public.coach_invitations where id=p_invitation_id for update;
 if v_inv.status<>'pending' or v_inv.expires_at<=now() or not exists(select 1 from public.club_memberships where club_id=v_inv.club_id and user_id=v_inv.created_by and role='admin') then
   raise exception 'Invitation unavailable' using errcode='22023';
 end if;
 if p_accept then
  -- Never replace an existing admin membership or silently change roles.
  if exists(select 1 from public.club_memberships where club_id=v_club and user_id=auth.uid()) then raise exception 'Already a club member' using errcode='23505'; end if;
  insert into public.club_memberships(club_id,user_id,role) values(v_club,auth.uid(),'coach');
 end if;
 update public.coach_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now(),accepted_by=case when p_accept then auth.uid() else null end where id=p_invitation_id;
 insert into public.club_audit(club_id,actor_id,target_user_id,invitation_id,action) values(v_club,auth.uid(),auth.uid(),p_invitation_id,case when p_accept then 'coach_invitation_accepted' else 'coach_invitation_declined' end);
end; $$;

create function public.remove_coach(p_club_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=p_club_id for update;
 delete from public.club_memberships where club_id=p_club_id and user_id=p_user_id and role='coach';
 if not found then raise exception 'Coach membership not found' using errcode='22023'; end if;
 select lower(btrim(email)) into v_email from auth.users where id=p_user_id;
 update public.coach_invitations set status='revoked',responded_at=now() where club_id=p_club_id and status='pending' and email=v_email;
 insert into public.club_audit(club_id,actor_id,target_user_id,action) values(p_club_id,auth.uid(),p_user_id,'coach_removed');
end; $$;

create function public.club_coaches(p_club_id uuid,p_page integer default 1,p_invite_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_page integer; v_total integer; v_itotal integer; v_ipage integer; v_members jsonb; v_invites jsonb;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select count(*) into v_total from public.club_memberships where club_id=p_club_id and role='coach';
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into v_members from (
  select m.user_id,u.email,m.created_at from public.club_memberships m join auth.users u on u.id=m.user_id where m.club_id=p_club_id and m.role='coach' order by m.created_at desc,m.user_id limit 25 offset (v_page-1)*25
 ) m;
 select count(*) into v_itotal from public.coach_invitations where club_id=p_club_id;
 v_ipage:=greatest(1,least(coalesce(p_invite_page,1),greatest(1,(v_itotal+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into v_invites from (
  select id,email,case when status='pending' and expires_at<=now() then 'expired' when status='pending' and not exists(select 1 from public.club_memberships m where m.club_id=i.club_id and m.user_id=i.created_by and m.role='admin') then 'unavailable' else status end as status,created_at,expires_at from public.coach_invitations i where club_id=p_club_id order by created_at desc,id desc limit 25 offset (v_ipage-1)*25
 ) i;
 return jsonb_build_object('coaches',v_members,'invitations',v_invites,'page',v_page,'pages',greatest(1,(v_total+24)/25),'total',v_total,'invitePage',v_ipage,'invitePages',greatest(1,(v_itotal+24)/25),'inviteTotal',v_itotal);
end; $$;

create function public.my_coach_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_email text:=private.confirmed_email();v_links jsonb;v_invites jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_links from (
  select c.id,c.name,m.created_at from public.club_memberships m join public.clubs c on c.id=m.club_id where m.user_id=auth.uid() and m.role='coach' order by lower(c.name),c.id
 ) c;
 select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into v_invites from (
  select i.id,c.name as club_name,i.expires_at from public.coach_invitations i join public.clubs c on c.id=i.club_id where i.email=v_email and i.status='pending' and i.expires_at>now()
  and exists(select 1 from public.club_memberships where club_id=i.club_id and user_id=i.created_by and role='admin')
  order by i.created_at desc,i.id desc
 ) i;
 return jsonb_build_object('clubs',v_links,'invitations',v_invites,'emailConfirmed',v_email is not null);
end; $$;

revoke all on function public.invite_coach(uuid,text),public.revoke_coach_invitation(uuid,uuid),public.respond_coach_invitation(uuid,boolean),public.remove_coach(uuid,uuid),public.club_coaches(uuid,integer,integer),public.my_coach_workspace() from public,anon;
grant execute on function public.invite_coach(uuid,text),public.revoke_coach_invitation(uuid,uuid),public.respond_coach_invitation(uuid,boolean),public.remove_coach(uuid,uuid),public.club_coaches(uuid,integer,integer),public.my_coach_workspace() to authenticated;
commit;
