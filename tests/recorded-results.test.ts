import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);

test('recorded results: controller uploads, idempotency, demo separation and access', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3, 4, 5].map((n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0'));
  const [admin, coach, parent, outsider, otherAdmin] = ids;
  const email = (id: string) => id.slice(-1) + '@example.test';
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.exec(id ? 'set role authenticated' : 'set role anon');
  };
  const rejects = (sql: string, args: unknown[], code: string) =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === code, `${sql} → ${code}`);
  const token = (n: number) => String(n).repeat(64).slice(0, 64);
  const hash = (t: string) => createHash('sha256').update(t).digest('hex');
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of ids)
      await db.query('insert into auth.users values($1,$2,now())', [id, email(id)]);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const admissionAt = files.findIndex((f) => f.includes('club_admission'));
    for (const file of files.slice(0, admissionAt))
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    await as(admin);
    const club = await value("select create_club('Riverside test club')");
    await as(otherAdmin);
    const otherClub = await value("select create_club('Other club')");
    await db.exec('reset role');
    for (const file of files.slice(admissionAt))
      await db.exec(await readFile(new URL(file, dir), 'utf8'));

    // Club set-up: riders with tags, a coach on a coached session, and a free-ride session.
    await as(admin);
    const rider = async (name: string, uid: string) =>
      value("select register_rider_with_details($1,$2,2014,null,'{}'::jsonb,$3)", [
        club,
        name,
        uid
      ]);
    const alex = await rider('Alex Test', '001122AB');
    const sam = await rider('Sam Test', '001122CD');
    await rider('Charlie Test', '001122EF');
    const session = (name: string, activity: string, lanes = 2) =>
      value("select create_session_plan($1,$2,null,20,'flying',$3,$4)", [
        club,
        name,
        lanes,
        activity
      ]);
    const coached = await session('Tuesday sprints', 'coached');
    const version = () => value('select version from training_sessions where id=$1', [coached]);
    await db.query('select add_session_participant($1,$2,$3)', [coached, alex, await version()]);
    await db.query('select add_session_participant($1,$2,$3)', [coached, sam, await version()]);
    const freeRide = await session('Open practice', 'free_ride');

    const live = await value("select create_timing_device($1,'ST-1 lane 1','live',$2)", [
      club,
      hash(token(1))
    ]);
    const demo = await value("select create_timing_device($1,'Desk test','test',$2)", [
      club,
      hash(token(2))
    ]);
    await rejects("select create_timing_device($1,'x','both',$2)", [club, hash(token(3))], '22023');
    const devices = await value('select list_timing_devices($1)', [club]);
    assert.equal(devices.length, 2);
    assert.equal(JSON.stringify(devices).includes(hash(token(1))), false, 'never returns the hash');

    // Other people can't issue or list controllers for this club.
    await as(otherAdmin);
    await rejects("select create_timing_device($1,'x','live',$2)", [club, hash(token(4))], '42501');
    await rejects('select list_timing_devices($1)', [club], '42501');

    // The controller uploads with no person signed in.
    await as(null);
    const upload = (
      device: string,
      t: string,
      id: string,
      sess: string,
      lane: number,
      uid: string,
      outcome = 'completed',
      ms: number | null = 1405
    ) =>
      value('select record_effort($1,$2,$3,$4,$5,$6,$7,$8)', [
        device,
        t,
        id,
        sess,
        lane,
        uid,
        outcome,
        ms
      ]);
    let r = await upload(live, token(1), 'boot1-1', coached, 1, '001122AB');
    assert.deepEqual([r.code, r.replay, r.test, r.name], ['SAVED', false, false, 'Alex Test']);
    r = await upload(live, token(1), 'boot1-1', coached, 1, '001122AB');
    assert.deepEqual([r.code, r.replay], ['SAVED', true], 'a retry saves nothing new');
    r = await upload(live, token(1), 'boot1-1', coached, 1, '001122AB', 'completed', 1500);
    assert.equal(r.code, 'RESULT_ID_CONFLICT');
    assert.equal(
      (await upload(live, token(1), 'boot1-2', coached, 2, '001122AB', 'completed', 1390)).code,
      'SAVED'
    );
    assert.equal(
      (await upload(live, token(1), 'boot1-3', coached, 2, '001122CD', 'dnf', null)).code,
      'SAVED'
    );
    assert.equal(
      (await upload(demo, token(2), 'desk-1', coached, 1, '001122AB', 'completed', 999)).test,
      true
    );

    // Rejections are explained and not stored.
    assert.equal(
      (await upload(live, token(1), 'x1', coached, 1, '001122EF')).code,
      'NOT_IN_SESSION'
    );
    assert.equal(
      (await upload(live, token(1), 'x2', coached, 1, 'FFFFFFFF')).code,
      'TAG_UNAVAILABLE'
    );
    assert.equal(
      (await upload(live, token(1), 'x3', coached, 3, '001122AB')).code,
      'LANE_DISABLED'
    );
    assert.equal(
      (await upload(live, token(1), 'x4', otherClub, 1, '001122AB')).code,
      'SESSION_UNAVAILABLE'
    );
    // Open practice needs no list: any active club rider with a valid tag.
    r = await upload(live, token(1), 'free-1', freeRide, 1, '001122EF');
    assert.deepEqual([r.code, r.name], ['SAVED', 'Charlie Test']);
    await rejects(
      'select record_effort($1,$2,$3,$4,$5,$6,$7,$8)',
      [live, token(9), 'y', coached, 1, '001122AB', 'completed', 1400],
      '42501'
    );
    await rejects(
      'select record_effort($1,$2,$3,$4,$5,$6,$7,$8)',
      [live, token(1), 'y', coached, 1, '001122AB', 'completed', null],
      '22023'
    );
    await rejects(
      'select record_effort($1,$2,$3,$4,$5,$6,$7,$8)',
      [live, token(1), 'y', coached, 1, '001122AB', 'dnf', 1400],
      '22023'
    );
    await rejects(
      'select record_effort($1,$2,$3,$4,$5,$6,$7,$8)',
      [live, token(1), 'bad id!', coached, 1, '001122AB', 'completed', 1400],
      '22023'
    );
    await rejects('select * from efforts', [], '42501');

    // Efforts are immutable and private, even to the club admin.
    await as(admin);
    await rejects('select * from efforts', [], '42501');
    await rejects('update efforts set elapsed_ms=1', [], '42501');
    await rejects('delete from efforts', [], '42501');
    let results = await value('select session_results($1)', [coached]);
    assert.equal(results.length, 4);
    assert.deepEqual(
      results.map((e: any) => [e.rider_name, e.outcome, e.elapsed_ms, e.is_test]),
      [
        ['Alex Test', 'completed', 1405, false],
        ['Alex Test', 'completed', 1390, false],
        ['Sam Test', 'dnf', null, false],
        ['Alex Test', 'completed', 999, true]
      ]
    );

    // A coach sees results only for sessions they're assigned to.
    await db.query('select invite_coach($1,$2)', [club, email(coach)]);
    await as(coach);
    const inviteId = (await value('select my_coach_workspace()')).invitations[0].id;
    await db.query('select respond_coach_invitation($1,true)', [inviteId]);
    await rejects('select session_results($1)', [coached], '42501');
    await as(admin);
    await db.query('select assign_session_coach($1,$2,false)', [coached, coach]);
    await as(coach);
    assert.equal((await value('select session_results($1)', [coached])).length, 4);
    await as(outsider);
    await rejects('select session_results($1)', [coached], '42501');

    // A linked guardian sees live results for their own child only, never demo ones.
    await as(admin);
    const inv = await value("select invite_rider_access($1,$2,'guardian',true)", [
      alex,
      email(parent)
    ]);
    await as(parent);
    await db.query('select respond_rider_invitation($1,true)', [inv]);
    const mine = await value('select rider_results($1)', [alex]);
    assert.deepEqual(
      mine.efforts.map((e: any) => e.elapsed_ms),
      [1390, 1405]
    );
    assert.equal(mine.efforts[0].session_name, 'Tuesday sprints');
    assert.deepEqual(
      mine.groups.map((g: any) => [
        Number(g.distance_metres),
        g.start_mode,
        g.best_ms,
        g.valid_count
      ]),
      [[20, 'flying', 1390, 2]]
    );
    assert.equal(JSON.stringify(mine).includes('999'), false, 'demo results never reach families');
    await rejects('select rider_results($1)', [sam], '42501');

    // Revoked or expired credentials stop working; closed sessions take no more efforts.
    await as(admin);
    await db.query('select revoke_timing_device($1)', [demo]);
    await as(null);
    await rejects(
      'select record_effort($1,$2,$3,$4,$5,$6,$7,$8)',
      [demo, token(2), 'desk-2', coached, 1, '001122AB', 'completed', 1000],
      '42501'
    );
    await db.exec('reset role');
    await db.query("update training_sessions set status='closed' where id=$1", [coached]);
    await as(null);
    assert.equal(
      (await upload(live, token(1), 'boot1-9', coached, 1, '001122AB')).code,
      'SESSION_CLOSED'
    );

    await db.exec('reset role');
    const actions = (await db.query<{ action: string }>('select action from club_audit')).rows.map(
      (x) => x.action
    );
    assert.ok(actions.includes('timing_device_created'));
    assert.ok(actions.includes('timing_device_revoked'));
  } finally {
    await db.close();
  }
});
