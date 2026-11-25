-- Apply AFTER 202611250019_effort_corrections.sql.
--
-- Families' data rights (UK GDPR: access, portability, erasure). The club is
-- responsible for its riders' data, so:
--  * a linked rider or guardian can download what the app already shows them;
--  * a club admin can produce a full export for a formal subject access request,
--    to review before releasing (it includes coach notes, correction reasons and
--    who has access);
--  * a linked rider or guardian can ASK for erasure; a club admin confirms it
--    (typing the rider's name) or declines with a reason;
--  * erasure deletes the rider's results and everything personal about them, and
--    scrubs the rider record to "Removed rider". Results measured on the rider's
--    tag but moved to another rider stay with that rider, with the name copy
--    scrubbed. Club history keeps only an internal ID.
begin;

alter table public.riders add column erased_at timestamptz;
comment on column public.riders.erased_at is 'Set when the rider''s personal data was erased; the row stays as "Removed rider" for club history.';

create table public.rider_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  rider_id uuid not null,
  requested_by uuid not null references auth.users(id),
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending','completed','declined')),
  decline_reason text check (decline_reason is null or char_length(btrim(decline_reason)) between 1 and 500),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (rider_id, club_id) references public.riders(id, club_id)
);
create unique index rider_erasure_pending_idx on public.rider_erasure_requests(rider_id) where status='pending';
create index rider_erasure_club_idx on public.rider_erasure_requests(club_id, created_at) where status='pending';
alter table public.rider_erasure_requests enable row level security;
revoke all on public.rider_erasure_requests from public, anon, authenticated;

alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed','session_rider_added','session_rider_removed','rider_updated','rider_settings_updated','rider_field_saved','rider_field_removed',
  'rider_access_invited','rider_invitation_renewed','rider_invitation_revoked','rider_invitation_accepted','rider_invitation_declined','rider_link_removed','rider_scoreboard_name_set','rider_correction_requested','rider_correction_resolved',
  'timing_device_created','timing_device_revoked','effort_corrected',
  'rider_data_exported','rider_erasure_requested','rider_erasure_declined','rider_erased'));

-- The family's own download: what the app already shows them, as data.
create function public.my_rider_export(p_rider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.riders%rowtype; v_club text;
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select * into r from public.riders where id=p_rider_id;
 select name into v_club from public.clubs where id=r.club_id;
 return jsonb_build_object(
  'format', 'JNS SPLIT rider data, version 1',
  'generated_at', now(),
  'about', 'What JNS SPLIT shows you about this rider. For anything else the club holds, ask the club for a full copy.',
  'rider', jsonb_build_object('name', r.display_name, 'club', v_club, 'birth_year', r.birth_year, 'birth_date', r.birth_date,
     'scoreboard_name', r.scoreboard_name, 'registered_at', r.created_at,
     'has_active_tag', exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null),
     'club_details', coalesce((select jsonb_agg(jsonb_build_object('label', f.label, 'value', v.value) order by f.created_at, f.id)
       from public.rider_field_values v join public.club_rider_fields f on f.id=v.field_id and f.archived_at is null
       where v.rider_id=r.id), '[]'::jsonb)),
  'your_access', (select jsonb_build_object('kind', l.kind, 'since', l.created_at) from public.rider_links l
     where l.rider_id=r.id and l.user_id=auth.uid() and l.removed_at is null),
  'results', coalesce((select jsonb_agg(jsonb_build_object('recorded_at', e.recorded_at, 'session', t.name,
       'distance_metres', e.distance_metres, 'start_type', e.start_mode, 'activity', e.activity, 'lane', e.lane,
       'outcome', e.outcome, 'elapsed_ms', e.elapsed_ms) order by e.recorded_at, e.id)
     from private.efforts_effective e join public.training_sessions t on t.id=e.session_id
     where e.rider_id=r.id and not e.is_test), '[]'::jsonb),
  'your_correction_requests', coalesce((select jsonb_agg(jsonb_build_object('message', c.message, 'sent_at', c.created_at,
       'dealt_with', c.resolved_at is not null) order by c.created_at)
     from public.rider_correction_requests c where c.rider_id=r.id and c.requested_by=auth.uid()), '[]'::jsonb)
 );
end; $$;

