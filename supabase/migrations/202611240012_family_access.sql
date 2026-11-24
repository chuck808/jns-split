-- Apply AFTER 202611240011_rider_details.sql. Additive: existing riders, tags,
-- sessions, coaches and history are kept unchanged.
--
-- Family access (product-experience §5 "Rider registration and optional login",
-- "Guardian access", §14 "Rider onboarding"):
--  * an admin invites one email to one rider, as the rider themself or as a
--    guardian, after ticking that the club's own permissions check is done;
--  * who may be invited follows the club's age bands from migration 011;
--  * invitations are single-use, expire after seven days and can be renewed;
--    no email is sent: the invitee signs in with that address and accepts;
--  * an accepted invitation creates an account–rider link. Links are per
--    rider: a second child needs a second invitation, and removing one link
--    leaves the others untouched;
--  * linked accounts see the club-held details read-only, choose the rider's
--    scoreboard name and can ask the club for a correction. Never the tag UID.
-- Riders never need an account to ride.
begin;

alter table public.riders
  add column scoreboard_name text check (scoreboard_name in ('first_initial','initials','lane'));
comment on column public.riders.scoreboard_name is 'Chosen by a linked rider or guardian. Null: the club default applies.';

create table public.rider_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  rider_id uuid not null,
  email text not null check (email=lower(btrim(email)) and char_length(email) between 3 and 254),
  kind text not null check (kind in ('guardian','rider')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','declined')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  responded_at timestamptz,
  accepted_by uuid references auth.users(id),
  foreign key (rider_id, club_id) references public.riders(id, club_id)
);
create index rider_invites_rider_idx on public.rider_invitations(rider_id, created_at desc);
create index rider_invites_email_idx on public.rider_invitations(email) where status='pending';
create unique index rider_invites_pending_idx on public.rider_invitations(rider_id, email) where status='pending';

create table public.rider_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  rider_id uuid not null,
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('guardian','rider')),
  invitation_id uuid not null references public.rider_invitations(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id),
  foreign key (rider_id, club_id) references public.riders(id, club_id)
);
create unique index rider_links_active_idx on public.rider_links(rider_id, user_id) where removed_at is null;
-- One account per rider record, and one rider record per account, for "this is me".
create unique index rider_links_self_rider_idx on public.rider_links(rider_id) where kind='rider' and removed_at is null;
create unique index rider_links_self_user_idx on public.rider_links(user_id) where kind='rider' and removed_at is null;
create index rider_links_user_idx on public.rider_links(user_id) where removed_at is null;

create table public.rider_correction_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  rider_id uuid not null,
  requested_by uuid not null references auth.users(id),
  message text not null check (char_length(btrim(message)) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  foreign key (rider_id, club_id) references public.riders(id, club_id)
);
create index rider_corrections_open_idx on public.rider_correction_requests(club_id, created_at) where resolved_at is null;

alter table public.rider_invitations enable row level security;
alter table public.rider_links enable row level security;
alter table public.rider_correction_requests enable row level security;
create policy rider_invites_admin_read on public.rider_invitations for select to authenticated using (private.is_club_admin(club_id));
create policy rider_links_admin_read on public.rider_links for select to authenticated using (private.is_club_admin(club_id));
create policy rider_corrections_admin_read on public.rider_correction_requests for select to authenticated using (private.is_club_admin(club_id));
revoke all on public.rider_invitations, public.rider_links, public.rider_correction_requests from public, anon, authenticated;
grant select on public.rider_invitations, public.rider_links, public.rider_correction_requests to authenticated;

alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed','session_rider_added','session_rider_removed','rider_updated','rider_settings_updated','rider_field_saved','rider_field_removed',
  'rider_access_invited','rider_invitation_renewed','rider_invitation_revoked','rider_invitation_accepted','rider_invitation_declined','rider_link_removed','rider_scoreboard_name_set','rider_correction_requested','rider_correction_resolved'));

