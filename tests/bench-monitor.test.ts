import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { newBenchToken } from '../src/lib/server/bench-device';
import { GET } from '../src/routes/club/[clubId]/equipment/live/+server';

test('monitor endpoint returns JSON auth failures and scopes RPC to route club', async () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const base = {
    params: { clubId: id },
    url: new URL('https://test/club/' + id + '/equipment/live?sessionId=' + id)
  };
  let response = await GET({ ...base, locals: { user: null, supabase: null } } as any);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  response = await GET({
    ...base,
    locals: {
      user: { id: 'user' },
      supabase: {
        rpc: async (name: string, args: unknown) => {
          assert.equal(name, 'bench_monitor');
          assert.deepEqual(args, { p_club_id: id, p_session_id: id });
          return { error: { code: '42501' }, data: null };
        }
      }
    }
  } as any);
  assert.equal(response.status, 404);
  response = await GET({
    ...base,
    locals: {
      user: { id: 'user' },
      supabase: { rpc: async () => ({ error: null, data: { simulated: true } }) }
    }
  } as any);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { simulated: true });
});

test('monitor preserves old state, timestamps new requests and exposes only club-admin test data', async () => {
  const db = new PGlite();
  const [admin, other, coach] = [1, 2, 3].map(
    (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
  );
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const user = async (id: string) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const denied = async (sql: string, args: unknown[] = []) =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === '42501');
  const token = newBenchToken();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [admin, other, coach])
      await db.query('insert into auth.users values($1,$2,now())', [id, id + '@example.test']);
    for (const file of [
      '202611190001_club_registry.sql',
      '202611200002_club_workspace.sql',
      '202611210003_coach_invitations.sql',
      '202611210004_session_planning.sql',
      '202611210005_session_participants.sql',
      '202611210006_session_activity.sql',
      '202611210007_bench_devices.sql'
    ])
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(admin);
    const club = await value("select create_club('Monitor club')");
    const rider = await value("select register_rider($1,'Alex test','001122AB')", [club]);
    const session = await value(
      "select create_session_plan($1,'Free test',null,20,'flying',2,'free_ride')",
      [club]
    );
    const device = await value("select create_bench_device($1,'Desk Core2',$2)", [
      session,
      token.hash
    ]);
    const send = (req: string, action: string, uid = '') =>
      value('select bench_device_event($1,$2,$3,$4,1,$5)', [device, token.token, req, action, uid]);
    await send('old', 'scan', '001122AB');
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611220008_bench_monitor.sql', import.meta.url),
        'utf8'
      )
    );
    await user(admin);
    const read = () => value('select bench_monitor($1,$2)', [club, session]);
    let snapshot = await read();
    assert.equal(snapshot.simulated, true);
    assert.equal(snapshot.events[0].created_at, null);
    assert.equal(snapshot.lanes[0].rider_name, 'Alex test');
    assert.equal(snapshot.lanes[0].running, false);
    assert.equal(snapshot.lanes.length, 4);
    assert.equal(snapshot.lanes[2].enabled, false);
    assert.equal(snapshot.usable_credentials, 1);
    await db.exec('reset role');
    await db.exec('update private.bench_devices set last_request_at=null');
    await user(admin);
    await send('start', 'start');
    snapshot = await read();
    assert.equal(snapshot.lanes[0].running, true);
    assert.equal(snapshot.events[0].code, 'STARTED');
    assert.ok(snapshot.events[0].created_at);
    await send('start', 'start');
    assert.equal((await read()).events.length, 2);
    for (let n = 0; n < 22; n++) {
      await db.exec('reset role');
      await db.exec('update private.bench_devices set last_request_at=null');
      await user(admin);
      await send('bad' + n, 'scan', 'DEADBEEF');
    }
    snapshot = await read();
    assert.equal(snapshot.events.length, 20);
    assert.equal(snapshot.events[0].code, 'TAG_UNAVAILABLE');
    const encoded = JSON.stringify(snapshot);
    for (const secret of [
      token.token,
      token.hash,
      '001122AB',
      'DEADBEEF',
      'fingerprint',
      'request_id',
      'token_hash'
    ])
      assert.equal(encoded.includes(secret), false);
    await denied('select * from private.bench_lanes');
    assert.equal((await value('select list_session_participants($1)', [session])).total, 0);
    await db.query('select archive_rider($1)', [rider]);
    assert.equal((await read()).lanes[0].archived, true);
    await db.query('select revoke_bench_device($1)', [device]);
    assert.equal((await read()).usable_credentials, 0);
    assert.equal((await read()).lanes[0].running, true); // retained test state, never pretend a revocation ended an effort
    await user(other);
    const otherClub = await value("select create_club('Other club')");
    await denied('select bench_monitor($1,$2)', [club, session]);
    await denied('select bench_monitor($1,$2)', [otherClub, session]);
    await user(coach);
    await denied('select bench_monitor($1,$2)', [club, session]);
    await db.exec('reset role;set role anon');
    await denied('select bench_monitor($1,$2)', [club, session]);
    await user(admin);
    await value("select create_bench_device($1,'Replacement',$2)", [session, token.hash]);
    snapshot = await read();
    assert.equal(snapshot.events.length, 0);
    assert.equal(snapshot.lanes[0].rider_name, null);
    await db.query("select update_training_session($1,1,'New plan',null,30,'standing',1)", [
      session
    ]);
    assert.equal((await read()).usable_credentials, 0);
    await db.query("select finish_training_session($1,2,'closed')", [session]);
    assert.equal((await read()).session.status, 'closed');
  } finally {
    await db.close();
  }
});
