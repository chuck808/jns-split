import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { applicationFilters } from '../src/lib/club-admission';
import { load as adminLoad } from '../src/routes/admin/+page.server';
import { actions as loginActions } from '../src/routes/login/+page.server';

test('application filters reject unbounded or invalid values', () => {
  assert.deepEqual(applicationFilters(new URLSearchParams('status=secret&page=-1'), 'submitted'), {
    status: 'submitted',
    page: 1
  });
  assert.equal(applicationFilters(new URLSearchParams('page=999999999999')).page, 2147483647);
});
test('platform page blocks non-platform accounts before fetching applications', async () => {
  const calls: string[] = [];
  await assert.rejects(
    adminLoad({
      locals: {
        user: { id: 'user' },
        supabase: {
          rpc: async (name: string) => {
            calls.push(name);
            return { data: null, error: { code: '42501' } };
          }
        }
      },
      url: new URL('https://test/admin')
    } as any) as Promise<unknown>,
    (e: any) => e.status === 404
  );
  assert.deepEqual(calls, ['platform_overview']);
});
test('successful sign-in routes through the permission-checked workspace resolver', async () => {
  await assert.rejects(
    loginActions.default!({
      request: new Request('https://test/login', {
        method: 'POST',
        body: new URLSearchParams({ email: 'user@example.test', password: 'test-password' })
      }),
      locals: { supabase: { auth: { signInWithPassword: async () => ({ error: null }) } } }
    } as any) as Promise<unknown>,
    (e: any) => e.status === 303 && e.location === '/app'
  );
});

