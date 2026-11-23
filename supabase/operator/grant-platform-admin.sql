-- OPERATOR ONLY: run separately in Supabase SQL Editor after migration 010.
-- Replace both values. This is not a migration and is never run by the web app.
do $$
declare
 operator_email text := 'REPLACE_WITH_YOUR_CONFIRMED_ACCOUNT_EMAIL';
 operator_note text := 'REPLACE_WITH_WHO_AUTHORISED_THIS_AND_WHY';
 target_id uuid;
 matched integer;
begin
 if operator_email like 'REPLACE_%' or operator_note like 'REPLACE_%' then
  raise exception 'Replace operator_email and operator_note before running';
 end if;
 select count(*) into matched from auth.users where lower(btrim(email))=lower(btrim(operator_email)) and email_confirmed_at is not null;
 if matched<>1 then raise exception 'Expected exactly one confirmed account with that email';end if;
 select id into target_id from auth.users where lower(btrim(email))=lower(btrim(operator_email)) and email_confirmed_at is not null;
 insert into private.platform_admins(user_id,operator_note) values(target_id,operator_note) on conflict(user_id) do nothing;
end $$;
-- An authorised database operator can revoke this role by deleting its row from
-- private.platform_admins. Deletion is audited with the original grant note and
-- database operator identity. No application role can write this table directly.
