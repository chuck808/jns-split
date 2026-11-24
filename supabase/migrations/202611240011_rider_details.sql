-- Apply AFTER 202611230010_club_admission.sql. Additive: existing riders,
-- tags, sessions and audit history are kept unchanged.
--
-- Rider details (product-experience §14):
--  * riders.birth_year, and riders.birth_date only when the club's age rule
--    needs a full date of birth;
--  * up to two club-defined optional fields that point at the club's own
--    records (e.g. "British Cycling licence"), never used for identity;
--  * per-club settings: age rule, invitation age bands (stored now, used when
--    family invitations arrive) and the default scoreboard name.
-- No age threshold is hard-coded: the bands are club settings with a UK preset.
begin;

alter table public.riders
  add column birth_year smallint check (birth_year between 1900 and 2100),
  add column birth_date date,
  add constraint riders_birth_date_matches_year
    check (birth_date is null or (birth_year is not null and extract(year from birth_date)::int = birth_year));

create table public.club_rider_settings (
  club_id uuid primary key references public.clubs(id),
  -- year_end: age on 31 December (BMX). season_31_aug: age on 31 August
  -- (needs a full date of birth). none: no age groups.
  age_rule text not null default 'year_end' check (age_rule in ('year_end','season_31_aug','none')),
  -- Invitation bands: under guardian_only_under -> guardian only; from
  -- rider_from -> the rider; in between -> the club chooses.
  guardian_only_under smallint not null default 13 check (guardian_only_under between 0 and 21),
  rider_from smallint not null default 18 check (rider_from between 0 and 21),
  scoreboard_name text not null default 'first_initial' check (scoreboard_name in ('first_initial','initials','lane')),
  updated_at timestamptz not null default now(),
  check (guardian_only_under <= rider_from)
);

create table public.club_rider_fields (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  required boolean not null default false,
  created_at timestamptz not null default now(),
  -- Removing a field archives it so values already recorded are kept.
  archived_at timestamptz,
  unique (id, club_id)
);
create index club_rider_fields_club_idx on public.club_rider_fields(club_id) where archived_at is null;

create table public.rider_field_values (
  rider_id uuid not null,
  field_id uuid not null,
  club_id uuid not null,
  value text not null check (char_length(value) between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key (rider_id, field_id),
  foreign key (rider_id, club_id) references public.riders(id, club_id),
  foreign key (field_id, club_id) references public.club_rider_fields(id, club_id)
);
create index rider_field_values_club_idx on public.rider_field_values(club_id);

alter table public.club_rider_settings enable row level security;
alter table public.club_rider_fields enable row level security;
alter table public.rider_field_values enable row level security;
create policy rider_settings_read on public.club_rider_settings for select to authenticated using (private.is_club_admin(club_id));
create policy rider_fields_read on public.club_rider_fields for select to authenticated using (private.is_club_admin(club_id));
create policy rider_field_values_read on public.rider_field_values for select to authenticated using (private.is_club_admin(club_id));
revoke all on public.club_rider_settings, public.club_rider_fields, public.rider_field_values from anon, authenticated;
grant select on public.club_rider_settings, public.club_rider_fields, public.rider_field_values to authenticated;

alter table public.club_audit drop constraint club_audit_action_check;
alter table public.club_audit add constraint club_audit_action_check check(action in ('club_created','club_updated','rider_registered','tag_assigned','tag_revoked','rider_archived','coach_invited','coach_invitation_revoked','coach_invitation_accepted','coach_invitation_declined','coach_removed','session_created','session_updated','session_closed','session_cancelled','session_coach_assigned','session_coach_removed','session_rider_added','session_rider_removed','rider_updated','rider_settings_updated','rider_field_saved','rider_field_removed'));

-- Settings with defaults for clubs that have not saved any yet.
create function public.rider_settings(p_club_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v jsonb;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 select jsonb_build_object('age_rule',s.age_rule,'guardian_only_under',s.guardian_only_under,'rider_from',s.rider_from,'scoreboard_name',s.scoreboard_name)
   into v from public.club_rider_settings s where s.club_id=p_club_id;
 v := coalesce(v, jsonb_build_object('age_rule','year_end','guardian_only_under',13,'rider_from',18,'scoreboard_name','first_initial'));
 return v || jsonb_build_object('fields',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'label',f.label,'required',f.required) order by f.created_at,f.id)
   from public.club_rider_fields f where f.club_id=p_club_id and f.archived_at is null),'[]'::jsonb));
