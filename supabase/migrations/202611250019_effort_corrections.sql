-- Apply AFTER 202611250018_rider_progress.sql. Additive: no effort is changed.
--
-- Result corrections. A saved effort stays exactly as measured; a correction is
-- a separate, append-only record on top of it:
--  * invalid  — e.g. a false start: kept and shown, never counted;
--  * move     — a tag mix-up: the effort belongs to another rider who was in
--               that session (on its list, or who rode in it);
--  * restore  — back to the original.
-- Each record holds the full resulting state, who made it, when and why, so the
-- latest one is the current state and the rest are the history.
-- Session coaches and club admins can correct; corrections are allowed after a
-- session closes. Every results screen, best, new-best mark and progress chart
-- reads the corrected view. Families see "invalid" but never the reason.
begin;

create table public.effort_corrections (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  effort_id uuid not null references public.efforts(id),
  club_id uuid not null references public.clubs(id),
  invalid boolean not null,
  rider_id uuid,
  rider_name text,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((rider_id is null) = (rider_name is null)),
  foreign key (rider_id, club_id) references public.riders(id, club_id)
);
create index effort_corrections_effort_idx on public.effort_corrections(effort_id, seq desc);
alter table public.effort_corrections enable row level security;
revoke all on public.effort_corrections from public, anon, authenticated;

alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed','session_rider_added','session_rider_removed','rider_updated','rider_settings_updated','rider_field_saved','rider_field_removed',
  'rider_access_invited','rider_invitation_renewed','rider_invitation_revoked','rider_invitation_accepted','rider_invitation_declined','rider_link_removed','rider_scoreboard_name_set','rider_correction_requested','rider_correction_resolved',
  'timing_device_created','timing_device_revoked','effort_corrected'));

-- Efforts as they currently stand: the original, with its latest correction applied.
create view private.efforts_effective as
select e.id, e.club_id, e.session_id,
  coalesce(c.rider_id, e.rider_id) as rider_id,
  coalesce(c.rider_name, e.rider_name) as rider_name,
  e.device_id, e.is_test, e.lane,
  case when coalesce(c.invalid, false) then 'invalid' else e.outcome end as outcome,
  e.elapsed_ms, e.distance_metres, e.start_mode, e.activity, e.recorded_at,
  coalesce(c.invalid or c.rider_id is not null, false) as corrected,
  case when c.invalid or c.rider_id is not null then c.reason end as correction_reason,
  case when c.rider_id is not null then e.rider_name end as original_rider_name,
  e.rider_id as original_rider_id,
  coalesce(c.invalid, false) as marked_invalid,
  c.rider_id as moved_to
from public.efforts e
left join lateral (
  select x.invalid, x.rider_id, x.rider_name, x.reason from public.effort_corrections x
  where x.effort_id=e.id order by x.seq desc limit 1) c on true;
revoke all on private.efforts_effective from public, anon, authenticated;

