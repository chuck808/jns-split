import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);

test('trackside: previous bests are like-for-like, live only, and only from sessions the viewer can open', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3].map((n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0'));
  const [admin, coach, outsider] = ids;
  const email = (id: string) => id.slice(-1) + '@example.test';
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.exec(id ? 'set role authenticated' : 'set role anon');
  };
  const token = 'a'.repeat(64);
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
    await db.exec('reset role');
    for (const file of files.slice(admissionAt))
      await db.exec(await readFile(new URL(file, dir), 'utf8'));

    await as(admin);
    const alex = await value(
      "select register_rider_with_details($1,'Alex Test',2014,null,'{}'::jsonb,'001122AB')",
      [club]
    );
    await value(
      "select register_rider_with_details($1,'Sam Test',2014,null,'{}'::jsonb,'001122CD')",
      [club]
    );
    const plan = (name: string, mode = 'flying') =>
      value("select create_session_plan($1,$2,null,20,$3,2,'free_ride')", [club, name, mode]);
    const lastWeek = await plan('Last week');
    const standing = await plan('Standing starts', 'standing');
    const today = await plan('Today');
    const device = await value("select create_timing_device($1,'ST-1','live',$2)", [
      club,
      createHash('sha256').update(token).digest('hex')
    ]);
    const demo = await value("select create_timing_device($1,'Desk','test',$2)", [
      club,
      createHash('sha256').update('b'.repeat(64)).digest('hex')
    ]);

    await as(null);
    let n = 0;
    const upload = (sess: string, uid: string, ms: number, dev = device, t = token) =>
      value("select record_effort($1,$2,$3,$4,1,$5,'completed',$6)", [
        dev,
        t,
        `r${++n}`,
        sess,
        uid,
        ms
      ]);
    await upload(lastWeek, '001122AB', 1450);
    await upload(lastWeek, '001122AB', 1420);
    await upload(standing, '001122AB', 1300); // different start type: not comparable
    await upload(lastWeek, '001122AB', 1100, demo, 'b'.repeat(64)); // demo: never a best
    await db.exec('reset role');
    await db.query("update efforts set recorded_at=recorded_at-interval '7 days'");
    await as(null);
    await upload(today, '001122AB', 1405);
    await upload(today, '001122CD', 1500);

    await as(admin);
    let view = await value('select session_trackside($1)', [today]);
    assert.equal(view.session.name, 'Today');
    assert.equal(view.efforts.length, 2);
    assert.deepEqual(view.previousBests, [{ rider_id: alex, best_ms: 1420 }]);

    // A coach on today's session only: no history from sessions they can't open.
    await db.query('select invite_coach($1,$2)', [club, email(coach)]);
    await as(coach);
    await db.query('select respond_coach_invitation($1,true)', [
      (await value('select my_coach_workspace()')).invitations[0].id
    ]);
    await as(admin);
    await db.query('select assign_session_coach($1,$2,false)', [today, coach]);
    await as(coach);
    view = await value('select session_trackside($1)', [today]);
    assert.equal(view.efforts.length, 2);
    assert.deepEqual(view.previousBests, [], 'no history without access to those sessions');
    await as(admin);
    await db.query('select assign_session_coach($1,$2,false)', [lastWeek, coach]);
    await as(coach);
    view = await value('select session_trackside($1)', [today]);
    assert.deepEqual(view.previousBests, [{ rider_id: alex, best_ms: 1420 }]);

    // Results from after this session started never count as "previous".
    await as(admin);
    view = await value('select session_trackside($1)', [lastWeek]);
    assert.deepEqual(view.previousBests, []);

    await as(outsider);
    await assert.rejects(
      db.query('select session_trackside($1)', [today]),
      (e: any) => e.code === '42501'
    );
  } finally {
    await db.close();
  }
});
