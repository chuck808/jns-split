-- Apply AFTER 202611240013_recorded_results.sql. Adds one read-only function.
--
-- The trackside coach view: a session's efforts plus each rider's previous best
-- for the same distance and start type. "Previous" means Live, completed efforts
-- recorded before this session's first effort, and ONLY from sessions the viewer
-- can already open. An admin sees the club's sessions; a coach sees only their
-- assigned sessions, so no history is revealed without its own grant
-- (product-experience §3, "View historical results").
begin;

create function public.session_trackside(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.training_sessions%rowtype; v_since timestamptz;
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select * into s from public.training_sessions where id=p_session_id;
 select coalesce(min(recorded_at), now()) into v_since from public.efforts where session_id=p_session_id;
 return jsonb_build_object(
  'now', now(),
  'session', jsonb_build_object('id', s.id, 'name', s.name, 'distance_metres', s.distance_metres,
     'start_mode', s.start_mode, 'lane_count', s.lane_count, 'activity', s.activity, 'status', s.status),
  'efforts', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at, e.id) from (
     select e.id, e.rider_id, e.rider_name, e.lane, e.outcome, e.elapsed_ms, e.is_test, e.recorded_at
     from public.efforts e where e.session_id=p_session_id order by e.recorded_at desc, e.id desc limit 500) e), '[]'::jsonb),
  -- Riders still to ride: the planned list for a coached session.
  'participants', coalesce((select jsonb_agg(jsonb_build_object('rider_id', r.id, 'display_name', r.display_name) order by lower(r.display_name), r.id)
     from public.session_participants p join public.riders r on r.id=p.rider_id
     where p.session_id=p_session_id and r.archived_at is null), '[]'::jsonb),
  'previousBests', coalesce((select jsonb_agg(jsonb_build_object('rider_id', b.rider_id, 'best_ms', b.best_ms)) from (
     select e.rider_id, min(e.elapsed_ms) as best_ms from public.efforts e
     where e.rider_id in (select rider_id from public.efforts where session_id=p_session_id
                          union select rider_id from public.session_participants where session_id=p_session_id)
       and e.session_id<>p_session_id and not e.is_test and e.outcome='completed'
       and e.distance_metres=s.distance_metres and e.start_mode=s.start_mode
       and e.recorded_at<v_since
       and private.session_access(e.session_id)
     group by e.rider_id) b), '[]'::jsonb)
 );
end; $$;

revoke all on function public.session_trackside(uuid) from public, anon, authenticated;
grant execute on function public.session_trackside(uuid) to authenticated;
commit;
