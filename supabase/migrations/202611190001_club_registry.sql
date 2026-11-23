-- JNS SPLIT club registry. Apply with the Supabase SQL editor or migrations.
-- No runtime service-role key. All application writes use checked RPCs.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create table public.club_memberships (
  club_id uuid not null references public.clubs(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin', 'coach')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_memberships_user_idx on public.club_memberships(user_id);
create table public.riders (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id, club_id)
);
create index riders_club_idx on public.riders(club_id);
create table public.tag_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  rider_id uuid not null,
  uid text not null check (uid ~ '^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$'),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  assigned_by uuid not null references auth.users(id),
  foreign key(rider_id, club_id) references public.riders(id, club_id)
);
create unique index tag_one_active_uid on public.tag_assignments(uid) where revoked_at is null;
create unique index tag_one_active_per_rider on public.tag_assignments(rider_id) where revoked_at is null;
create index tags_club_idx on public.tag_assignments(club_id);
create table public.club_audit (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  actor_id uuid not null references auth.users(id),
  rider_id uuid references public.riders(id),
  action text not null check (action in ('club_created','rider_registered','tag_assigned','tag_revoked','rider_archived')),
  created_at timestamptz not null default now()
);
create index club_audit_club_idx on public.club_audit(club_id, created_at desc);

create function private.is_club_admin(p_club_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.club_memberships m
   where m.club_id = p_club_id and m.user_id = (select auth.uid()) and m.role = 'admin');
$$;
revoke all on function private.is_club_admin(uuid) from public, anon;
grant execute on function private.is_club_admin(uuid) to authenticated;

alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.riders enable row level security;
alter table public.tag_assignments enable row level security;
alter table public.club_audit enable row level security;
create policy clubs_read on public.clubs for select to authenticated using (private.is_club_admin(id));
create policy memberships_read on public.club_memberships for select to authenticated using (user_id = (select auth.uid()));
create policy riders_read on public.riders for select to authenticated using (private.is_club_admin(club_id));
create policy tags_read on public.tag_assignments for select to authenticated using (private.is_club_admin(club_id));
create policy audit_read on public.club_audit for select to authenticated using (private.is_club_admin(club_id));
-- Supabase default grants can be broader than intended; revoke explicitly.
revoke all on public.clubs, public.club_memberships, public.riders, public.tag_assignments, public.club_audit from anon, authenticated;
grant select on public.clubs, public.club_memberships, public.riders, public.tag_assignments, public.club_audit to authenticated;

create function public.create_club(p_name text) returns uuid
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
 insert into public.club_audit(club_id,actor_id,action) values(v_id,v_user,'club_created');
 return v_id;
end; $$;

create function public.set_rider_tag(p_rider_id uuid, p_uid text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_rider public.riders%rowtype; v_uid text;
begin
 select * into v_rider from public.riders where id=p_rider_id for update;
 if not found or not private.is_club_admin(v_rider.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v_rider.archived_at is not null then raise exception 'Rider is archived' using errcode='22023'; end if;
 v_uid := upper(regexp_replace(p_uid,'[ :\-]','','g'));
 if v_uid is null or v_uid !~ '^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$' then raise exception 'Invalid tag UID' using errcode='22023'; end if;
 if exists(select 1 from public.tag_assignments where rider_id=p_rider_id and uid=v_uid and revoked_at is null) then return; end if;
 update public.tag_assignments set revoked_at=now() where rider_id=p_rider_id and revoked_at is null;
 insert into public.tag_assignments(club_id,rider_id,uid,assigned_by) values(v_rider.club_id,p_rider_id,v_uid,auth.uid());
 insert into public.club_audit(club_id,actor_id,rider_id,action) values(v_rider.club_id,auth.uid(),p_rider_id,'tag_assigned');
 -- A unique conflict rolls back the entire replacement, keeping the old tag active.
end; $$;

create function public.register_rider(p_club_id uuid, p_name text, p_uid text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Invalid rider name' using errcode='22023'; end if;
 insert into public.riders(club_id,display_name) values(p_club_id,btrim(p_name)) returning id into v_id;
 if nullif(btrim(p_uid),'') is not null then perform public.set_rider_tag(v_id,p_uid); end if;
 insert into public.club_audit(club_id,actor_id,rider_id,action) values(p_club_id,auth.uid(),v_id,'rider_registered');
 return v_id;
end; $$;

create function public.revoke_rider_tag(p_rider_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
 select club_id into v_club from public.riders where id=p_rider_id for update;
 if not found or not private.is_club_admin(v_club) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.tag_assignments set revoked_at=now() where rider_id=p_rider_id and revoked_at is null;
 if found then insert into public.club_audit(club_id,actor_id,rider_id,action) values(v_club,auth.uid(),p_rider_id,'tag_revoked'); end if;
end; $$;

create function public.archive_rider(p_rider_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_rider public.riders%rowtype;
begin
 select * into v_rider from public.riders where id=p_rider_id for update;
 if not found or not private.is_club_admin(v_rider.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v_rider.archived_at is not null then return; end if;
 perform public.revoke_rider_tag(p_rider_id);
 update public.riders set archived_at=now() where id=p_rider_id;
 insert into public.club_audit(club_id,actor_id,rider_id,action) values(v_rider.club_id,auth.uid(),p_rider_id,'rider_archived');
end; $$;

revoke all on function public.create_club(text), public.register_rider(uuid,text,text), public.set_rider_tag(uuid,text), public.revoke_rider_tag(uuid), public.archive_rider(uuid) from public, anon;
grant execute on function public.create_club(text), public.register_rider(uuid,text,text), public.set_rider_tag(uuid,text), public.revoke_rider_tag(uuid), public.archive_rider(uuid) to authenticated;
commit;