-- The club's full export for a formal request. Review before releasing: it names coaches,
-- includes their notes and reasons, and lists everyone with access.
create function public.admin_rider_export(p_rider_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.riders%rowtype; v_club text;
begin
 select * into r from public.riders where id=p_rider_id;
 if not found or not private.is_club_admin(r.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select name into v_club from public.clubs where id=r.club_id;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (r.club_id, auth.uid(), r.id, 'rider_data_exported');
 return jsonb_build_object(
  'format', 'JNS SPLIT full rider record, version 1',
  'generated_at', now(),
  'review_before_release', 'This export names coaches and includes their notes and correction reasons. Check it, and remove anything you are entitled to withhold, before sending it to the family.',
  'rider', jsonb_build_object('id', r.id, 'name', r.display_name, 'club', v_club, 'birth_year', r.birth_year,
     'birth_date', r.birth_date, 'scoreboard_name', r.scoreboard_name, 'registered_at', r.created_at,
     'archived_at', r.archived_at, 'erased_at', r.erased_at),
  'club_details', coalesce((select jsonb_agg(jsonb_build_object('label', f.label, 'value', v.value, 'field_archived', f.archived_at is not null) order by f.created_at, f.id)
     from public.rider_field_values v join public.club_rider_fields f on f.id=v.field_id where v.rider_id=r.id), '[]'::jsonb),
  'tags', coalesce((select jsonb_agg(jsonb_build_object('uid', t.uid, 'assigned_at', t.assigned_at, 'revoked_at', t.revoked_at) order by t.assigned_at)
     from public.tag_assignments t where t.rider_id=r.id), '[]'::jsonb),
  'sessions', coalesce((select jsonb_agg(jsonb_build_object('session', t.name, 'scheduled_at', t.scheduled_at, 'status', t.status) order by t.created_at)
     from public.session_participants p join public.training_sessions t on t.id=p.session_id where p.rider_id=r.id), '[]'::jsonb),
  'results', coalesce((select jsonb_agg(jsonb_build_object('recorded_at', e.recorded_at, 'session', t.name, 'distance_metres', e.distance_metres,
       'start_type', e.start_mode, 'activity', e.activity, 'lane', e.lane, 'outcome', e.outcome, 'elapsed_ms', e.elapsed_ms,
       'demo', e.is_test, 'measured_on_this_riders_tag', e.original_rider_id=r.id, 'correction_reason', e.correction_reason,
       'coach_note', (select n.body from public.effort_notes n where n.effort_id=e.id)) order by e.recorded_at, e.id)
     from private.efforts_effective e join public.training_sessions t on t.id=e.session_id
     where e.rider_id=r.id or e.original_rider_id=r.id), '[]'::jsonb),
  'corrections', coalesce((select jsonb_agg(jsonb_build_object('recorded_at', e.recorded_at, 'invalid', c.invalid, 'moved_to', c.rider_name,
       'reason', c.reason, 'by', u.email, 'at', c.created_at) order by c.seq)
     from public.effort_corrections c join public.efforts e on e.id=c.effort_id join auth.users u on u.id=c.created_by
     where e.rider_id=r.id or c.rider_id=r.id), '[]'::jsonb),
  'access', coalesce((select jsonb_agg(jsonb_build_object('email', u.email, 'kind', l.kind, 'linked_at', l.created_at, 'removed_at', l.removed_at) order by l.created_at)
     from public.rider_links l join auth.users u on u.id=l.user_id where l.rider_id=r.id), '[]'::jsonb),
  'invitations', coalesce((select jsonb_agg(jsonb_build_object('email', i.email, 'kind', i.kind, 'status', i.status, 'created_at', i.created_at) order by i.created_at)
     from public.rider_invitations i where i.rider_id=r.id), '[]'::jsonb),
  'correction_requests', coalesce((select jsonb_agg(jsonb_build_object('message', c.message, 'from', u.email, 'at', c.created_at, 'resolved_at', c.resolved_at) order by c.created_at)
     from public.rider_correction_requests c join auth.users u on u.id=c.requested_by where c.rider_id=r.id), '[]'::jsonb),
  'erasure_requests', coalesce((select jsonb_agg(jsonb_build_object('status', q.status, 'message', q.message, 'from', u.email, 'at', q.created_at, 'decline_reason', q.decline_reason) order by q.created_at)
     from public.rider_erasure_requests q join auth.users u on u.id=q.requested_by where q.rider_id=r.id), '[]'::jsonb),
  'history', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'at', a.created_at, 'by', u.email) order by a.created_at)
     from public.club_audit a join auth.users u on u.id=a.actor_id where a.rider_id=r.id), '[]'::jsonb)
 );
