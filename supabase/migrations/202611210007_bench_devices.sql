-- Isolated, expiring TEST devices. No measured results or real participant writes.
begin;
create table private.bench_devices (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),
 session_id uuid not null references public.training_sessions(id),session_version integer not null,
 name text not null check(char_length(name) between 1 and 60),token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null default now()+interval '24 hours',revoked boolean not null default false,
 last_request_at timestamptz,created_at timestamptz not null default now()
);
create table private.bench_lanes (
 session_id uuid not null references public.training_sessions(id),lane integer not null check(lane between 1 and 4),
 rider_id uuid not null references public.riders(id),running boolean not null default false,
 primary key(session_id,lane),unique(session_id,rider_id)
);
create table private.bench_requests (
 device_id uuid not null references private.bench_devices(id) on delete cascade,
 request_id text not null,fingerprint text not null,decision jsonb not null,
 primary key(device_id,request_id)
);
revoke all on private.bench_devices,private.bench_lanes,private.bench_requests from public,anon,authenticated;

create function public.create_bench_device(p_session_id uuid,p_name text,p_token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.training_sessions%rowtype;v_id uuid;
begin
 select * into s from public.training_sessions where id=p_session_id for update;
 if not found or not private.is_club_admin(s.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if s.status<>'planned' or p_name is null or char_length(btrim(p_name)) not between 1 and 60 or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid test device' using errcode='22023';end if;
 -- Expired credentials and their request cache are expendable test data.
 delete from private.bench_devices where club_id=s.club_id and (expires_at<=now() or revoked);
 if (select count(*) from private.bench_devices where club_id=s.club_id)>=20 then raise exception 'Revoke an old test device first' using errcode='22023';end if;
 -- A configuration change invalidates old credentials and simulated lane assignments.
 if not exists(select 1 from private.bench_devices where session_id=s.id and session_version=s.version) then
  delete from private.bench_lanes where session_id=s.id;
 end if;
 insert into private.bench_devices(club_id,session_id,session_version,name,token_hash) values(s.club_id,s.id,s.version,btrim(p_name),p_token_hash) returning id into v_id;
 return v_id;
end; $$;
create function public.list_bench_devices(p_club_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(d)) from (select id,name,session_id,expires_at,revoked,created_at from private.bench_devices where club_id=p_club_id order by created_at desc limit 20) d),'[]'::jsonb);
end; $$;
create function public.revoke_bench_device(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_club uuid;
begin
 select club_id into v_club from private.bench_devices where id=p_id;
 if not found or not private.is_club_admin(v_club) then raise exception 'Access denied' using errcode='42501';end if;
 update private.bench_devices set revoked=true where id=p_id;
end; $$;

create function public.bench_device_event(p_id uuid,p_token text,p_request_id text,p_action text,p_lane integer,p_uid text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.bench_devices%rowtype;s public.training_sessions%rowtype;r public.riders%rowtype;
 prev private.bench_requests%rowtype;v_fingerprint text;v_decision jsonb;v_code text;v_name text:='';v_running boolean;v_rider uuid;
begin
 -- Check the secret before locking; take locks in session/device order, as provisioning does.
 select * into d from private.bench_devices where id=p_id;
 if not found or d.revoked or d.expires_at<=now() or p_token is null or p_token !~ '^[0-9a-f]{64}$' or d.token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') then raise exception 'Invalid test credential' using errcode='42501';end if;
 if p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{1,80}$' or p_action is null or p_action not in ('scan','start','clear') or p_lane is null or p_lane not between 1 and 4 or p_uid is null or (p_action='scan' and p_uid !~ '^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$') or (p_action<>'scan' and p_uid<>'') then raise exception 'Invalid test event' using errcode='22023';end if;
 select * into s from public.training_sessions where id=d.session_id for update;
 select * into d from private.bench_devices where id=p_id for update;
 if not found or d.revoked or d.expires_at<=now() then raise exception 'Invalid test credential' using errcode='42501';end if;
 if s.status<>'planned' or s.version<>d.session_version then return jsonb_build_object('code','SESSION_CHANGED','name','','replay',false);end if;
 v_fingerprint:=p_action||':'||p_lane::text||':'||p_uid;
 select * into prev from private.bench_requests where device_id=d.id and request_id=p_request_id;
 if found then
  if prev.fingerprint<>v_fingerprint then raise exception 'Request ID reused' using errcode='22023';end if;
  return prev.decision||jsonb_build_object('replay',true);
 end if;
 if d.last_request_at>clock_timestamp()-interval '1 second' then raise exception 'Wait before another test' using errcode='P0001';end if;
 if (select count(*) from private.bench_requests where device_id=d.id)>=1000 then raise exception 'Test limit reached; issue a new credential' using errcode='22023';end if;
 update private.bench_devices set last_request_at=clock_timestamp() where id=d.id;
 select rider_id,running into v_rider,v_running from private.bench_lanes where session_id=s.id and lane=p_lane;
 if p_lane>s.lane_count then v_code:='LANE_DISABLED';
 elsif p_action='clear' then
  delete from private.bench_lanes where session_id=s.id and lane=p_lane;v_code:='CLEARED_NO_RESULT';
 elsif p_action='start' then
  if v_rider is null then v_code:='SCAN_FIRST';
  elsif v_running then v_code:='ALREADY_RUNNING';
  else update private.bench_lanes set running=true where session_id=s.id and lane=p_lane;v_code:='STARTED';end if;
 else
  select rider.* into r from public.riders rider join public.tag_assignments tag on tag.rider_id=rider.id and tag.club_id=rider.club_id
   where tag.uid=p_uid and tag.club_id=s.club_id and tag.revoked_at is null and rider.archived_at is null;
  if not found then v_code:='TAG_UNAVAILABLE';
  elsif s.activity='coached' and not exists(select 1 from public.session_participants where session_id=s.id and rider_id=r.id) then v_code:='NOT_IN_SESSION';
  elsif v_running then v_code:='LANE_RUNNING';
  elsif v_rider is not null and v_rider<>r.id then v_code:='LANE_OCCUPIED';
  elsif exists(select 1 from private.bench_lanes where session_id=s.id and rider_id=r.id and lane<>p_lane) then v_code:='RIDER_OTHER_LANE';
  else
   insert into private.bench_lanes(session_id,lane,rider_id) values(s.id,p_lane,r.id) on conflict(session_id,lane) do nothing;
   v_code:='ACCEPTED';v_name:=r.display_name;
  end if;
 end if;
 v_decision:=jsonb_build_object('code',v_code,'name',v_name,'replay',false);
 insert into private.bench_requests values(d.id,p_request_id,v_fingerprint,v_decision);
 return v_decision;
end; $$;
revoke all on function public.create_bench_device(uuid,text,text),public.list_bench_devices(uuid),public.revoke_bench_device(uuid),public.bench_device_event(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.create_bench_device(uuid,text,text),public.list_bench_devices(uuid),public.revoke_bench_device(uuid) to authenticated;
-- Credential-checked RPC, deliberately callable without a human Auth session.
grant execute on function public.bench_device_event(uuid,text,text,text,integer,text) to anon,authenticated;
commit;