-- The youngest the rider can be today. With only a year of birth, assume the
-- birthday has not happened yet, so the age bands always err towards a guardian.
create function private.rider_min_age(p_birth_year integer, p_birth_date date) returns integer
language sql stable set search_path='' as $$
  select case
    when p_birth_date is not null then extract(year from age(current_date, p_birth_date))::int
    when p_birth_year is not null then greatest(0, extract(year from current_date)::int - p_birth_year - 1)
  end;
$$;

-- Which invitations the club's age bands allow for this rider.
create function private.rider_invite_kinds(p_rider_id uuid) returns text[]
language plpgsql stable security definer set search_path='' as $$
declare v_age integer; v_under integer; v_from integer; v_club uuid; v_kinds text[] := '{}';
begin
 select r.club_id, private.rider_min_age(r.birth_year, r.birth_date) into v_club, v_age from public.riders r where r.id=p_rider_id;
 if v_age is null then return v_kinds; end if;
 select s.guardian_only_under, s.rider_from into v_under, v_from from public.club_rider_settings s where s.club_id=v_club;
 v_under := coalesce(v_under, 13); v_from := coalesce(v_from, 18);
 if v_age < v_from then v_kinds := array_append(v_kinds, 'guardian'); end if;
 if v_age >= v_under then v_kinds := array_append(v_kinds, 'rider'); end if;
 return v_kinds;
end; $$;

create function private.has_rider_link(p_rider_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.rider_links l join public.riders r on r.id=l.rider_id
    where l.rider_id=p_rider_id and l.user_id=(select auth.uid()) and l.removed_at is null and r.archived_at is null);
$$;
revoke all on function private.rider_min_age(integer,date), private.rider_invite_kinds(uuid), private.has_rider_link(uuid) from public, anon, authenticated;

