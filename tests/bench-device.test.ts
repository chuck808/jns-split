import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  newBenchToken,
  benchCredential,
  benchInput,
  limitedJson,
  benchResponse
} from '../src/lib/server/bench-device';

test('test API requires explicit simulation, valid credentials and bounded JSON', async () => {
  const { token, hash } = newBenchToken();
  assert.equal(token.length, 64);
  assert.equal(hash.length, 64);
  assert.notEqual(token, hash);
  assert.equal(
    benchCredential(`Bearer 00000000-0000-0000-0000-000000000001.${token}`).p_token,
    token
  );
  assert.throws(() => benchCredential(token));
  assert.throws(() => benchInput({ requestId: 'a', action: 'scan', lane: 1, uid: 'DEADBEEF' }));
  assert.throws(() =>
    benchInput({ simulated: true, requestId: 'a', action: 'scan', lane: 5, uid: 'DEADBEEF' })
  );
  assert.throws(() =>
    benchInput({ simulated: true, requestId: 'a', action: 'start', lane: 1, uid: 'DEADBEEF' })
  );
  assert.equal(
    benchInput({ simulated: true, requestId: 'a', action: 'scan', lane: 1, uid: '00:11:22:ab' })
      .p_uid,
    '001122AB'
  );
  await assert.rejects(
    limitedJson(
      new Request('https://test/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: ' '.repeat(1025)
      })
    )
  );
  await assert.rejects(limitedJson(new Request('https://test/', { method: 'POST', body: '{}' })));
  assert.deepEqual(
    await limitedJson(
      new Request('https://test/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"simulated":true}'
      })
    ),
    { simulated: true }
  );
  assert.match(
    benchResponse({ code: 'ACCEPTED', name: 'Jamie\n808', replay: true }, 1),
    /SIMULATED REPLAY\nACCEPTED\nLane 1\nJamie 808/
  );
});

