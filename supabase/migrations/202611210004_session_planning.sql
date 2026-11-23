-- Session planning only. No measured results or hardware control.
begin;
create table public.training_sessions (
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),
 name text not null check(char_length(btrim(name)) between 1 and 100),
 scheduled_at timestamptz check(scheduled_at is null or (scheduled_at>='0001-01-01 00:00:00+00'::timestamptz and scheduled_at<='9999-12-31 23:59:59+00'::timestamptz)),
 distance_metres numeric not null check(distance_metres>0 and distance_metres<=10000),
 start_mode text not null check(start_mode in ('standing','flying')),
 lane_count integer not null check(lane_count between 1 and 4),
 status text not null default 'planned' check(status in ('planned','closed','cancelled')),
 version integer not null default 1,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(id,club_id)
);
create index training_sessions_club_idx on public.training_sessions(club_id,created_at desc);
create table public.session_coaches (
 session_id uuid not null,club_id uuid not null,coach_user_id uuid not null,can_manage boolean not null default false,
 assigned_by uuid not null references auth.users(id),assigned_at timestamptz not null default now(),
 primary key(session_id,coach_user_id),
 foreign key(session_id,club_id) references public.training_sessions(id,club_id),
 foreign key(club_id,coach_user_id) references public.club_memberships(club_id,user_id) on delete cascade
);
create index session_coaches_user_idx on public.session_coaches(coach_user_id,session_id);
alter table public.club_audit add column session_id uuid references public.training_sessions(id);
alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed'));

create function private.session_access(p_id uuid,p_edit boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.training_sessions s where s.id=p_id and
 (private.is_club_admin(s.club_id) or exists(select 1 from public.session_coaches g join public.club_memberships m on m.club_id=g.club_id and m.user_id=g.coach_user_id where g.session_id=s.id and g.coach_user_id=auth.uid() and m.role='coach' and (not p_edit or g.can_manage))));
$$;
revoke all on function private.session_access(uuid,boolean) from public,anon;
grant execute on function private.session_access(uuid,boolean) to authenticated;
alter table public.training_sessions enable row level security;
alter table public.session_coaches enable row level security;
create policy session_read on public.training_sessions for select to authenticated using(private.session_access(id));
create policy session_coach_read on public.session_coaches for select to authenticated using(private.is_club_admin(club_id) or (coach_user_id=auth.uid() and private.session_access(session_id)));
revoke all on public.training_sessions,public.session_coaches from public,anon,authenticated;
grant select on public.training_sessions,public.session_coaches to authenticated;

create function private.validate_session(p_name text,p_distance numeric,p_mode text,p_lanes integer) returns void
language plpgsql set search_path='' as $$
begin
 if p_name is null or char_length(btrim(p_name)) not between 1 and 100 or p_distance is null or not(p_distance>0 and p_distance<=10000) or p_mode is null or p_mode not in ('standing','flying') or p_lanes is null or p_lanes not between 1 and 4 then raise exception 'Invalid session configuration' using errcode='22023'; end if;
end; $$;
revoke all on function private.validate_session(text,numeric,text,integer) from public,anon,authenticated;