test('club admission is reviewed, idempotent, scoped and preserves existing pilot access', async () => {
  const db = new PGlite();
  const [operator, applicant, other, legacy, unverified] = [1, 2, 3, 4, 5].map(
    (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
  );
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const user = async (id: string) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const denied = async (sql: string, args: unknown[] = [], code = '42501') =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === code);
  const submit = (name = 'Test club', request = randomUUID()) =>
    value('select submit_club_application($1,$2,$3,$4,true)', [
      request,
      name,
      'Test town',
      'Test applicant'
    ]);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [operator, applicant, other, legacy, unverified])
      await db.query('insert into auth.users values($1,$2,$3)', [
        id,
        id + '@example.test',
        id === unverified ? null : new Date().toISOString()
      ]);
    for (const file of [
      '202611190001_club_registry.sql',
      '202611200002_club_workspace.sql',
      '202611210003_coach_invitations.sql',
      '202611210004_session_planning.sql',
      '202611210005_session_participants.sql',
      '202611210006_session_activity.sql',
      '202611210007_bench_devices.sql',
      '202611220008_bench_monitor.sql',
      '202611220009_workspaces_and_roles.sql'
    ])
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(legacy);
    const oldClub = await value("select create_club('Existing club')");
    const rider = await value("select register_rider($1,'Alex test','001122AB')", [oldClub]);
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611230010_club_admission.sql', import.meta.url),
        'utf8'
      )
    );
    await user(legacy);
    assert.equal(await value('select private.is_club_admin($1)', [oldClub]), true);
    assert.equal(
      await value('select uid from tag_assignments where rider_id=$1', [rider]),
      '001122AB'
    );
    assert.equal((await value('select my_workspaces()'))[0].key, 'admin:' + oldClub);
    await denied("select create_club('Bypass')");
    await denied('select platform_overview()');
    await user(operator);
    assert.deepEqual(await value('select my_workspaces()'), []);
    await denied(
      "insert into private.platform_admins(user_id,operator_note) values($1,'Self promotion')",
      [operator]
    );
    await db.exec('reset role');
    const script = await readFile(
      new URL('../supabase/operator/grant-platform-admin.sql', import.meta.url),
      'utf8'
    );
    await assert.rejects(db.exec(script));
    const setup = script
      .replace('REPLACE_WITH_YOUR_CONFIRMED_ACCOUNT_EMAIL', operator + '@example.test')
      .replace(
        'REPLACE_WITH_WHO_AUTHORISED_THIS_AND_WHY',
        'Test operator approved initial pilot setup'
      );
    await db.exec(setup);
    await db.exec(setup);
    assert.equal(
      await value("select count(*) from private.platform_access_audit where action='granted'"),
      1
    );
    await user(operator);
    assert.equal((await value('select my_workspaces()'))[0].href, '/admin');
    assert.equal((await value('select platform_overview()')).clubs, 1);
    assert.equal((await db.query('select * from riders')).rows.length, 0);
    assert.equal((await db.query('select * from tag_assignments')).rows.length, 0);
    await denied("select register_rider($1,'Forbidden')", [oldClub]);
    await denied('select bench_monitor($1,$2)', [oldClub, randomUUID()]);
    await denied("select create_club('Platform bypass')");
    await user(unverified);
    await denied('select submit_club_application($1,$2,$3,$4,true)', [
      randomUUID(),
      'No',
      'Town',
      'Name'
    ]);
    await user(applicant);
    const request = randomUUID();
    const app = await submit('Existing club', request);
    assert.equal(await submit('Existing club', request), app);
    await denied(
      'select submit_club_application($1,$2,$3,$4,true)',
      [request, 'Changed', 'Town', 'Name'],
      '22023'
    );
    await denied(
      'select submit_club_application($1,$2,$3,$4,true)',
      [randomUUID(), 'Second', 'Town', 'Name'],
      '23505'
    );
    await denied('select review_club_application($1,true,$2)', [app, 'Self approval']);
    assert.equal((await value('select list_club_applications()')).total, 1);
    await denied("select list_club_applications(true,'all',1)");
    await user(other);
    assert.equal((await value('select list_club_applications()')).total, 0);
    await denied('select club_application_detail($1)', [app]);
    await denied('select withdraw_club_application($1)', [app]);
    await user(operator);
    const detail = await value('select club_application_detail($1)', [app]);
    assert.equal(detail.matchingClubs[0].id, oldClub);
    assert.equal(detail.isApplicant, false);
    const club = await value('select review_club_application($1,true,$2)', [
      app,
      'Club authority checked'
    ]);
    assert.equal(await value('select review_club_application($1,true,$2)', [app, 'Retry']), club);
    await denied('select review_club_application($1,false,$2)', [app, 'Change decision'], '22023');
    assert.equal((await value('select platform_overview()')).clubs, 2);
    assert.equal((await value('select platform_overview()')).decisions.length, 1);
    assert.equal((await db.query('select * from riders')).rows.length, 0);
    assert.equal(await value('select private.is_club_admin($1)', [club]), false);
    await user(applicant);
    assert.equal(await value('select private.is_club_admin($1)', [club]), true);
    assert.equal((await value('select my_workspaces()'))[0].href, '/club/' + club);
    assert.equal(await submit('Existing club', request), app);
    await denied('select withdraw_club_application($1)', [app], '22023');
    const withdrawn = await submit('Withdraw me');
    await db.query('select withdraw_club_application($1)', [withdrawn]);
    await db.query('select withdraw_club_application($1)', [withdrawn]);
    await user(operator);
    await denied('select review_club_application($1,true,$2)', [withdrawn, 'Too late'], '22023');
    await user(applicant);
    const declined = await submit('Decline me');
    await user(operator);
    await db.query('select review_club_application($1,false,$2)', [
      declined,
      'Please clarify the club identity'
    ]);
    await user(applicant);
    assert.equal(
      (await value('select club_application_detail($1)', [declined])).application.decision_reason,
      'Please clarify the club identity'
    );
    await denied(
      'select submit_club_application($1,$2,$3,$4,true)',
      [randomUUID(), 'Fourth', 'Town', 'Name'],
      'P0001'
    );
    const own = await value('select club_application_detail($1)', [app]);
    assert.equal(own.application.reviewer_id, undefined);
    assert.equal(own.matchingClubs.length, 0);
    await denied('select * from private.club_application_events');
    await db.exec('reset role');
    for (let n = 0; n < 26; n++)
      await db.query(
        "insert into private.club_applications(applicant_id,request_id,club_name,town,applicant_name,contact_email,status,created_at) values($1,$2,$3,'Town','Name','test@example.test','withdrawn',now()-interval '2 days')",
        [other, randomUUID(), 'Club ' + n]
      );
    await user(other);
    let list = await value("select list_club_applications(false,'withdrawn',2)");
    assert.equal(list.items.length, 1);
    assert.equal(list.total, 26);
    const lostVerification = await submit('Verification test');
    await db.exec('reset role');
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [other]);
    await user(operator);
    await denied(
      'select review_club_application($1,true,$2)',
      [lostVerification, 'Cannot approve'],
      '22023'
    );
    await db.query('select review_club_application($1,false,$2)', [
      lostVerification,
      'Please verify the account'
    ]);
    list = await value("select list_club_applications(true,'all',999)");
    assert.equal(list.page, 2);
    await db.exec('reset role');
    await db.query('delete from private.platform_admins where user_id=$1', [operator]);
    assert.equal(
      await value("select count(*) from private.platform_access_audit where action='revoked'"),
      1
    );
    await user(operator);
    await denied('select platform_overview()');
    assert.deepEqual(await value('select my_workspaces()'), []);
    await db.exec('reset role;set role anon');
    await denied('select platform_overview()');
    await denied('select list_club_applications()');
    await denied('select club_application_detail($1)', [app]);
  } finally {
    await db.close();
  }
});
