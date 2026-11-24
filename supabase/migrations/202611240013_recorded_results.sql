-- Apply AFTER 202611240012_family_access.sql. Additive.
--
-- Recorded results (product-experience slice D; development plan milestone 4):
--  * a club issues timing-controller credentials, each either TEST or LIVE;
--  * a controller uploads one effort at a time with its own stable result ID.
--    Repeating an upload returns the original decision and saves nothing new;
--  * the rider is resolved from the tag at upload time; the session's distance,
--    start type and activity and the rider's name are copied onto the effort;
--  * efforts are immutable: no update or delete for any app role. Corrections
--    will be a separate audited record later;
--  * TEST efforts are visible to the club's admins and the session's coaches,
--    labelled as demo data. They never reach riders, families or bests.
-- The bench simulator tables (migrations 007/008) are unchanged and still save nothing.
begin;

create table private.timing_devices (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  mode text not null check (mode in ('test','live')),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz
);
create index timing_devices_club_idx on private.timing_devices(club_id, created_at desc);
revoke all on private.timing_devices from public, anon, authenticated;

create table public.efforts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  session_id uuid not null,
  rider_id uuid not null,
  device_id uuid not null references private.timing_devices(id),
  device_result_id text not null check (device_result_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  fingerprint text not null,
  is_test boolean not null,
  lane integer not null check (lane between 1 and 4),
  outcome text not null check (outcome in ('completed','dnf','cancelled','invalid')),
  elapsed_ms integer check (elapsed_ms between 1 and 600000),
  distance_metres numeric not null,
  start_mode text not null,
  activity text not null,
  rider_name text not null,
  recorded_at timestamptz not null default now(),
  unique (device_id, device_result_id),
  check ((outcome = 'completed') = (elapsed_ms is not null)),
  foreign key (session_id, club_id) references public.training_sessions(id, club_id),
  foreign key (rider_id, club_id) references public.riders(id, club_id)
);
create index efforts_session_idx on public.efforts(session_id, recorded_at);
create index efforts_rider_live_idx on public.efforts(rider_id, recorded_at desc) where not is_test;
alter table public.efforts enable row level security;
-- Reads go through the checked functions below; no direct table access, and never any writes.
revoke all on public.efforts from public, anon, authenticated;

alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed','session_rider_added','session_rider_removed','rider_updated','rider_settings_updated','rider_field_saved','rider_field_removed',
  'rider_access_invited','rider_invitation_renewed','rider_invitation_revoked','rider_invitation_accepted','rider_invitation_declined','rider_link_removed','rider_scoreboard_name_set','rider_correction_requested','rider_correction_resolved',
  'timing_device_created','timing_device_revoked'));

-- Test credentials last a week; live ones 180 days. Only the hash of the secret is stored.
create function public.create_timing_device(p_club_id uuid, p_name text, p_mode text, p_token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 or p_mode is null or p_mode not in ('test','live')
   or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Invalid controller' using errcode='22023';
 end if;
 perform 1 from public.clubs where id=p_club_id for update;
 if (select count(*) from private.timing_devices where club_id=p_club_id and revoked_at is null and expires_at>now()) >= 20 then
   raise exception 'Too many active controllers' using errcode='23514';
 end if;
 insert into private.timing_devices(club_id, name, mode, token_hash, created_by, expires_at)
   values (p_club_id, btrim(p_name), p_mode, p_token_hash, auth.uid(),
     now() + case when p_mode='test' then interval '7 days' else interval '180 days' end)
   returning id into v_id;
 insert into public.club_audit(club_id, actor_id, action) values (p_club_id, auth.uid(), 'timing_device_created');
 return v_id;
end; $$;

create function public.list_timing_devices(p_club_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc, d.id) from (
   select d.id, d.name, d.mode, d.created_at, d.expires_at, d.last_seen_at,
     d.revoked_at is not null as revoked, d.expires_at<=now() as expired,
     (select count(*) from public.efforts e where e.device_id=d.id)::int as efforts
   from private.timing_devices d where d.club_id=p_club_id order by d.created_at desc limit 50) d), '[]'::jsonb);
end; $$;

