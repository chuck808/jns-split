-- Apply AFTER 202611250015_result_integrity.sql. Replaces one function; no data changes.
--
-- Closes a race in the configuration lock from migration 015. record_effort read
-- the session with a plain SELECT, which neither waits for nor blocks a session
-- edit. If an edit and the first upload overlapped, either could miss the other:
--  * edit first: the upload copied the OLD distance/start type, then the edit
--    committed new ones;
--  * upload first: the edit's "any efforts?" check couldn't see the upload's
--    uncommitted effort, so the edit went ahead.
-- The upload now takes a FOR SHARE lock on the session row. Session edits,
-- activity changes and closing take FOR UPDATE on the same row, so the two
-- always run one after the other:
--  * edit first: the upload waits, then reads and copies the edited settings;
--  * upload first: the edit waits, then sees the committed effort and is refused.
-- Uploads from several controllers to one session don't block each other.
begin;

create or replace function public.record_effort(p_device_id uuid, p_token text, p_result_id text, p_session_id uuid,
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
 -- FOR SHARE: waits for any in-progress session edit and blocks new ones until this
 -- upload commits. Together with the edit functions' FOR UPDATE and their check for
 -- existing efforts, an effort is always saved against settings that stay put.
 select * into s from public.training_sessions where id=p_session_id and club_id=d.club_id for share;
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


commit;