test('credential-scoped test controller checks eligibility, lane locks, retries and revocation without real writes', async () => {
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
  const anon = async () => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec('set role anon');
  };
  const denied = async (sql: string, args: unknown[], code = '42501') =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === code);
  const token = newBenchToken();
  let id: string;
  let seq = 0;
  const send = (uid = '001122AB', lane = 1, action = 'scan', requestId = String(++seq)) =>
    value('select bench_device_event($1,$2,$3,$4,$5,$6)', [
      id,
      token.token,
      requestId,
      action,
      lane,
      uid
    ]);
  const cooldown = async () => {
    await db.exec('reset role');
    await db.exec('update private.bench_devices set last_request_at=null');
    await anon();
  };
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const x of [admin, other, coach])
      await db.query('insert into auth.users values($1,$2,now())', [x, x + '@example.test']);
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
    const club = await value("select create_club('Bench club')");
    const rider = await value("select register_rider($1,'Jamie808','001122AB')", [club]);
    const sam = await value("select register_rider($1,'Sam test','001122AC')", [club]);
    const session = await value(
      "select create_session_plan($1,'Free test',null,20,'flying',2,'free_ride')",
      [club]
    );
    id = await value("select create_bench_device($1,'Core2',$2)", [session, token.hash]);
    const devices = await value('select list_bench_devices($1)', [club]);
    assert.equal(devices.length, 1);
    assert.equal(devices[0].token_hash, undefined);
    const invitation = await value('select invite_coach($1,$2)', [club, coach + '@example.test']);
    await user(coach);
    await db.query('select respond_coach_invitation($1,true)', [invitation]);
    await denied("select create_bench_device($1,'Bad',$2)", [session, token.hash]);
    await denied('select list_bench_devices($1)', [club]);
    await user(other);
    const otherClub = await value("select create_club('Other club')");
    await value("select register_rider($1,'Other rider','001122AD')", [otherClub]);
    await denied('select revoke_bench_device($1)', [id]);
    await anon();
    await denied('select * from private.bench_devices', []);
    await denied('select bench_device_event($1,$2,$3,$4,$5,$6)', [
      id,
      'f'.repeat(64),
      'wrong',
      'scan',
      1,
      '001122AB'
    ]);
    assert.equal((await send('001122AD')).code, 'TAG_UNAVAILABLE');
    await cooldown();
    assert.equal((await send()).code, 'ACCEPTED');
    await assert.rejects(send('001122AC'), (e: any) => e.code === 'P0001');
    const last = String(seq - 1);
    assert.equal((await send('001122AB', 1, 'scan', last)).replay, true);
    await denied(
      'select bench_device_event($1,$2,$3,$4,$5,$6)',
      [id, token.token, last, 'scan', 2, '001122AB'],
      '22023'
    );
    await cooldown();
    assert.equal((await send('001122AC')).code, 'LANE_OCCUPIED');
    await cooldown();
    assert.equal((await send('001122AB', 2)).code, 'RIDER_OTHER_LANE');
    await cooldown();
    assert.equal((await send('', 1, 'start')).code, 'STARTED');
    await cooldown();
    assert.equal((await send()).code, 'LANE_RUNNING');
    await cooldown();
    assert.equal((await send('001122AC', 2)).code, 'ACCEPTED');
    await cooldown();
    assert.equal((await send('', 2, 'start')).code, 'STARTED');
    await cooldown();
    assert.equal((await send('', 1, 'clear')).code, 'CLEARED_NO_RESULT');
    await cooldown();
    assert.equal((await send('', 2, 'start')).code, 'ALREADY_RUNNING');
    assert.equal((await send('001122AB', 1, 'scan', last)).replay, true); // historical response does not restore lane
    await cooldown();
    assert.equal((await send('', 1, 'start')).code, 'SCAN_FIRST');
    await cooldown();
    assert.equal((await send('001122AB', 4)).code, 'LANE_DISABLED');
    await user(admin);
    assert.equal((await value('select list_session_participants($1)', [session])).total, 0);
    await db.query('select revoke_rider_tag($1)', [rider]);
    await cooldown();
    assert.equal((await send()).code, 'TAG_UNAVAILABLE');
    await user(admin);
    await db.query('select archive_rider($1)', [sam]);
    await cooldown();
    assert.equal((await send('001122AC')).code, 'TAG_UNAVAILABLE');
    await user(admin);
    await db.query("select update_training_session($1,1,'Changed',null,30,'flying',2)", [session]);
    await cooldown();
    assert.equal((await send()).code, 'SESSION_CHANGED');
    await user(admin);
    const coached = await value(
      "select create_training_session($1,'Coached test',null,20,'standing',2)",
      [club]
    );
    const active = await value("select register_rider($1,'New test','001122AE')", [club]);
    id = await value("select create_bench_device($1,'Coached Core2',$2)", [coached, token.hash]);
    await anon();
    assert.equal((await send('001122AE')).code, 'NOT_IN_SESSION');
    await user(admin);
    await db.query('select add_session_participant($1,$2,1)', [coached, active]);
    id = await value("select create_bench_device($1,'New coached Core2',$2)", [
      coached,
      token.hash
    ]);
    await anon();
    assert.equal((await send('001122AE')).code, 'ACCEPTED');
    await user(admin);
    await db.query('select revoke_bench_device($1)', [id]);
    await anon();
    await assert.rejects(send('001122AE'), (e: any) => e.code === '42501');
    await user(admin);
    id = await value("select create_bench_device($1,'Expiring Core2',$2)", [coached, token.hash]);
    await db.exec('reset role');
    await db.query(
      "update private.bench_devices set expires_at=now()-interval '1 second' where id=$1",
      [id]
    );
    await anon();
    await assert.rejects(send('001122AE'), (e: any) => e.code === '42501');
  } finally {
    await db.close();
  }
});