end; $$;

create function public.request_rider_erasure(p_rider_id uuid, p_message text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_id uuid; v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if char_length(coalesce(v_message, '')) > 500 then raise exception 'Message too long' using errcode='22023'; end if;
 select club_id into v_club from public.riders where id=p_rider_id;
 perform 1 from public.riders where id=p_rider_id for update;
 if exists(select 1 from public.rider_erasure_requests where rider_id=p_rider_id and status='pending') then
   raise exception 'Already requested' using errcode='23505';
 end if;
 insert into public.rider_erasure_requests(club_id, rider_id, requested_by, message)
   values (v_club, p_rider_id, auth.uid(), v_message) returning id into v_id;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (v_club, auth.uid(), p_rider_id, 'rider_erasure_requested');
 return v_id;
end; $$;

-- For the family: the state of their latest request for this rider.
create function public.my_erasure_request(p_rider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_rider_link(p_rider_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return (select jsonb_build_object('status', q.status, 'created_at', q.created_at, 'decline_reason', q.decline_reason)
   from public.rider_erasure_requests q where q.rider_id=p_rider_id order by q.created_at desc limit 1);
end; $$;

create function public.club_erasure_requests(p_club_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from (
   select q.id, q.rider_id, r.display_name, q.message, q.created_at, u.email as requested_by
   from public.rider_erasure_requests q join public.riders r on r.id=q.rider_id join auth.users u on u.id=q.requested_by
   where q.club_id=p_club_id and q.status='pending') q), '[]'::jsonb);
end; $$;

create function public.decline_rider_erasure(p_request_id uuid, p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare q public.rider_erasure_requests%rowtype; v_reason text := btrim(coalesce(p_reason, ''));
begin
 select * into q from public.rider_erasure_requests where id=p_request_id;
 if not found or not private.is_club_admin(q.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if char_length(v_reason) not between 1 and 500 then raise exception 'Give the reason' using errcode='22023'; end if;
 update public.rider_erasure_requests set status='declined', decline_reason=v_reason, handled_by=auth.uid(), handled_at=now()
   where id=p_request_id and status='pending';
 if not found then raise exception 'Request already handled' using errcode='22023'; end if;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (q.club_id, auth.uid(), q.rider_id, 'rider_erasure_declined');
end; $$;

-- Free text elsewhere in the club that mentions the rider's name: notes and
-- reasons on OTHER riders' results, and requests about other riders. Erasure
-- can't safely rewrite these, so the admin reviews them before erasing.
create function public.erasure_mentions(p_rider_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.riders%rowtype; v_terms text[];
begin
 select * into r from public.riders where id=p_rider_id;
 if not found or not private.is_club_admin(r.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 -- The full name and each part of it of three letters or more.
 select array_agg(distinct t) into v_terms from (
   select r.display_name as t union
   select part from regexp_split_to_table(r.display_name, '[[:space:]]+') part where char_length(part) >= 3) x;
 return coalesce((select jsonb_agg(to_jsonb(m) order by m.at) from (
   select 'note' as kind, n.body as text, t.name as session, e.rider_name as about, n.updated_at as at
   from public.effort_notes n join private.efforts_effective e on e.id=n.effort_id join public.training_sessions t on t.id=e.session_id
   where e.club_id=r.club_id and e.rider_id<>p_rider_id and e.original_rider_id<>p_rider_id
     and exists(select 1 from unnest(v_terms) w where n.body ilike '%' || w || '%')
   union all
   select 'correction reason', c.reason, t.name, e.rider_name, c.created_at
   from public.effort_corrections c join public.efforts e on e.id=c.effort_id join public.training_sessions t on t.id=e.session_id
   where c.club_id=r.club_id and e.rider_id<>p_rider_id
     and e.id not in (select id from private.efforts_effective where rider_id=p_rider_id)
     and exists(select 1 from unnest(v_terms) w where c.reason ilike '%' || w || '%')
   union all
   select 'correction request', q.message, null, x.display_name, q.created_at
   from public.rider_correction_requests q join public.riders x on x.id=q.rider_id
   where q.club_id=r.club_id and q.rider_id<>p_rider_id
     and exists(select 1 from unnest(v_terms) w where q.message ilike '%' || w || '%')) m), '[]'::jsonb);
end; $$;

-- Erases a rider. p_confirm_name must match the rider's current name exactly.
create function public.erase_rider(p_rider_id uuid, p_confirm_name text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.riders%rowtype; v_mine uuid[]; v_uids text[];
begin
 select * into r from public.riders where id=p_rider_id;
 if not found or not private.is_club_admin(r.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if r.erased_at is not null then raise exception 'Already erased' using errcode='22023'; end if;
 if p_confirm_name is null or btrim(p_confirm_name) <> r.display_name then raise exception 'Name does not match' using errcode='22023'; end if;
 perform 1 from public.clubs where id=r.club_id for update;
 perform 1 from public.riders where id=p_rider_id for update;

 -- Results that are this rider's now (including ones moved to them), and their notes and corrections.
 select coalesce(array_agg(id), '{}') into v_mine from private.efforts_effective where rider_id=p_rider_id;
 delete from public.effort_notes where effort_id = any(v_mine);
 delete from public.effort_corrections where effort_id = any(v_mine);
 delete from public.efforts where id = any(v_mine);
 -- Results measured on this rider's tag but moved to someone else stay with that rider: scrub the name copy.
 update public.efforts set rider_name='Removed rider' where rider_id=p_rider_id;
 update public.effort_corrections set rider_name='Removed rider' where rider_id=p_rider_id;
 -- Reasons on corrections to efforts measured on this rider's tag are about this rider.
 update public.effort_corrections set reason='Reason removed when a rider''s data was erased'
   where effort_id in (select id from public.efforts where rider_id=p_rider_id);

 -- Test-lane state and simulator replay records that hold the rider or their tag.
 select coalesce(array_agg(uid), '{}') into v_uids from public.tag_assignments where rider_id=p_rider_id;
 delete from private.bench_lanes where rider_id=p_rider_id;
 delete from private.bench_requests b where exists(select 1 from unnest(v_uids) u where b.fingerprint like '%' || u || '%');
 update public.tag_assignments set revoked_at=now() where rider_id=p_rider_id and revoked_at is null;

 -- Family access, invitations (with their email addresses) and requests.
 delete from public.rider_links where rider_id=p_rider_id;
 delete from public.rider_invitations where rider_id=p_rider_id;
 delete from public.rider_correction_requests where rider_id=p_rider_id;
 update public.rider_erasure_requests set status='completed', message=null, handled_by=auth.uid(), handled_at=now()
   where rider_id=p_rider_id and status='pending';
 update public.rider_erasure_requests set message=null where rider_id=p_rider_id;

 -- Club details and session lists.
 delete from public.rider_field_values where rider_id=p_rider_id;
 delete from public.session_participants where rider_id=p_rider_id;

 update public.riders set display_name='Removed rider', birth_year=null, birth_date=null, scoreboard_name=null,
   archived_at=coalesce(archived_at, now()), erased_at=now() where id=p_rider_id;
 insert into public.club_audit(club_id, actor_id, rider_id, action) values (r.club_id, auth.uid(), p_rider_id, 'rider_erased');
end; $$;

revoke all on function public.my_rider_export(uuid), public.admin_rider_export(uuid), public.request_rider_erasure(uuid,text),
  public.my_erasure_request(uuid), public.club_erasure_requests(uuid), public.decline_rider_erasure(uuid,text), public.erase_rider(uuid,text),
  public.erasure_mentions(uuid)
  from public, anon, authenticated;
grant execute on function public.my_rider_export(uuid), public.admin_rider_export(uuid), public.request_rider_erasure(uuid,text),
  public.my_erasure_request(uuid), public.club_erasure_requests(uuid), public.decline_rider_erasure(uuid,text), public.erase_rider(uuid,text),
  public.erasure_mentions(uuid)
  to authenticated;
commit;
