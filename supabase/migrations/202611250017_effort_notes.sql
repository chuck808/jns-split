-- Apply AFTER 202611250016_config_lock_race.sql. Additive.
--
-- Coach notes on efforts: one short shared note per effort (up to 280 characters).
--  * written, changed or cleared by anyone who can open the session: the club's
--    admins and the session's coaches; the last writer and time are kept;
--  * visible to the same people only, never to riders or families;
--  * notes are commentary, not results: the effort itself stays unchanged;
--  * notes can be added after a session is closed.
begin;

create table public.effort_notes (
  effort_id uuid primary key references public.efforts(id),
  club_id uuid not null references public.clubs(id),
  session_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create index effort_notes_session_idx on public.effort_notes(session_id);
alter table public.effort_notes enable row level security;
-- Read and written only through the checked functions.
revoke all on public.effort_notes from public, anon, authenticated;

-- An empty note clears it. Returns the saved text, or null when cleared.
create function public.set_effort_note(p_effort_id uuid, p_body text) returns text
language plpgsql security definer set search_path='' as $$
declare e public.efforts%rowtype; v_body text := btrim(coalesce(p_body, ''));
begin
 select * into e from public.efforts where id=p_effort_id;
 if not found or not private.session_access(e.session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if char_length(v_body) > 280 then raise exception 'Note too long' using errcode='22023'; end if;
 if v_body = '' then
   delete from public.effort_notes where effort_id=p_effort_id;
   return null;
 end if;
 insert into public.effort_notes(effort_id, club_id, session_id, body, updated_by)
   values (e.id, e.club_id, e.session_id, v_body, auth.uid())
   on conflict (effort_id) do update set body=excluded.body, updated_by=excluded.updated_by, updated_at=now();
 return v_body;
end; $$;

create or replace function public.session_results(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
  'total', (select count(*) from public.efforts where session_id=p_session_id)::int,
  'efforts', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at, e.id) from (
    select e.id, e.rider_id, e.rider_name, e.lane, e.outcome, e.elapsed_ms, e.is_test, e.recorded_at,
      e.distance_metres, e.start_mode,
      (select n.body from public.effort_notes n where n.effort_id=e.id) as note
    from public.efforts e where e.session_id=p_session_id order by e.recorded_at desc, e.id desc limit 500) e), '[]'::jsonb),
  'bests', coalesce((select jsonb_agg(to_jsonb(b) order by b.distance_metres, b.start_mode, b.best_ms, b.rider_name) from (
    select e.rider_id, (array_agg(e.rider_name order by e.recorded_at desc))[1] as rider_name,
      e.distance_metres, e.start_mode, min(e.elapsed_ms) as best_ms, count(*)::int as count
    from public.efforts e
    where e.session_id=p_session_id and not e.is_test and e.outcome='completed'
    group by e.rider_id, e.distance_metres, e.start_mode) b), '[]'::jsonb)
 );
end; $$;


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
        f.distance_metres, f.start_mode, f.new_best,
        (select n.body from public.effort_notes n where n.effort_id=f.id) as note
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


revoke all on function public.set_effort_note(uuid,text) from public, anon, authenticated;
grant execute on function public.set_effort_note(uuid,text) to authenticated;
commit;
