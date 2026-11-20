-- Apply AFTER 202611190001_club_registry.sql. Existing records are retained.
begin;
alter table public.clubs add column speed_unit text not null default 'km/h' check (speed_unit in ('km/h','mph'));
alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check (action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived'));

create function public.update_club_settings(p_club_id uuid, p_name text, p_speed_unit text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 100 or p_speed_unit is null or p_speed_unit not in ('km/h','mph') then raise exception 'Invalid settings' using errcode='22023'; end if;
 update public.clubs set name=btrim(p_name),speed_unit=p_speed_unit where id=p_club_id and (name is distinct from btrim(p_name) or speed_unit is distinct from p_speed_unit);
 if found then insert into public.club_audit(club_id,actor_id,action) values(p_club_id,auth.uid(),'club_updated'); end if;
end; $$;

create function public.club_overview(p_club_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select jsonb_build_object(
  'active',count(*) filter(where r.archived_at is null),
  'archived',count(*) filter(where r.archived_at is not null),
  'tagged',count(*) filter(where r.archived_at is null and exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null)),
  'untagged',count(*) filter(where r.archived_at is null and not exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null))
 ) into result from public.riders r where r.club_id=p_club_id;
 return result || jsonb_build_object('audit',coalesce((select jsonb_agg(to_jsonb(a)) from (
  select a.id,a.action,a.created_at,r.display_name from public.club_audit a left join public.riders r on r.id=a.rider_id where a.club_id=p_club_id order by a.created_at desc,a.id desc limit 10
 ) a),'[]'::jsonb));
end; $$;

create function public.club_roster(p_club_id uuid,p_query text default '',p_status text default 'active',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_count integer; v_page integer; v_ids uuid[]; v_riders jsonb; v_tags jsonb; v_query text := lower(btrim(coalesce(p_query,'')));
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if char_length(v_query)>60 or p_status is null or p_status not in ('all','active','archived','untagged') then raise exception 'Invalid filter' using errcode='22023'; end if;
 -- strpos is literal matching, so user-supplied % and _ are not wildcard patterns.
 select count(*) into v_count from public.riders r where r.club_id=p_club_id
 and (p_status='all' or (p_status in ('active','untagged') and r.archived_at is null) or (p_status='archived' and r.archived_at is not null))
 and (p_status<>'untagged' or not exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null))
 and (v_query='' or strpos(lower(r.display_name),v_query)>0 or exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null and strpos(lower(t.uid),v_query)>0));
 v_page := greatest(1,least(coalesce(p_page,1),greatest(1,(v_count+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb),array_agg(p.id) into v_riders,v_ids from (
  select r.id,r.display_name,r.archived_at from public.riders r where r.club_id=p_club_id
  and (p_status='all' or (p_status in ('active','untagged') and r.archived_at is null) or (p_status='archived' and r.archived_at is not null))
  and (p_status<>'untagged' or not exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null))
  and (v_query='' or strpos(lower(r.display_name),v_query)>0 or exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null and strpos(lower(t.uid),v_query)>0))
  order by lower(r.display_name),r.id limit 25 offset (v_page-1)*25
 ) p;
 -- Bounded history for each displayed rider, active assignment first.
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_tags from unnest(v_ids) rid
 cross join lateral (select id,rider_id,uid,assigned_at,revoked_at from public.tag_assignments where rider_id=rid order by (revoked_at is null) desc,assigned_at desc,id desc limit 50) t;
 return jsonb_build_object('riders',v_riders,'tags',v_tags,'total',v_count,'page',v_page,'pages',greatest(1,(v_count+24)/25));
end; $$;
revoke all on function public.update_club_settings(uuid,text,text),public.club_overview(uuid),public.club_roster(uuid,text,text,integer) from public,anon;
grant execute on function public.update_club_settings(uuid,text,text),public.club_overview(uuid),public.club_roster(uuid,text,text,integer) to authenticated;
commit;
