-- Apply after migrations 001–005. This stores planning policy, not live lane state.
begin;
alter table public.training_sessions add column activity text not null default 'coached'
 check(activity in ('coached','free_ride'));

create function public.set_session_activity(p_id uuid,p_version integer,p_activity text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if v.status<>'planned' or p_activity is null or p_activity not in ('coached','free_ride') then raise exception 'Invalid activity or closed session' using errcode='22023';end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001';end if;
 if v.activity=p_activity then return;end if;
 if exists(select 1 from public.session_participants where session_id=p_id) then raise exception 'Remove planned participants before changing activity' using errcode='22023';end if;
 update public.training_sessions set activity=p_activity,version=version+1 where id=p_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(v.club_id,auth.uid(),p_id,'session_updated');
end; $$;

create function public.create_session_plan(p_club_id uuid,p_name text,p_scheduled_at timestamptz,p_distance numeric,p_mode text,p_lanes integer,p_activity text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_activity is null or p_activity not in ('coached','free_ride') then raise exception 'Invalid activity' using errcode='22023';end if;
 perform private.validate_session(p_name,p_distance,p_mode,p_lanes);
 insert into public.training_sessions(club_id,name,scheduled_at,distance_metres,start_mode,lane_count,created_by,activity) values(p_club_id,btrim(p_name),p_scheduled_at,p_distance,p_mode,p_lanes,auth.uid(),p_activity) returning id into v_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(p_club_id,auth.uid(),v_id,'session_created');return v_id;
end; $$;

create or replace function public.add_session_participant(p_session_id uuid,p_rider_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;v_rider public.riders%rowtype;
begin
 select * into v from public.training_sessions where id=p_session_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if v.activity='free_ride' then raise exception 'Free ride does not use manual enrolment' using errcode='22023';end if;
 if v.status<>'planned' then raise exception 'Session is closed' using errcode='22023';end if;
 -- Lock alongside archival so an already archived rider cannot be newly enrolled.
 select * into v_rider from public.riders where id=p_rider_id and club_id=v.club_id for update;
 if not found then raise exception 'Rider unavailable' using errcode='22023';end if;
 -- A repeated request for an existing participant is a no-op, never another entry/audit event.
 if exists(select 1 from public.session_participants where session_id=p_session_id and rider_id=p_rider_id) then return;end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001';end if;
 if v_rider.archived_at is not null then raise exception 'Rider archived' using errcode='22023';end if;
 insert into public.session_participants(session_id,club_id,rider_id,added_by) values(p_session_id,v.club_id,p_rider_id,auth.uid());
 update public.training_sessions set version=version+1 where id=p_session_id;
 insert into public.club_audit(club_id,actor_id,rider_id,session_id,action) values(v.club_id,auth.uid(),p_rider_id,p_session_id,'session_rider_added');
end; $$;

create or replace function public.remove_session_participant(p_session_id uuid,p_rider_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_session_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if v.activity='free_ride' then raise exception 'Free ride does not use manual enrolment' using errcode='22023';end if;
 if v.status<>'planned' then raise exception 'Session is closed' using errcode='22023';end if;
 if not exists(select 1 from public.session_participants where session_id=p_session_id and rider_id=p_rider_id) then return;end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001';end if;
 delete from public.session_participants where session_id=p_session_id and rider_id=p_rider_id;
 update public.training_sessions set version=version+1 where id=p_session_id;
 insert into public.club_audit(club_id,actor_id,rider_id,session_id,action) values(v.club_id,auth.uid(),p_rider_id,p_session_id,'session_rider_removed');
end; $$;

create or replace function public.session_participant_candidates(p_session_id uuid,p_query text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.training_sessions%rowtype;v_query text:=lower(btrim(coalesce(p_query,'')));v_total integer;v_page integer;v_items jsonb;
begin
 select * into v from public.training_sessions where id=p_session_id;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if v.activity='free_ride' then raise exception 'Free ride does not use manual enrolment' using errcode='22023';end if;
 if v.status<>'planned' or char_length(v_query)>60 then raise exception 'Session is closed or filter invalid' using errcode='22023';end if;
 select count(*) into v_total from public.riders r where r.club_id=v.club_id and r.archived_at is null and (v_query='' or strpos(lower(r.display_name),v_query)>0)
 and not exists(select 1 from public.session_participants sp where sp.session_id=p_session_id and sp.rider_id=r.id);
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into v_items from (
 select r.id,r.display_name from public.riders r where r.club_id=v.club_id and r.archived_at is null and (v_query='' or strpos(lower(r.display_name),v_query)>0)
 and not exists(select 1 from public.session_participants sp where sp.session_id=p_session_id and sp.rider_id=r.id)
 order by lower(r.display_name),r.id limit 25 offset (v_page-1)*25
 ) p;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pages',greatest(1,(v_total+24)/25));
end; $$;

revoke all on function public.set_session_activity(uuid,integer,text),public.create_session_plan(uuid,text,timestamptz,numeric,text,integer,text) from public,anon;
grant execute on function public.set_session_activity(uuid,integer,text),public.create_session_plan(uuid,text,timestamptz,numeric,text,integer,text) to authenticated;
commit;