create function public.invite_rider_access(p_rider_id uuid, p_email text, p_kind text, p_checked boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_rider public.riders%rowtype; v_email text := lower(btrim(p_email)); v_id uuid;
begin
 select * into v_rider from public.riders where id=p_rider_id;
 if not found or not private.is_club_admin(v_rider.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_rider.club_id for update;
 if v_rider.archived_at is not null then raise exception 'Rider is archived' using errcode='22023'; end if;
 if p_checked is not true then raise exception 'Confirm the club permissions check' using errcode='22023'; end if;
 if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email' using errcode='22023'; end if;
 if p_kind is null or not (p_kind = any(private.rider_invite_kinds(p_rider_id))) then
   raise exception 'The club age bands do not allow this invitation' using errcode='23514';
 end if;
 if exists(select 1 from public.rider_links l join auth.users u on u.id=l.user_id
   where l.rider_id=p_rider_id and l.removed_at is null and lower(btrim(u.email))=v_email) then
   raise exception 'Already linked' using errcode='23505';
 end if;
 if p_kind='rider' and exists(select 1 from public.rider_links where rider_id=p_rider_id and kind='rider' and removed_at is null) then
   raise exception 'Rider already has their own account' using errcode='23505';
 end if;
 if exists(select 1 from public.rider_invitations where rider_id=p_rider_id and email=v_email and status='pending' and expires_at>now()) then
   raise exception 'Invitation already pending' using errcode='23505';
 end if;
 -- An expired pending invitation for the same address is replaced.
 update public.rider_invitations set status='revoked', responded_at=now() where rider_id=p_rider_id and email=v_email and status='pending';
 insert into public.rider_invitations(club_id, rider_id, email, kind, created_by)
   values (v_rider.club_id, p_rider_id, v_email, p_kind, auth.uid()) returning id into v_id;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_rider.club_id, auth.uid(), p_rider_id, 'rider_access_invited');
 return v_id;
end; $$;

-- Gives a pending invitation seven more days. No email is sent.
create function public.renew_rider_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv public.rider_invitations%rowtype;
begin
 select * into v_inv from public.rider_invitations where id=p_invitation_id;
 if not found or not private.is_club_admin(v_inv.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_inv.club_id for update;
 update public.rider_invitations set expires_at=now()+interval '7 days', created_by=auth.uid()
   where id=p_invitation_id and status='pending'
   and exists(select 1 from public.riders where id=v_inv.rider_id and archived_at is null);
 if not found then raise exception 'Invitation unavailable' using errcode='22023'; end if;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_inv.club_id, auth.uid(), v_inv.rider_id, 'rider_invitation_renewed');
end; $$;

create function public.revoke_rider_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv public.rider_invitations%rowtype;
begin
 select * into v_inv from public.rider_invitations where id=p_invitation_id;
 if not found or not private.is_club_admin(v_inv.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_inv.club_id for update;
 update public.rider_invitations set status='revoked', responded_at=now() where id=p_invitation_id and status='pending';
 if found then insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_inv.club_id, auth.uid(), v_inv.rider_id, 'rider_invitation_revoked'); end if;
end; $$;

-- An admin can remove any link in their club; a linked person can remove their own.
create function public.remove_rider_link(p_link_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_link public.rider_links%rowtype;
begin
 select * into v_link from public.rider_links where id=p_link_id and removed_at is null;
 if not found or not (private.is_club_admin(v_link.club_id) or v_link.user_id=auth.uid()) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_link.club_id for update;
 update public.rider_links set removed_at=now(), removed_by=auth.uid() where id=p_link_id and removed_at is null;
 if found then insert into public.club_audit(club_id, actor_id, rider_id, target_user_id, action) values (v_link.club_id, auth.uid(), v_link.rider_id, v_link.user_id, 'rider_link_removed'); end if;
end; $$;

create function public.respond_rider_invitation(p_invitation_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv public.rider_invitations%rowtype; v_club uuid; v_email text := private.confirmed_email();
begin
 if v_email is null then raise exception 'Confirmed account required' using errcode='42501'; end if;
 if p_accept is null then raise exception 'Invalid response' using errcode='22023'; end if;
 select club_id into v_club from public.rider_invitations where id=p_invitation_id and email=v_email;
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 perform 1 from public.clubs where id=v_club for update;
 select * into v_inv from public.rider_invitations where id=p_invitation_id for update;
 if v_inv.status<>'pending' or v_inv.expires_at<=now()
   or not private.is_club_admin_user(v_inv.club_id, v_inv.created_by)
   or exists(select 1 from public.riders where id=v_inv.rider_id and archived_at is not null) then
   raise exception 'Invitation unavailable' using errcode='22023';
 end if;
 if p_accept then
   if exists(select 1 from public.rider_links where rider_id=v_inv.rider_id and user_id=auth.uid() and removed_at is null) then
     raise exception 'Already linked' using errcode='23505';
   end if;
   if v_inv.kind='rider' and exists(select 1 from public.rider_links where kind='rider' and removed_at is null and (rider_id=v_inv.rider_id or user_id=auth.uid())) then
     raise exception 'Already linked as a rider' using errcode='23505';
   end if;
   insert into public.rider_links(club_id, rider_id, user_id, kind, invitation_id)
     values (v_inv.club_id, v_inv.rider_id, auth.uid(), v_inv.kind, v_inv.id);
 end if;
 update public.rider_invitations set status=case when p_accept then 'accepted' else 'declined' end, responded_at=now(),
   accepted_by=case when p_accept then auth.uid() end where id=p_invitation_id;
 insert into public.club_audit(club_id, actor_id, rider_id, target_user_id, action)
   values (v_inv.club_id, auth.uid(), v_inv.rider_id, auth.uid(), case when p_accept then 'rider_invitation_accepted' else 'rider_invitation_declined' end);
end; $$;

create function private.is_club_admin_user(p_club_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.club_membership_roles where club_id=p_club_id and user_id=p_user_id and role='admin');
$$;
revoke all on function private.is_club_admin_user(uuid,uuid) from public, anon, authenticated;

-- Admin view of one rider's family access.
create function public.rider_access(p_rider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rider public.riders%rowtype; v_under integer; v_from integer;
begin
 select * into v_rider from public.riders where id=p_rider_id;
 if not found or not private.is_club_admin(v_rider.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select guardian_only_under, rider_from into v_under, v_from from public.club_rider_settings where club_id=v_rider.club_id;
 return jsonb_build_object(
  'rider', jsonb_build_object('id', v_rider.id, 'display_name', v_rider.display_name, 'birth_year', v_rider.birth_year,
     'birth_date', v_rider.birth_date, 'archived_at', v_rider.archived_at, 'scoreboard_name', v_rider.scoreboard_name),
  'minAge', private.rider_min_age(v_rider.birth_year, v_rider.birth_date),
  'guardianOnlyUnder', coalesce(v_under, 13), 'riderFrom', coalesce(v_from, 18),
  'allowedKinds', to_jsonb(private.rider_invite_kinds(p_rider_id)),
  'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'email', u.email, 'created_at', l.created_at) order by l.created_at, l.id)
     from public.rider_links l join auth.users u on u.id=l.user_id where l.rider_id=p_rider_id and l.removed_at is null), '[]'::jsonb),
  'invitations', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc, i.id desc) from (
     select i.id, i.email, i.kind, i.created_at, i.expires_at,
       case when i.status='pending' and i.expires_at<=now() then 'expired'
            when i.status='pending' and not private.is_club_admin_user(i.club_id, i.created_by) then 'unavailable'
            else i.status end as status
     from public.rider_invitations i where i.rider_id=p_rider_id order by i.created_at desc, i.id desc limit 20) i), '[]'::jsonb),
  'corrections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'message', c.message, 'email', u.email, 'created_at', c.created_at) order by c.created_at, c.id)
     from public.rider_correction_requests c join auth.users u on u.id=c.requested_by where c.rider_id=p_rider_id and c.resolved_at is null), '[]'::jsonb)
 );
