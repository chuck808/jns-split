-- Apply AFTER 202611240014_trackside.sql. Replaces four functions; no data changes.
--
-- 1. Once a session has any recorded effort, its distance, start type and
--    activity are locked, so the session can no longer misdescribe its results.
--    Name, date and lane count can still change.
-- 2. Every effort now carries its own saved distance and start type to the
--    screens, so speeds and comparisons never use the session's current settings.
-- 3. Bests, counts and "new best" marks are worked out over the WHOLE session
--    in the database. Only the list of efforts sent to the screen is capped,
--    so a long session can't push an early best out of the calculation.
begin;

create or replace function public.update_training_session(p_id uuid,p_version integer,p_name text,p_scheduled_at timestamptz,p_distance numeric,p_mode text,p_lanes integer) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.session_access(p_id,true) then raise exception 'Access denied' using errcode='42501'; end if;
 if v.status<>'planned' then raise exception 'Session is closed' using errcode='22023'; end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001'; end if;
 perform private.validate_session(p_name,p_distance,p_mode,p_lanes);
 if (p_distance is distinct from v.distance_metres or p_mode is distinct from v.start_mode)
   and exists(select 1 from public.efforts where session_id=p_id) then
   raise exception 'Results recorded: distance and start type are locked' using errcode='23514';
 end if;
 update public.training_sessions set name=btrim(p_name),scheduled_at=p_scheduled_at,distance_metres=p_distance,start_mode=p_mode,lane_count=p_lanes,version=version+1 where id=p_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(v.club_id,auth.uid(),p_id,'session_updated');
end; $$;

create or replace function public.set_session_activity(p_id uuid,p_version integer,p_activity text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if v.status<>'planned' or p_activity is null or p_activity not in ('coached','free_ride') then raise exception 'Invalid activity or closed session' using errcode='22023';end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001';end if;
 if v.activity=p_activity then return;end if;
 if exists(select 1 from public.efforts where session_id=p_id) then
   raise exception 'Results recorded: activity is locked' using errcode='23514';
 end if;
 if exists(select 1 from public.session_participants where session_id=p_id) then raise exception 'Remove planned participants before changing activity' using errcode='22023';end if;
 update public.training_sessions set activity=p_activity,version=version+1 where id=p_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(v.club_id,auth.uid(),p_id,'session_updated');
end; $$;

-- Session page: the newest 500 efforts to list, plus bests over the whole session,
-- one per rider for each distance and start type actually ridden.
drop function public.session_results(uuid);
create function public.session_results(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
  'total', (select count(*) from public.efforts where session_id=p_session_id)::int,
  'efforts', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at, e.id) from (
    select e.id, e.rider_id, e.rider_name, e.lane, e.outcome, e.elapsed_ms, e.is_test, e.recorded_at,
      e.distance_metres, e.start_mode
    from public.efforts e where e.session_id=p_session_id order by e.recorded_at desc, e.id desc limit 500) e), '[]'::jsonb),
  'bests', coalesce((select jsonb_agg(to_jsonb(b) order by b.distance_metres, b.start_mode, b.best_ms, b.rider_name) from (
    select e.rider_id, (array_agg(e.rider_name order by e.recorded_at desc))[1] as rider_name,
      e.distance_metres, e.start_mode, min(e.elapsed_ms) as best_ms, count(*)::int as count
    from public.efforts e
    where e.session_id=p_session_id and not e.is_test and e.outcome='completed'
    group by e.rider_id, e.distance_metres, e.start_mode) b), '[]'::jsonb)
 );
end; $$;

-- Trackside: summaries and "new best" marks over the whole session; the grid list is capped.
-- Only efforts at the session's distance and start type are compared (since this
-- migration they all are; older sessions edited before it may hold others).
create or replace function public.session_trackside(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.training_sessions%rowtype; v_since timestamptz;
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select * into s from public.training_sessions where id=p_session_id;
 select coalesce(min(recorded_at), now()) into v_since from public.efforts where session_id=p_session_id;
 return (
  with previous as (
    select e.rider_id, min(e.elapsed_ms) as best_ms from public.efforts e
    where e.rider_id in (select rider_id from public.efforts where session_id=p_session_id
                         union select rider_id from public.session_participants where session_id=p_session_id)
      and e.session_id<>p_session_id and not e.is_test and e.outcome='completed'
      and e.distance_metres=s.distance_metres and e.start_mode=s.start_mode
      and e.recorded_at<v_since and private.session_access(e.session_id)
    group by e.rider_id),
  marked as (
    select e.*,
      (not e.is_test and e.outcome='completed' and e.distance_metres=s.distance_metres and e.start_mode=s.start_mode) as comparable,
      min(e.elapsed_ms) filter (where not e.is_test and e.outcome='completed'
          and e.distance_metres=s.distance_metres and e.start_mode=s.start_mode)
        over (partition by e.rider_id order by e.recorded_at, e.id rows between unbounded preceding and 1 preceding) as earlier_best
    from public.efforts e where e.session_id=p_session_id),
  flagged as (
    select m.*, m.comparable and least(p.best_ms, m.earlier_best) is not null
      and m.elapsed_ms < least(p.best_ms, m.earlier_best) as new_best
    from marked m left join previous p on p.rider_id=m.rider_id)
  select jsonb_build_object(
   'now', now(),
   'session', jsonb_build_object('id', s.id, 'name', s.name, 'distance_metres', s.distance_metres,
      'start_mode', s.start_mode, 'lane_count', s.lane_count, 'activity', s.activity, 'status', s.status),
   'total', (select count(*) from flagged)::int,
   'efforts', coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_at, x.id) from (
      select f.id, f.rider_id, f.rider_name, f.lane, f.outcome, f.elapsed_ms, f.is_test, f.recorded_at,
        f.distance_metres, f.start_mode, f.new_best
      from flagged f order by f.recorded_at desc, f.id desc limit 500) x), '[]'::jsonb),
   'riders', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select f.rider_id, (array_agg(f.rider_name order by f.recorded_at desc))[1] as rider_name,
        min(f.elapsed_ms) filter (where f.comparable) as best_today,
        count(*)::int as efforts, max(f.recorded_at) as last_at
      from flagged f group by f.rider_id) r), '[]'::jsonb),
   'participants', coalesce((select jsonb_agg(jsonb_build_object('rider_id', r.id, 'display_name', r.display_name) order by lower(r.display_name), r.id)
      from public.session_participants p join public.riders r on r.id=p.rider_id
      where p.session_id=p_session_id and r.archived_at is null), '[]'::jsonb),
   'previousBests', coalesce((select jsonb_agg(jsonb_build_object('rider_id', rider_id, 'best_ms', best_ms)) from previous), '[]'::jsonb)
  ));
end; $$;

revoke all on function public.session_results(uuid) from public, anon, authenticated;
grant execute on function public.session_results(uuid) to authenticated;
commit;