-- p_action: 'invalid' (reason needed), 'move' (rider and reason needed) or 'restore'.
create function public.correct_effort(p_effort_id uuid, p_action text, p_rider_id uuid, p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.efforts%rowtype; cur private.efforts_effective%rowtype; v_reason text := btrim(coalesce(p_reason, ''));
  v_invalid boolean; v_rider uuid; v_name text;
begin
 select * into e from public.efforts where id=p_effort_id;
 if not found or not private.session_access(e.session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 -- One correction at a time per effort.
 perform 1 from public.efforts where id=p_effort_id for update;
 select * into cur from private.efforts_effective where id=p_effort_id;
 if p_action is null or p_action not in ('invalid','move','restore') or char_length(v_reason) > 200 then
   raise exception 'Invalid correction' using errcode='22023';
 end if;
 if p_action='restore' then
   if not cur.corrected then raise exception 'Nothing to restore' using errcode='22023'; end if;
   v_invalid := false; v_rider := null; v_name := null;
   if v_reason='' then v_reason := 'Restored to the original'; end if;
 elsif v_reason='' then
   raise exception 'Give a reason' using errcode='22023';
 elsif p_action='invalid' then
   if cur.marked_invalid then raise exception 'Already invalid' using errcode='22023'; end if;
   v_invalid := true; v_rider := cur.moved_to; v_name := case when cur.moved_to is not null then cur.rider_name end;
 else
   if p_rider_id is null or p_rider_id=cur.rider_id then raise exception 'Choose a different rider' using errcode='22023'; end if;
   -- Only a rider who was in this session: on its list, or recorded in it.
   select r.display_name into v_name from public.riders r
     where r.id=p_rider_id and r.club_id=e.club_id and r.archived_at is null
       and (exists(select 1 from public.session_participants p where p.session_id=e.session_id and p.rider_id=r.id)
         or exists(select 1 from public.efforts x where x.session_id=e.session_id and x.rider_id=r.id));
   if v_name is null then raise exception 'Rider not in this session' using errcode='23514'; end if;
   v_invalid := cur.marked_invalid;
   -- Moving back to the measured rider just clears the move.
   if p_rider_id=e.rider_id then v_rider := null; v_name := null; else v_rider := p_rider_id; end if;
 end if;
 insert into public.effort_corrections(effort_id, club_id, invalid, rider_id, rider_name, reason, created_by)
   values (e.id, e.club_id, v_invalid, v_rider, v_name, v_reason, auth.uid());
 insert into public.club_audit(club_id, actor_id, session_id, rider_id, action)
   values (e.club_id, auth.uid(), e.session_id, e.rider_id, 'effort_corrected');
end; $$;

-- Riders an effort can be moved to: the same rule correct_effort enforces.
create function public.effort_move_candidates(p_effort_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.efforts%rowtype; v_current uuid;
begin
 select * into e from public.efforts where id=p_effort_id;
 if not found or not private.session_access(e.session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select rider_id into v_current from private.efforts_effective where id=p_effort_id;
 return coalesce((select jsonb_agg(jsonb_build_object('rider_id', r.id, 'display_name', r.display_name) order by lower(r.display_name), r.id)
   from public.riders r
   where r.club_id=e.club_id and r.archived_at is null and r.id<>v_current
     and (exists(select 1 from public.session_participants p where p.session_id=e.session_id and p.rider_id=r.id)
       or exists(select 1 from public.efforts x where x.session_id=e.session_id and x.rider_id=r.id))), '[]'::jsonb);
end; $$;

-- The history of one effort's corrections, for the people who can make them.
create function public.effort_correction_history(p_effort_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_session uuid;
begin
 select session_id into v_session from public.efforts where id=p_effort_id;
 if v_session is null or not private.session_access(v_session) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(h) order by h.seq) from (
   select c.seq, c.invalid, c.rider_name, c.reason, c.created_at, u.email as by_email
   from public.effort_corrections c join auth.users u on u.id=c.created_by
   where c.effort_id=p_effort_id) h), '[]'::jsonb);
end; $$;

create or replace function public.session_results(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
  'total', (select count(*) from private.efforts_effective where session_id=p_session_id)::int,
  'efforts', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at, e.id) from (
    select e.id, e.rider_id, e.rider_name, e.lane, e.outcome, e.elapsed_ms, e.is_test, e.recorded_at,
      e.distance_metres, e.start_mode, e.corrected, e.correction_reason, e.original_rider_name,
      (select n.body from public.effort_notes n where n.effort_id=e.id) as note
    from private.efforts_effective e where e.session_id=p_session_id order by e.recorded_at desc, e.id desc limit 500) e), '[]'::jsonb),
  'bests', coalesce((select jsonb_agg(to_jsonb(b) order by b.distance_metres, b.start_mode, b.best_ms, b.rider_name) from (
    select e.rider_id, (array_agg(e.rider_name order by e.recorded_at desc))[1] as rider_name,
      e.distance_metres, e.start_mode, min(e.elapsed_ms) as best_ms, count(*)::int as count
    from private.efforts_effective e
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
 select coalesce(min(recorded_at), now()) into v_since from private.efforts_effective where session_id=p_session_id;
 return (
  with previous as (
    select e.rider_id, min(e.elapsed_ms) as best_ms from private.efforts_effective e
    where e.rider_id in (select rider_id from private.efforts_effective where session_id=p_session_id
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
    from private.efforts_effective e where e.session_id=p_session_id),
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
        f.distance_metres, f.start_mode, f.new_best, f.corrected, f.correction_reason, f.original_rider_name,
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


create or replace function public.rider_results(p_rider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return jsonb_build_object(
  'efforts', coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at desc, e.id desc) from (
    select e.id, e.recorded_at, t.name as session_name, e.distance_metres, e.start_mode, e.activity, e.outcome, e.elapsed_ms
    from private.efforts_effective e join public.training_sessions t on t.id=e.session_id
    where e.rider_id=p_rider_id and not e.is_test order by e.recorded_at desc, e.id desc limit 200) e), '[]'::jsonb),
  'groups', coalesce((select jsonb_agg(to_jsonb(g) order by g.latest_at desc) from (
    select e.distance_metres, e.start_mode, e.activity, min(e.elapsed_ms) as best_ms, count(*)::int as valid_count, max(e.recorded_at) as latest_at
    from private.efforts_effective e where e.rider_id=p_rider_id and not e.is_test and e.outcome='completed'
    group by e.distance_metres, e.start_mode, e.activity) g), '[]'::jsonb),
  'progress', coalesce((select jsonb_agg(to_jsonb(p) order by p.distance_metres, p.start_mode, p.activity, p.day) from (
    select * from (
      select e.distance_metres, e.start_mode, e.activity, e.session_id, t.name as session_name,
        min(e.recorded_at) as day, min(e.elapsed_ms) as best_ms, count(*)::int as count,
        row_number() over (partition by e.distance_metres, e.start_mode, e.activity order by min(e.recorded_at) desc) as recent
      from private.efforts_effective e join public.training_sessions t on t.id=e.session_id
      where e.rider_id=p_rider_id and not e.is_test and e.outcome='completed'
      group by e.distance_metres, e.start_mode, e.activity, e.session_id, t.name) s
    where s.recent <= 100) p), '[]'::jsonb)
 );
end; $$;


revoke all on function public.correct_effort(uuid,text,uuid,text), public.effort_correction_history(uuid), public.effort_move_candidates(uuid) from public, anon, authenticated;
grant execute on function public.correct_effort(uuid,text,uuid,text), public.effort_correction_history(uuid), public.effort_move_candidates(uuid) to authenticated;
commit;
