-- Apply after 001–004. Participation is not a lane assignment or attendance record.
begin;
create table public.session_participants (
 session_id uuid not null,club_id uuid not null,rider_id uuid not null,
 added_by uuid not null references auth.users(id),added_at timestamptz not null default now(),
 primary key(session_id,rider_id),
 foreign key(session_id,club_id) references public.training_sessions(id,club_id),
 foreign key(rider_id,club_id) references public.riders(id,club_id)
);
create index session_participants_rider_idx on public.session_participants(rider_id);
alter table public.session_participants enable row level security;
create policy session_participants_read on public.session_participants for select to authenticated using(private.session_access(session_id));
revoke all on public.session_participants from public,anon,authenticated;
-- Minimal direct API fields; actor identity is retained for auditing, not exposed to coaches.
grant select(session_id,club_id,rider_id,added_at) on public.session_participants to authenticated;
alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed','session_rider_added','session_rider_removed'));

create function public.add_session_participant(p_session_id uuid,p_rider_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;v_rider public.riders%rowtype;
begin
 select * into v from public.training_sessions where id=p_session_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
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

create function public.remove_session_participant(p_session_id uuid,p_rider_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_session_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
 if v.status<>'planned' then raise exception 'Session is closed' using errcode='22023';end if;
 if not exists(select 1 from public.session_participants where session_id=p_session_id and rider_id=p_rider_id) then return;end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001';end if;
 delete from public.session_participants where session_id=p_session_id and rider_id=p_rider_id;
 update public.training_sessions set version=version+1 where id=p_session_id;
 insert into public.club_audit(club_id,actor_id,rider_id,session_id,action) values(v.club_id,auth.uid(),p_rider_id,p_session_id,'session_rider_removed');
end; $$;

create function public.list_session_participants(p_session_id uuid,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_page integer;v_items jsonb;
begin
 if not private.session_access(p_session_id) then raise exception 'Access denied' using errcode='42501';end if;
 select count(*) into v_total from public.session_participants where session_id=p_session_id;
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into v_items from (
  select r.id,r.display_name,(r.archived_at is not null) as archived from public.session_participants sp join public.riders r on r.id=sp.rider_id and r.club_id=sp.club_id
  where sp.session_id=p_session_id order by lower(r.display_name),r.id limit 25 offset (v_page-1)*25
 ) p;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pages',greatest(1,(v_total+24)/25));
end; $$;

create function public.session_participant_candidates(p_session_id uuid,p_query text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.training_sessions%rowtype;v_query text:=lower(btrim(coalesce(p_query,'')));v_total integer;v_page integer;v_items jsonb;
begin
 select * into v from public.training_sessions where id=p_session_id;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501';end if;
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
revoke all on function public.add_session_participant(uuid,uuid,integer),public.remove_session_participant(uuid,uuid,integer),public.list_session_participants(uuid,integer),public.session_participant_candidates(uuid,text,integer) from public,anon;
grant execute on function public.add_session_participant(uuid,uuid,integer),public.remove_session_participant(uuid,uuid,integer),public.list_session_participants(uuid,integer),public.session_participant_candidates(uuid,text,integer) to authenticated;
commit;