end; $$;

-- Open correction requests across the club, for the Riders & tags page.
create function public.club_correction_requests(p_club_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
   select c.id, c.rider_id, r.display_name, c.created_at from public.rider_correction_requests c
   join public.riders r on r.id=c.rider_id where c.club_id=p_club_id and c.resolved_at is null
   order by c.created_at, c.id limit 50) c), '[]'::jsonb);
end; $$;

create function public.resolve_rider_correction(p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_req public.rider_correction_requests%rowtype;
begin
 select * into v_req from public.rider_correction_requests where id=p_request_id;
 if not found or not private.is_club_admin(v_req.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.rider_correction_requests set resolved_at=now(), resolved_by=auth.uid() where id=p_request_id and resolved_at is null;
 if found then insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_req.club_id, auth.uid(), v_req.rider_id, 'rider_correction_resolved'); end if;
end; $$;

-- Everything a signed-in rider or guardian may see. Never the tag UID.
create function public.my_rider_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_email text := private.confirmed_email();
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object(
  'emailConfirmed', v_email is not null,
  'invitations', coalesce((select jsonb_agg(to_jsonb(i)) from (
     select i.id, i.kind, i.expires_at, c.name as club_name, r.display_name as rider_name
     from public.rider_invitations i join public.clubs c on c.id=i.club_id join public.riders r on r.id=i.rider_id
     where i.email=v_email and i.status='pending' and i.expires_at>now() and r.archived_at is null
       and private.is_club_admin_user(i.club_id, i.created_by)
     order by i.created_at desc, i.id desc) i), '[]'::jsonb),
  'riders', coalesce((select jsonb_agg(to_jsonb(x)) from (
     select l.id as link_id, l.kind, r.id as rider_id, r.display_name, c.name as club_name, r.birth_year, r.birth_date,
       coalesce(r.scoreboard_name, s.scoreboard_name, 'first_initial') as scoreboard_name,
       r.scoreboard_name is not null as scoreboard_chosen,
       exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null) as has_tag,
       coalesce((select jsonb_agg(jsonb_build_object('label', f.label, 'value', v.value) order by f.created_at, f.id)
         from public.rider_field_values v join public.club_rider_fields f on f.id=v.field_id and f.archived_at is null
         where v.rider_id=r.id), '[]'::jsonb) as fields,
       (select count(*) from public.rider_correction_requests q where q.rider_id=r.id and q.requested_by=auth.uid() and q.resolved_at is null)::int as open_corrections
     from public.rider_links l join public.riders r on r.id=l.rider_id join public.clubs c on c.id=r.club_id
     left join public.club_rider_settings s on s.club_id=r.club_id
     where l.user_id=auth.uid() and l.removed_at is null and r.archived_at is null
     order by l.kind desc, lower(r.display_name), r.id) x), '[]'::jsonb)
 );