end; $$;

create function public.update_rider_settings(p_club_id uuid,p_age_rule text,p_guardian_only_under integer,p_rider_from integer,p_scoreboard_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_age_rule is null or p_age_rule not in ('year_end','season_31_aug','none')
   or p_scoreboard_name is null or p_scoreboard_name not in ('first_initial','initials','lane')
   or p_guardian_only_under is null or p_rider_from is null
   or p_guardian_only_under not between 0 and 21 or p_rider_from not between 0 and 21
   or p_guardian_only_under > p_rider_from then
   raise exception 'Invalid rider settings' using errcode='22023';
 end if;
 insert into public.club_rider_settings as s(club_id,age_rule,guardian_only_under,rider_from,scoreboard_name)
 values(p_club_id,p_age_rule,p_guardian_only_under,p_rider_from,p_scoreboard_name)
 on conflict (club_id) do update set age_rule=excluded.age_rule,guardian_only_under=excluded.guardian_only_under,
   rider_from=excluded.rider_from,scoreboard_name=excluded.scoreboard_name,updated_at=now()
   where (s.age_rule,s.guardian_only_under,s.rider_from,s.scoreboard_name) is distinct from
         (excluded.age_rule,excluded.guardian_only_under,excluded.rider_from,excluded.scoreboard_name);
 if found then insert into public.club_audit(club_id,actor_id,action) values(p_club_id,auth.uid(),'rider_settings_updated'); end if;
end; $$;

-- Create (p_field_id null) or rename/require an existing field. At most two active.
create function public.save_rider_field(p_club_id uuid,p_field_id uuid,p_label text,p_required boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_label is null or char_length(btrim(p_label)) not between 1 and 60 or p_required is null then
   raise exception 'Invalid field' using errcode='22023';
 end if;
 -- Serialise field changes for this club so two admins cannot exceed the limit.
 perform 1 from public.clubs where id=p_club_id for update;
 if p_field_id is null then
   if (select count(*) from public.club_rider_fields where club_id=p_club_id and archived_at is null) >= 2 then
     raise exception 'A club can have at most two extra rider fields' using errcode='23514';
   end if;
   insert into public.club_rider_fields(club_id,label,required) values(p_club_id,btrim(p_label),p_required) returning id into v_id;
 else
   update public.club_rider_fields set label=btrim(p_label),required=p_required
    where id=p_field_id and club_id=p_club_id and archived_at is null returning id into v_id;
   if v_id is null then raise exception 'Field not found' using errcode='42501'; end if;
 end if;
 insert into public.club_audit(club_id,actor_id,action) values(p_club_id,auth.uid(),'rider_field_saved');
 return v_id;
end; $$;

create function public.remove_rider_field(p_field_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_club uuid;
begin
 select club_id into v_club from public.club_rider_fields where id=p_field_id and archived_at is null for update;
 if not found or not private.is_club_admin(v_club) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.club_rider_fields set archived_at=now() where id=p_field_id;
 insert into public.club_audit(club_id,actor_id,action) values(v_club,auth.uid(),'rider_field_removed');
end; $$;

-- Shared validation for rider details. Returns the birth year to store.
create function private.check_rider_details(p_club_id uuid,p_birth_year integer,p_birth_date date,p_fields jsonb) returns integer
language plpgsql stable security definer set search_path='' as $$
declare v_rule text; v_year integer := p_birth_year; v_key text; v_val jsonb; v_field record;
begin
 select age_rule into v_rule from public.club_rider_settings where club_id=p_club_id;
 v_rule := coalesce(v_rule,'year_end');
 if p_birth_date is not null then
   if p_birth_date > current_date or p_birth_date < date '1900-01-01' then raise exception 'Invalid date of birth' using errcode='22023'; end if;
   if v_year is not null and v_year <> extract(year from p_birth_date)::int then raise exception 'Date of birth does not match year' using errcode='22023'; end if;
   v_year := extract(year from p_birth_date)::int;
 end if;
 if v_year is null or v_year < 1900 or v_year > extract(year from current_date)::int then
   raise exception 'Enter a valid year of birth' using errcode='22023';
 end if;
 if v_rule='season_31_aug' and p_birth_date is null then
   raise exception 'This club needs a full date of birth' using errcode='22023';
 end if;
 if p_fields is not null and jsonb_typeof(p_fields)<>'object' then raise exception 'Invalid fields' using errcode='22023'; end if;
 for v_key,v_val in select * from jsonb_each(coalesce(p_fields,'{}'::jsonb)) loop
   if v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists(select 1 from public.club_rider_fields where id=v_key::uuid and club_id=p_club_id and archived_at is null)
     or jsonb_typeof(v_val)<>'string' or char_length(btrim(v_val #>> '{}'))>100 then
     raise exception 'Invalid field value' using errcode='22023';
   end if;
 end loop;
 for v_field in select id,label from public.club_rider_fields where club_id=p_club_id and archived_at is null and required loop
   if nullif(btrim(coalesce(p_fields ->> v_field.id::text,'')),'') is null then
     raise exception 'Required field missing' using errcode='22023';
   end if;
 end loop;
 return v_year;
end; $$;
revoke all on function private.check_rider_details(uuid,integer,date,jsonb) from public,anon,authenticated;

create function private.write_rider_fields(p_club_id uuid,p_rider_id uuid,p_fields jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_key text; v_val text;
begin
 for v_key,v_val in select key,btrim(value #>> '{}') from jsonb_each(coalesce(p_fields,'{}'::jsonb)) loop
   if v_val='' then
     delete from public.rider_field_values where rider_id=p_rider_id and field_id=v_key::uuid;
   else
     insert into public.rider_field_values(rider_id,field_id,club_id,value) values(p_rider_id,v_key::uuid,p_club_id,v_val)
     on conflict (rider_id,field_id) do update set value=excluded.value,updated_at=now() where rider_field_values.value is distinct from excluded.value;
   end if;
 end loop;
end; $$;
revoke all on function private.write_rider_fields(uuid,uuid,jsonb) from public,anon,authenticated;

create function public.register_rider_with_details(p_club_id uuid,p_name text,p_birth_year integer,p_birth_date date default null,p_fields jsonb default '{}'::jsonb,p_uid text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_year integer;
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Invalid rider name' using errcode='22023'; end if;
 v_year := private.check_rider_details(p_club_id,p_birth_year,p_birth_date,p_fields);
 insert into public.riders(club_id,display_name,birth_year,birth_date) values(p_club_id,btrim(p_name),v_year,p_birth_date) returning id into v_id;
 perform private.write_rider_fields(p_club_id,v_id,p_fields);
 if nullif(btrim(p_uid),'') is not null then perform public.set_rider_tag(v_id,p_uid); end if;
 insert into public.club_audit(club_id,actor_id,rider_id,action) values(p_club_id,auth.uid(),v_id,'rider_registered');
 return v_id;
end; $$;

create function public.update_rider_details(p_rider_id uuid,p_name text,p_birth_year integer,p_birth_date date default null,p_fields jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_rider public.riders%rowtype; v_year integer;
begin
 select * into v_rider from public.riders where id=p_rider_id for update;
 if not found or not private.is_club_admin(v_rider.club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if v_rider.archived_at is not null then raise exception 'Rider is archived' using errcode='22023'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Invalid rider name' using errcode='22023'; end if;
 v_year := private.check_rider_details(v_rider.club_id,p_birth_year,p_birth_date,p_fields);
 update public.riders set display_name=btrim(p_name),birth_year=v_year,birth_date=p_birth_date where id=p_rider_id;
 perform private.write_rider_fields(v_rider.club_id,p_rider_id,p_fields);
 insert into public.club_audit(club_id,actor_id,rider_id,action) values(v_rider.club_id,auth.uid(),p_rider_id,'rider_updated');
end; $$;

-- Roster now includes birth details and extra-field values for displayed riders.
create or replace function public.club_roster(p_club_id uuid,p_query text default '',p_status text default 'active',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_count integer; v_page integer; v_ids uuid[]; v_riders jsonb; v_tags jsonb; v_values jsonb; v_query text := lower(btrim(coalesce(p_query,'')));
begin
 if not private.is_club_admin(p_club_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if char_length(v_query)>60 or p_status is null or p_status not in ('all','active','archived','untagged') then raise exception 'Invalid filter' using errcode='22023'; end if;
 select count(*) into v_count from public.riders r where r.club_id=p_club_id
 and (p_status='all' or (p_status in ('active','untagged') and r.archived_at is null) or (p_status='archived' and r.archived_at is not null))
 and (p_status<>'untagged' or not exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null))
 and (v_query='' or strpos(lower(r.display_name),v_query)>0 or exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null and strpos(lower(t.uid),v_query)>0));
 v_page := greatest(1,least(coalesce(p_page,1),greatest(1,(v_count+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb),array_agg(p.id) into v_riders,v_ids from (
  select r.id,r.display_name,r.archived_at,r.birth_year,r.birth_date from public.riders r where r.club_id=p_club_id
  and (p_status='all' or (p_status in ('active','untagged') and r.archived_at is null) or (p_status='archived' and r.archived_at is not null))
  and (p_status<>'untagged' or not exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null))
  and (v_query='' or strpos(lower(r.display_name),v_query)>0 or exists(select 1 from public.tag_assignments t where t.rider_id=r.id and t.revoked_at is null and strpos(lower(t.uid),v_query)>0))
  order by lower(r.display_name),r.id limit 25 offset (v_page-1)*25
 ) p;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_tags from unnest(v_ids) rid
 cross join lateral (select id,rider_id,uid,assigned_at,revoked_at from public.tag_assignments where rider_id=rid order by (revoked_at is null) desc,assigned_at desc,id desc limit 50) t;
 select coalesce(jsonb_agg(jsonb_build_object('rider_id',v.rider_id,'field_id',v.field_id,'value',v.value)),'[]'::jsonb) into v_values
   from public.rider_field_values v join public.club_rider_fields f on f.id=v.field_id and f.archived_at is null
   where v.rider_id = any(coalesce(v_ids,'{}'::uuid[]));
 return jsonb_build_object('riders',v_riders,'tags',v_tags,'fieldValues',v_values,'total',v_count,'page',v_page,'pages',greatest(1,(v_count+24)/25));
end; $$;

revoke all on function public.rider_settings(uuid),public.update_rider_settings(uuid,text,integer,integer,text),public.save_rider_field(uuid,uuid,text,boolean),public.remove_rider_field(uuid),
  public.register_rider_with_details(uuid,text,integer,date,jsonb,text),public.update_rider_details(uuid,text,integer,date,jsonb) from public,anon;
grant execute on function public.rider_settings(uuid),public.update_rider_settings(uuid,text,integer,integer,text),public.save_rider_field(uuid,uuid,text,boolean),public.remove_rider_field(uuid),
  public.register_rider_with_details(uuid,text,integer,date,jsonb,text),public.update_rider_details(uuid,text,integer,date,jsonb) to authenticated;
commit;