create function public.revoke_timing_device(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_club uuid;
begin
 select club_id into v_club from private.timing_devices where id=p_id;
 if not found or not private.is_club_admin(v_club) then raise exception 'Access denied' using errcode='42501'; end if;
 update private.timing_devices set revoked_at=now() where id=p_id and revoked_at is null;
 if found then insert into public.club_audit(club_id, actor_id, action) values (v_club, auth.uid(), 'timing_device_revoked'); end if;
end; $$;

-- Called by the upload endpoint with the controller's credential, never a person's session.
create function public.record_effort(p_device_id uuid, p_token text, p_result_id text, p_session_id uuid,
  p_lane integer, p_uid text, p_outcome text, p_elapsed_ms integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.timing_devices%rowtype; s public.training_sessions%rowtype; r public.riders%rowtype;
  prev public.efforts%rowtype; v_fp text; v_code text;
begin
 select * into d from private.timing_devices where id=p_device_id;
 if not found or d.revoked_at is not null or d.expires_at<=now() or p_token is null or p_token !~ '^[0-9a-f]{64}$'
   or d.token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') then
   raise exception 'Invalid controller credential' using errcode='42501';
 end if;
 if p_result_id is null or p_result_id !~ '^[A-Za-z0-9_-]{1,80}$' or p_session_id is null
   or p_lane is null or p_lane not between 1 and 4
   or p_uid is null or p_uid !~ '^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$'
   or p_outcome is null or p_outcome not in ('completed','dnf','cancelled','invalid')
   or (p_outcome='completed' and (p_elapsed_ms is null or p_elapsed_ms not between 1 and 600000))
   or (p_outcome<>'completed' and p_elapsed_ms is not null) then
   raise exception 'Invalid effort' using errcode='22023';
 end if;
 v_fp := concat_ws('|', p_session_id, p_lane, p_uid, p_outcome, p_elapsed_ms);
 -- Serialise uploads from one controller so a retry can't race its original.
 perform 1 from private.timing_devices where id=d.id for update;
 select * into prev from public.efforts where device_id=d.id and device_result_id=p_result_id;
 if found then
   if prev.fingerprint<>v_fp then
     return jsonb_build_object('code','RESULT_ID_CONFLICT','resultId',p_result_id,'replay',false);
   end if;
   return jsonb_build_object('code','SAVED','resultId',p_result_id,'replay',true,'test',prev.is_test,'name',prev.rider_name);
 end if;
 update private.timing_devices set last_seen_at=now() where id=d.id;
 select * into s from public.training_sessions where id=p_session_id and club_id=d.club_id;
 if not found then v_code := 'SESSION_UNAVAILABLE';
 elsif s.status<>'planned' then v_code := 'SESSION_CLOSED';
 elsif p_lane>s.lane_count then v_code := 'LANE_DISABLED';
 else
   select rider.* into r from public.riders rider
     join public.tag_assignments t on t.rider_id=rider.id and t.club_id=rider.club_id
     where t.uid=p_uid and t.club_id=d.club_id and t.revoked_at is null and rider.archived_at is null;
   if not found then v_code := 'TAG_UNAVAILABLE';
   elsif s.activity='coached' and not exists(select 1 from public.session_participants where session_id=s.id and rider_id=r.id) then
     v_code := 'NOT_IN_SESSION';
   end if;
 end if;
 -- Rejections are not stored, so the controller can retry the same result ID once fixed.
 if v_code is not null then return jsonb_build_object('code',v_code,'resultId',p_result_id,'replay',false); end if;
 if (select count(*) from public.efforts where device_id=d.id) >= 20000 then
   raise exception 'Controller limit reached; issue a new credential' using errcode='23514';
 end if;
 insert into public.efforts(club_id, session_id, rider_id, device_id, device_result_id, fingerprint, is_test, lane, outcome,
   elapsed_ms, distance_metres, start_mode, activity, rider_name)
 values (d.club_id, s.id, r.id, d.id, p_result_id, v_fp, d.mode='test', p_lane, p_outcome,
   p_elapsed_ms, s.distance_metres, s.start_mode, s.activity, r.display_name);
 return jsonb_build_object('code','SAVED','resultId',p_result_id,'replay',false,'test',d.mode='test','name',r.display_name);
end; $$;

-- Club admins and the session's coaches: every effort, test ones flagged.
create function public.session_results(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at, e.id) from (
   select e.id, e.rider_id, e.rider_name, e.lane, e.outcome, e.elapsed_ms, e.is_test, e.recorded_at
   from public.efforts e where e.session_id=p_session_id order by e.recorded_at desc, e.id desc limit 500) e), '[]'::jsonb);
end; $$;

-- A linked rider or guardian: live efforts for that rider only.
create function public.rider_results(p_rider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
  'efforts', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at desc, e.id desc) from (
    select e.id, e.recorded_at, t.name as session_name, e.distance_metres, e.start_mode, e.activity, e.outcome, e.elapsed_ms
    from public.efforts e join public.training_sessions t on t.id=e.session_id
    where e.rider_id=p_rider_id and not e.is_test order by e.recorded_at desc, e.id desc limit 200) e), '[]'::jsonb),
  'groups', coalesce((select jsonb_agg(to_jsonb(g) order by g.latest_at desc) from (
    select e.distance_metres, e.start_mode, e.activity, min(e.elapsed_ms) as best_ms, count(*)::int as valid_count, max(e.recorded_at) as latest_at
    from public.efforts e where e.rider_id=p_rider_id and not e.is_test and e.outcome='completed'
    group by e.distance_metres, e.start_mode, e.activity) g), '[]'::jsonb)
 );
end; $$;

revoke all on function public.create_timing_device(uuid,text,text,text), public.list_timing_devices(uuid), public.revoke_timing_device(uuid),
  public.record_effort(uuid,text,text,uuid,integer,text,text,integer), public.session_results(uuid), public.rider_results(uuid) from public, anon, authenticated;
grant execute on function public.create_timing_device(uuid,text,text,text), public.list_timing_devices(uuid), public.revoke_timing_device(uuid),
  public.session_results(uuid), public.rider_results(uuid) to authenticated;
-- Credential-checked inside the function; the upload endpoint calls it without a person's sign-in.
grant execute on function public.record_effort(uuid,text,text,uuid,integer,text,text,integer) to anon, authenticated;
commit;