end; $$;

create function public.set_rider_scoreboard_name(p_rider_id uuid, p_choice text) returns void
language plpgsql security definer set search_path='' as $$
declare v_club uuid;
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_choice is null or p_choice not in ('first_initial','initials','lane') then raise exception 'Invalid choice' using errcode='22023'; end if;
 update public.riders set scoreboard_name=p_choice where id=p_rider_id and scoreboard_name is distinct from p_choice returning club_id into v_club;
 if v_club is not null then insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_club, auth.uid(), p_rider_id, 'rider_scoreboard_name_set'); end if;
end; $$;

create function public.request_rider_correction(p_rider_id uuid, p_message text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_id uuid;
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_message is null or char_length(btrim(p_message)) not between 1 and 500 then raise exception 'Invalid message' using errcode='22023'; end if;
 select club_id into v_club from public.riders where id=p_rider_id;
 perform 1 from public.clubs where id=v_club for update;
 if (select count(*) from public.rider_correction_requests where rider_id=p_rider_id and requested_by=auth.uid() and resolved_at is null) >= 3 then
   raise exception 'Too many open requests' using errcode='23514';
 end if;
 insert into public.rider_correction_requests(club_id, rider_id, requested_by, message) values (v_club, p_rider_id, auth.uid(), btrim(p_message)) returning id into v_id;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_club, auth.uid(), p_rider_id, 'rider_correction_requested');
 return v_id;
end; $$;

-- Workspaces gain "Riders and family" once an account has a link or a pending invitation.
create or replace function public.my_workspaces() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_coach jsonb;v_riders jsonb;
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
 v_riders:=public.my_rider_workspace();
 if jsonb_array_length(v_riders->'riders')>0 or jsonb_array_length(v_riders->'invitations')>0 then
  v_items:=v_items||jsonb_build_array(jsonb_build_object('key','riders','label','Riders and family','description','Your own riding, and riders linked to you','href','/riders'));
 end if;
 if private.is_platform_admin() then
  v_items:=jsonb_build_array(jsonb_build_object('key','platform','label','Platform administration','description','Review club applications and admission decisions','href','/admin'))||v_items;
 end if;
 return v_items;
end; $$;

revoke all on function public.invite_rider_access(uuid,text,text,boolean), public.renew_rider_invitation(uuid), public.revoke_rider_invitation(uuid),
  public.remove_rider_link(uuid), public.respond_rider_invitation(uuid,boolean), public.rider_access(uuid), public.club_correction_requests(uuid),
  public.resolve_rider_correction(uuid), public.my_rider_workspace(), public.set_rider_scoreboard_name(uuid,text), public.request_rider_correction(uuid,text) from public, anon;
grant execute on function public.invite_rider_access(uuid,text,text,boolean), public.renew_rider_invitation(uuid), public.revoke_rider_invitation(uuid),
  public.remove_rider_link(uuid), public.respond_rider_invitation(uuid,boolean), public.rider_access(uuid), public.club_correction_requests(uuid),
  public.resolve_rider_correction(uuid), public.my_rider_workspace(), public.set_rider_scoreboard_name(uuid,text), public.request_rider_correction(uuid,text) to authenticated;
commit;