create function public.create_training_session(p_club_id uuid,p_name text,p_scheduled_at timestamptz,p_distance numeric,p_mode text,p_lanes integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 perform private.validate_session(p_name,p_distance,p_mode,p_lanes);
 insert into public.training_sessions(club_id,name,scheduled_at,distance_metres,start_mode,lane_count,created_by) values(p_club_id,btrim(p_name),p_scheduled_at,p_distance,p_mode,p_lanes,auth.uid()) returning id into v_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(p_club_id,auth.uid(),v_id,'session_created');return v_id;
end; $$;

create function public.update_training_session(p_id uuid,p_version integer,p_name text,p_scheduled_at timestamptz,p_distance numeric,p_mode text,p_lanes integer) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.session_access(p_id,true) then raise exception 'Access denied' using errcode='42501'; end if;
 if v.status<>'planned' then raise exception 'Session is closed' using errcode='22023'; end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001'; end if;
 perform private.validate_session(p_name,p_distance,p_mode,p_lanes);
 update public.training_sessions set name=btrim(p_name),scheduled_at=p_scheduled_at,distance_metres=p_distance,start_mode=p_mode,lane_count=p_lanes,version=version+1 where id=p_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(v.club_id,auth.uid(),p_id,'session_updated');
end; $$;

create function public.finish_training_session(p_id uuid,p_version integer,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.session_access(p_id,true) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_status is null or p_status not in ('closed','cancelled') or v.status<>'planned' then raise exception 'Invalid transition' using errcode='22023'; end if;
 if p_version is distinct from v.version then raise exception 'Session changed; refresh' using errcode='40001'; end if;
 update public.training_sessions set status=p_status,version=version+1 where id=p_id;
 insert into public.club_audit(club_id,actor_id,session_id,action) values(v.club_id,auth.uid(),p_id,'session_'||p_status);
end; $$;

create function public.assign_session_coach(p_id uuid,p_user_id uuid,p_can_manage boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v public.training_sessions%rowtype;
begin
 select * into v from public.training_sessions where id=p_id for update;
 if not found or not private.is_club_admin(v.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v.status<>'planned' or p_can_manage is null then raise exception 'Session is closed or grant invalid' using errcode='22023'; end if;
 -- FK and row lock prevent removal/re-invitation from reviving stale assignments.
 perform 1 from public.club_memberships where club_id=v.club_id and user_id=p_user_id and role='coach' for key share;
 if not found then raise exception 'Current approved coach required' using errcode='22023'; end if;
 insert into public.session_coaches(session_id,club_id,coach_user_id,can_manage,assigned_by) values(p_id,v.club_id,p_user_id,p_can_manage,auth.uid())
 on conflict(session_id,coach_user_id) do update set can_manage=excluded.can_manage,assigned_by=excluded.assigned_by,assigned_at=now();
 insert into public.club_audit(club_id,actor_id,target_user_id,session_id,action) values(v.club_id,auth.uid(),p_user_id,p_id,'session_coach_assigned');
end; $$;

create function public.remove_session_coach(p_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_club uuid;
begin
 select club_id into v_club from public.training_sessions where id=p_id for update;
 if not found or not private.is_club_admin(v_club) then raise exception 'Access denied' using errcode='42501'; end if;
 delete from public.session_coaches where session_id=p_id and coach_user_id=p_user_id;
 if found then insert into public.club_audit(club_id,actor_id,target_user_id,session_id,action) values(v_club,auth.uid(),p_user_id,p_id,'session_coach_removed');end if;
end; $$;

create function public.list_training_sessions(p_club_id uuid default null,p_status text default 'all',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_page integer;v_items jsonb;
begin
 if auth.uid() is null or (p_club_id is not null and not private.is_club_admin(p_club_id)) then raise exception 'Access denied' using errcode='42501';end if;
 if p_status is null or p_status not in ('all','planned','closed','cancelled') then raise exception 'Invalid filter' using errcode='22023';end if;
 select count(*) into v_total from public.training_sessions s where (p_status='all' or s.status=p_status) and
 ((p_club_id is not null and s.club_id=p_club_id) or (p_club_id is null and exists(select 1 from public.session_coaches g join public.club_memberships m on m.club_id=g.club_id and m.user_id=g.coach_user_id where g.session_id=s.id and g.coach_user_id=auth.uid() and m.role='coach')));
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_items from (
  select s.*,c.name as club_name from public.training_sessions s join public.clubs c on c.id=s.club_id where (p_status='all' or s.status=p_status) and
  ((p_club_id is not null and s.club_id=p_club_id) or (p_club_id is null and exists(select 1 from public.session_coaches g join public.club_memberships m on m.club_id=g.club_id and m.user_id=g.coach_user_id where g.session_id=s.id and g.coach_user_id=auth.uid() and m.role='coach')))
  order by s.scheduled_at desc nulls last,s.created_at desc,s.id limit 25 offset (v_page-1)*25
 ) r;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pages',greatest(1,(v_total+24)/25));
end; $$;

create function public.training_session_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.training_sessions%rowtype;v_admin boolean;v_coaches jsonb:='[]'::jsonb;v_audit jsonb;
begin
 if not private.session_access(p_id) then raise exception 'Access denied' using errcode='42501';end if;
 select * into v from public.training_sessions where id=p_id;v_admin:=private.is_club_admin(v.club_id);
 if v_admin then
 select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into v_coaches from (
 select g.coach_user_id,u.email,g.can_manage from public.session_coaches g join auth.users u on u.id=g.coach_user_id where session_id=p_id order by lower(u.email),g.coach_user_id
 ) g;end if;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into v_audit from (
 select id,action,created_at from public.club_audit where session_id=p_id order by created_at desc,id desc limit 20
 ) a;
 return jsonb_build_object('session',to_jsonb(v),'clubName',(select name from public.clubs where id=v.club_id),'isAdmin',v_admin,'canManage',private.session_access(p_id,true),'coaches',v_coaches,'audit',v_audit);
end; $$;
revoke all on function public.create_training_session(uuid,text,timestamptz,numeric,text,integer),public.update_training_session(uuid,integer,text,timestamptz,numeric,text,integer),public.finish_training_session(uuid,integer,text),public.assign_session_coach(uuid,uuid,boolean),public.remove_session_coach(uuid,uuid),public.list_training_sessions(uuid,text,integer),public.training_session_detail(uuid) from public,anon;
grant execute on function public.create_training_session(uuid,text,timestamptz,numeric,text,integer),public.update_training_session(uuid,integer,text,timestamptz,numeric,text,integer),public.finish_training_session(uuid,integer,text),public.assign_session_coach(uuid,uuid,boolean),public.remove_session_coach(uuid,uuid),public.list_training_sessions(uuid,text,integer),public.training_session_detail(uuid) to authenticated;
commit;
