-- Controlled club admission. Existing clubs remain intact; no platform admin is appointed here.
begin;
create table private.platform_admins (
 user_id uuid primary key references auth.users(id),operator_note text not null check(char_length(btrim(operator_note)) between 3 and 500),created_at timestamptz not null default now()
);
create table private.platform_access_audit (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,action text not null,
 database_actor text not null,operator_note text not null,created_at timestamptz not null default now()
);
create function private.audit_platform_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into private.platform_access_audit(user_id,action,database_actor,operator_note) values(NEW.user_id,'granted',session_user,NEW.operator_note);return NEW;
 else
  insert into private.platform_access_audit(user_id,action,database_actor,operator_note) values(OLD.user_id,'revoked',session_user,OLD.operator_note);return OLD;
 end if;
end; $$;
revoke all on function private.audit_platform_access() from public,anon,authenticated;
create trigger platform_access_audit after insert or delete on private.platform_admins for each row execute function private.audit_platform_access();
create function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.platform_admins p join auth.users u on u.id=p.user_id where p.user_id=auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function private.is_platform_admin() from public,anon,authenticated;
create table private.club_applications (
 id uuid primary key default gen_random_uuid(),applicant_id uuid not null references auth.users(id),request_id uuid not null,
 club_name text not null check(char_length(btrim(club_name)) between 1 and 100),town text not null check(char_length(btrim(town)) between 1 and 100),
 applicant_name text not null check(char_length(btrim(applicant_name)) between 1 and 100),contact_email text not null,
 sport text not null default 'BMX' check(sport='BMX'),status text not null default 'submitted' check(status in ('submitted','approved','declined','withdrawn')),
 decision_reason text,reviewer_id uuid references auth.users(id),club_id uuid references public.clubs(id),created_at timestamptz not null default now(),decided_at timestamptz,
 unique(applicant_id,request_id)
);
create unique index one_pending_club_application on private.club_applications(applicant_id) where status='submitted';
create index applications_review_idx on private.club_applications(status,created_at,id);
create table private.club_application_events (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references private.club_applications(id),actor_id uuid not null references auth.users(id),
 action text not null check(action in ('submitted','approved','declined','withdrawn')),created_at timestamptz not null default now()
);
revoke all on private.platform_admins,private.platform_access_audit,private.club_applications,private.club_application_events from public,anon,authenticated;
-- Disable the legacy bypass at the database boundary, not just in the UI.
create or replace function public.create_club(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
begin raise exception 'Submit a club application for review' using errcode='42501';end; $$;

create function public.submit_club_application(p_request_id uuid,p_club_name text,p_town text,p_applicant_name text,p_authorised boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_email text;v_id uuid;v_old private.club_applications%rowtype;
begin
 if auth.uid() is null then raise exception 'Verified account required' using errcode='42501';end if;
 -- Serialize applicant submissions and read current verification under the account lock.
 perform 1 from auth.users where id=auth.uid() for update;
 v_email:=private.confirmed_email();
 if v_email is null then raise exception 'Verified account required' using errcode='42501';end if;
 if p_request_id is null or p_authorised is distinct from true or p_club_name is null or p_town is null or p_applicant_name is null
  or char_length(btrim(p_club_name)) not between 1 and 100 or char_length(btrim(p_town)) not between 1 and 100 or char_length(btrim(p_applicant_name)) not between 1 and 100 then raise exception 'Check application fields' using errcode='22023';end if;
 select * into v_old from private.club_applications where applicant_id=auth.uid() and request_id=p_request_id;
 if found then
  if v_old.club_name<>btrim(p_club_name) or v_old.town<>btrim(p_town) or v_old.applicant_name<>btrim(p_applicant_name) then raise exception 'Request reused with changed fields' using errcode='22023';end if;
  return v_old.id;
 end if;
 if exists(select 1 from private.club_applications where applicant_id=auth.uid() and status='submitted') then raise exception 'An application is already pending' using errcode='23505';end if;
 if (select count(*) from private.club_applications where applicant_id=auth.uid() and created_at>now()-interval '24 hours')>=3 then raise exception 'Application submission limit reached' using errcode='P0001';end if;
 insert into private.club_applications(applicant_id,request_id,club_name,town,applicant_name,contact_email) values(auth.uid(),p_request_id,btrim(p_club_name),btrim(p_town),btrim(p_applicant_name),v_email) returning id into v_id;
 insert into private.club_application_events(application_id,actor_id,action) values(v_id,auth.uid(),'submitted');return v_id;
end; $$;
create function public.withdraw_club_application(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v private.club_applications%rowtype;
begin
 select * into v from private.club_applications where id=p_id for update;
 if not found or auth.uid() is null or v.applicant_id<>auth.uid() then raise exception 'Access denied' using errcode='42501';end if;
 if v.status='withdrawn' then return;end if;
 if v.status<>'submitted' then raise exception 'Application already decided' using errcode='22023';end if;
 update private.club_applications set status='withdrawn',decided_at=now() where id=p_id;
 insert into private.club_application_events(application_id,actor_id,action) values(p_id,auth.uid(),'withdrawn');
end; $$;
create function public.review_club_application(p_id uuid,p_approve boolean,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v private.club_applications%rowtype;v_club uuid;
begin
 if not private.is_platform_admin() then raise exception 'Access denied' using errcode='42501';end if;
 if p_approve is null or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'Decision reason required' using errcode='22023';end if;
 select * into v from private.club_applications where id=p_id for update;
 if not found then raise exception 'Application unavailable' using errcode='42501';end if;
 if v.status='approved' and p_approve then return v.club_id;end if;
 if v.status='declined' and not p_approve then return null;end if;
 if v.status<>'submitted' then raise exception 'Application already decided' using errcode='22023';end if;
 if p_approve and not exists(select 1 from auth.users where id=v.applicant_id and email_confirmed_at is not null) then raise exception 'Applicant verification required' using errcode='22023';end if;
 -- Fixed recipient: the applicant account, never a supplied email or user ID.
 if p_approve then
  insert into public.clubs(name) values(v.club_name) returning id into v_club;
  insert into public.club_memberships(club_id,user_id,role) values(v_club,v.applicant_id,'admin');
  insert into public.club_membership_roles(club_id,user_id,role) values(v_club,v.applicant_id,'admin');
  insert into public.club_audit(club_id,actor_id,action) values(v_club,auth.uid(),'club_created');
 end if;
 update private.club_applications set status=case when p_approve then 'approved' else 'declined' end,decision_reason=btrim(p_reason),reviewer_id=auth.uid(),club_id=v_club,decided_at=now() where id=p_id;
 insert into private.club_application_events(application_id,actor_id,action) values(p_id,auth.uid(),case when p_approve then 'approved' else 'declined' end);
 return v_club;
end; $$;
create function public.club_application_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v private.club_applications%rowtype;v_platform boolean:=private.is_platform_admin();v_events jsonb;v_matches jsonb:='[]';
begin
 select * into v from private.club_applications where id=p_id;
 if not found or auth.uid() is null or (v.applicant_id<>auth.uid() and not v_platform) then raise exception 'Access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into v_events from (select action,created_at from private.club_application_events where application_id=p_id order by created_at,id) e;
 if v_platform then
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_matches from (select id,name from public.clubs where lower(btrim(name))=lower(btrim(v.club_name)) order by id limit 10) c;
 end if;
 return jsonb_build_object('application',jsonb_build_object('id',v.id,'club_name',v.club_name,'town',v.town,'sport',v.sport,'applicant_name',v.applicant_name,'contact_email',v.contact_email,'status',v.status,'created_at',v.created_at,'decided_at',v.decided_at,'decision_reason',v.decision_reason,'club_id',v.club_id),
  'isApplicant',v.applicant_id=auth.uid(),'canReview',v_platform,'events',v_events,'matchingClubs',v_matches);
end; $$;
create function public.list_club_applications(p_platform boolean default false,p_status text default 'all',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_page integer;v_items jsonb;
begin
 if auth.uid() is null or p_platform is null or (p_platform and not private.is_platform_admin()) then raise exception 'Access denied' using errcode='42501';end if;
 if p_status is null or p_status not in ('all','submitted','approved','declined','withdrawn') then raise exception 'Invalid filter' using errcode='22023';end if;
 select count(*) into v_total from private.club_applications where (p_platform or applicant_id=auth.uid()) and (p_status='all' or status=p_status);
 v_page:=greatest(1,least(coalesce(p_page,1),greatest(1,(v_total+24)/25)));
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into v_items from (
  select id,club_name,town,sport,status,created_at from private.club_applications where (p_platform or applicant_id=auth.uid()) and (p_status='all' or status=p_status)
  order by created_at desc,id limit 25 offset (v_page-1)*25
 ) a;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pages',greatest(1,(v_total+24)/25));
end; $$;
create function public.platform_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_events jsonb;
begin
 if not private.is_platform_admin() then raise exception 'Access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into v_events from (
  select e.application_id,a.club_name,e.action,e.created_at from private.club_application_events e join private.club_applications a on a.id=e.application_id where e.action in ('approved','declined') order by e.created_at desc,e.id limit 10
 ) e;
 return jsonb_build_object('pending',(select count(*) from private.club_applications where status='submitted'),'clubs',(select count(*) from public.clubs),'decisions',v_events);
end; $$;
revoke all on function public.submit_club_application(uuid,text,text,text,boolean),public.withdraw_club_application(uuid),public.review_club_application(uuid,boolean,text),public.club_application_detail(uuid),public.list_club_applications(boolean,text,integer),public.platform_overview() from public,anon;
grant execute on function public.submit_club_application(uuid,text,text,text,boolean),public.withdraw_club_application(uuid),public.review_club_application(uuid,boolean,text),public.club_application_detail(uuid),public.list_club_applications(boolean,text,integer),public.platform_overview() to authenticated;
create or replace function public.my_workspaces() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_coach jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(w) order by w.label,w.key),'[]'::jsonb) into v_items from (
  select 'admin:'||c.id::text as key,'Manage '||c.name as label,'Club administration'::text as description,
   '/club/'||c.id::text as href
  from public.club_membership_roles r join public.clubs c on c.id=r.club_id
  where r.user_id=auth.uid() and r.role='admin'
 ) w;
 v_coach:=public.my_coach_workspace();
 if jsonb_array_length(v_coach->'clubs')>0 or jsonb_array_length(v_coach->'invitations')>0 then
  v_items:=v_items||jsonb_build_array(jsonb_build_object('key','coach','label','Coach','description','Your club links, invitations and assigned sessions','href','/coach'));
 end if;
 if private.is_platform_admin() then
  v_items:=jsonb_build_array(jsonb_build_object('key','platform','label','Platform administration','description','Review club applications and admission decisions','href','/admin'))||v_items;
 end if;
 return v_items;
end; $$;
commit;
