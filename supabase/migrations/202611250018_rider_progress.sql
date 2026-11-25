-- Apply AFTER 202611250017_effort_notes.sql. Replaces one function; no data changes.
--
-- Adds `progress` to rider_results for the progress chart: one point per session
-- for each distance, start type and activity, the rider's best Live time in that
-- session. Worked out over the rider's whole history in the database, so the chart
-- never depends on the capped list of individual efforts. Up to the latest 100
-- sessions per group. Access is unchanged: linked riders and guardians only,
-- Live efforts only, no notes.
begin;

create or replace function public.rider_results(p_rider_id uuid) returns jsonb
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
    group by e.distance_metres, e.start_mode, e.activity) g), '[]'::jsonb),
  'progress', coalesce((select jsonb_agg(to_jsonb(p) order by p.distance_metres, p.start_mode, p.activity, p.day) from (
    select * from (
      select e.distance_metres, e.start_mode, e.activity, e.session_id, t.name as session_name,
        min(e.recorded_at) as day, min(e.elapsed_ms) as best_ms, count(*)::int as count,
        row_number() over (partition by e.distance_metres, e.start_mode, e.activity order by min(e.recorded_at) desc) as recent
      from public.efforts e join public.training_sessions t on t.id=e.session_id
      where e.rider_id=p_rider_id and not e.is_test and e.outcome='completed'
      group by e.distance_metres, e.start_mode, e.activity, e.session_id, t.name) s
    where s.recent <= 100) p), '[]'::jsonb)
 );
end; $$;

commit;
