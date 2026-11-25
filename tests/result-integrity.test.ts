import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);

test('results keep their own settings, sessions lock once results exist, and bests cover the whole session', async () => {
  const db = new PGlite();
  const admin = '00000000-0000-0000-0000-000000000001';
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.exec(id ? 'set role authenticated' : 'set role anon');
  };
  const rejects = (sql: string, args: unknown[], code: string) =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === code, `${sql} → ${code}`);
  const token = 'a'.repeat(64);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    await db.query("insert into auth.users values($1,'1@example.test',now())", [admin]);
    const parent = '00000000-0000-0000-0000-000000000002';
    await db.query("insert into auth.users values($1,'2@example.test',now())", [parent]);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const admissionAt = files.findIndex((f) => f.includes('club_admission'));
    for (const file of files.slice(0, admissionAt))
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    await as(admin);
    const club = await value("select create_club('Riverside test club')");
    await db.exec('reset role');
    for (const file of files.slice(admissionAt))
      await db.exec(await readFile(new URL(file, dir), 'utf8'));

    await as(admin);
    const alex = await value(
      "select register_rider_with_details($1,'Alex Test',2014,null,'{}'::jsonb,'001122AB')",
      [club]
    );
    const plan = (name: string) =>
      value("select create_session_plan($1,$2,null,20,'flying',2,'free_ride')", [club, name]);
    const earlier = await plan('Last week');
    const today = await plan('Today');
    const device = await value("select create_timing_device($1,'ST-1','live',$2)", [
      club,
      createHash('sha256').update(token).digest('hex')
    ]);
    const demo = await value("select create_timing_device($1,'Desk','test',$2)", [
      club,
      createHash('sha256').update('b'.repeat(64)).digest('hex')
    ]);
    let n = 0;
    const upload = async (sess: string, ms: number | null, dev = device, t = token) => {
      await as(null);
      const r = await value('select record_effort($1,$2,$3,$4,1,$5,$6,$7)', [
        dev,
        t,
        `r${++n}`,
        sess,
        '001122AB',
        ms === null ? 'dnf' : 'completed',
        ms
      ]);
      assert.equal(r.code, 'SAVED');
    };
    await upload(earlier, 1420);
    await db.exec('reset role');
    await db.query("update efforts set recorded_at=recorded_at-interval '7 days'");

    // New-best marks over the whole session, against the previous best of 1.420.
    for (const ms of [1430, 1410, 1415]) await upload(today, ms);
    await upload(today, 1000, demo, 'b'.repeat(64));
    await upload(today, null);
    await upload(today, 1405);
    await as(admin);
    let view = await value('select session_trackside($1)', [today]);
    assert.deepEqual(
      view.efforts.map((e: any) => [e.elapsed_ms, e.new_best]),
      [
        [1430, false],
        [1410, true],
        [1415, false],
        [1000, false],
        [null, false],
        [1405, true]
      ]
    );
    assert.equal(view.riders[0].best_today, 1405);
    assert.equal(view.total, 6);

    // Progress for a linked guardian: one point per session (its best), oldest first, no demo.
    const inv = await value("select invite_rider_access($1,'2@example.test','guardian',true)", [
      alex
    ]);
    await as(parent);
    await db.query('select respond_rider_invitation($1,true)', [inv]);
    const progress = (await value('select rider_results($1)', [alex])).progress;
    assert.deepEqual(
      progress.map((p: any) => [p.session_name, p.best_ms, p.count]),
      [
        ['Last week', 1420, 1],
        ['Today', 1405, 4]
      ]
    );
    await as(admin);

    // 1. Distance, start type and activity are locked once results exist; name still changes.
    const version = () => value('select version from training_sessions where id=$1', [today]);
    await rejects(
      "select update_training_session($1,$2,'Today',null,40,'flying',2)",
      [today, await version()],
      '23514'
    );
    await rejects(
      "select update_training_session($1,$2,'Today',null,20,'standing',2)",
      [today, await version()],
      '23514'
    );
    await rejects(
      "select set_session_activity($1,$2,'coached')",
      [today, await version()],
      '23514'
    );
    await db.query("select update_training_session($1,$2,'Today renamed',null,20,'flying',4)", [
      today,
      await version()
    ]);
    // A session with no results can still be changed freely.
    const empty = await plan('Not ridden yet');
    await db.query("select update_training_session($1,1,'Not ridden yet',null,40,'standing',2)", [
      empty
    ]);

    // 2. A session edited before this fix: each effort keeps the setting it was ridden at.
    await db.exec('reset role');
    await db.query('update training_sessions set distance_metres=40 where id=$1', [today]);
    await as(admin);
    const results = await value('select session_results($1)', [today]);
    assert.ok(results.efforts.every((e: any) => Number(e.distance_metres) === 20));
    assert.deepEqual(
      results.bests.map((b: any) => [Number(b.distance_metres), b.start_mode, b.best_ms, b.count]),
      [[20, 'flying', 1405, 4]]
    );
    view = await value('select session_trackside($1)', [today]);
    assert.equal(view.riders[0].best_today, null, 'never compared with a 40 m session setting');
    assert.ok(view.efforts.every((e: any) => !e.new_best));
    await db.exec('reset role');
    await db.query('update training_sessions set distance_metres=20 where id=$1', [today]);

    // 3. Over 500 efforts: the very first is the fastest and must still count.
    const long = await (async () => {
      await as(admin);
      return plan('Long session');
    })();
    await upload(long, 1200);
    await db.exec('reset role');
    await db.query(
      `insert into efforts(club_id, session_id, rider_id, device_id, device_result_id, fingerprint, is_test, lane,
         outcome, elapsed_ms, distance_metres, start_mode, activity, rider_name, recorded_at)
       select $1, $2, $3, $4, 'bulk-' || g, 'bulk', false, 1, 'completed', 1500 + g, 20, 'flying', 'free_ride',
         'Alex Test', now() + g * interval '1 second'
       from generate_series(1, 520) g`,
      [club, long, alex, device]
    );
    await as(admin);
    const big = await value('select session_results($1)', [long]);
    assert.equal(big.total, 521);
    assert.equal(big.efforts.length, 500);
    assert.equal(
      big.efforts.some((e: any) => e.elapsed_ms === 1200),
      false,
      'the first effort is outside the list'
    );
    assert.equal(big.bests[0].best_ms, 1200, 'but still the best');
    assert.equal(big.bests[0].count, 521);
    const side = await value('select session_trackside($1)', [long]);
    assert.equal(side.total, 521);
    assert.equal(side.efforts.length, 500);
    assert.equal(side.riders[0].best_today, 1200);
    assert.equal(side.riders[0].efforts, 521);
    assert.ok(
      side.efforts.every((e: any) => !e.new_best),
      'later slower efforts are never marked'
    );
    // The upload must lock the session row so an overlapping edit can't change its settings
    // (migration 016). Real two-connection races are checked separately on PostgreSQL.
    await db.exec('reset role');
    const definition = await value(
      "select pg_get_functiondef('public.record_effort(uuid,text,text,uuid,integer,text,text,integer)'::regprocedure)"
    );
    assert.match(definition, /from public\.training_sessions[^;]*for share/i);
  } finally {
    await db.close();
  }
});
