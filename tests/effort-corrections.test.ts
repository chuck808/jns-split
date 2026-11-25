import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);

test('corrections: invalidate, move and restore, audited; every results view follows them', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3, 4, 5].map((n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0'));
  const [admin, coach, otherCoach, parentA, parentS] = ids;
  const email = (id: string) => id.slice(-1) + '@example.test';
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const as = async (id: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.exec(id ? 'set role authenticated' : 'set role anon');
  };
  const rejects = (sql: string, args: unknown[], code: string) =>
    assert.rejects(
      db.query(sql, args),
      (e: any) => e.code === code,
      `${sql} ${JSON.stringify(args)} → ${code}`
    );
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
    const rider = (name: string, uid: string) =>
      value("select register_rider_with_details($1,$2,2014,null,'{}'::jsonb,$3)", [
        club,
        name,
        uid
      ]);
    const alex = await rider('Alex Test', '001122AB');
    const sam = await rider('Sam Test', '001122CD');
    const charlie = await rider('Charlie Test', '001122EF');
    const tonight = await value(
      "select create_session_plan($1,'Tonight',null,20,'flying',2,'free_ride')",
      [club]
    );
    const other = await value(
      "select create_session_plan($1,'Other',null,20,'flying',2,'free_ride')",
      [club]
    );
    const device = await value("select create_timing_device($1,'ST-1','live',$2)", [
      club,
      createHash('sha256').update(token).digest('hex')
    ]);
    for (const [c, s] of [
      [coach, tonight],
      [otherCoach, other]
    ]) {
      await db.query('select invite_coach($1,$2)', [club, email(c)]);
      await as(c);
      await db.query('select respond_coach_invitation($1,true)', [
        (await value('select my_coach_workspace()')).invitations[0].id
      ]);
      await as(admin);
      await db.query('select assign_session_coach($1,$2,false)', [s, c]);
    }
    for (const [p, r] of [
      [parentA, alex],
      [parentS, sam]
    ]) {
      await as(admin);
      const inv = await value("select invite_rider_access($1,$2,'guardian',true)", [r, email(p)]);
      await as(p);
      await db.query('select respond_rider_invitation($1,true)', [inv]);
    }

    // Tonight: Alex 1.430 then a suspicious 1.200 (false start), Sam 1.500.
    let n = 0;
    const upload = async (uid: string, ms: number) => {
      await as(null);
      return value("select record_effort($1,$2,$3,$4,1,$5,'completed',$6)", [
        device,
        token,
        `r${++n}`,
        tonight,
        uid,
        ms
      ]);
    };
    await upload('001122AB', 1430);
    await upload('001122AB', 1200);
    await upload('001122CD', 1500);
    await upload('001122AB', 1410);
    await as(admin);
    const efforts = (await value('select session_results($1)', [tonight])).efforts;
    const falseStart = efforts.find((e: any) => e.elapsed_ms === 1200).id;
    const mixUp = efforts.find((e: any) => e.elapsed_ms === 1410).id; // really Sam's effort on Alex's tag

    // Before corrections, the false start is Alex's best and a "new best".
    assert.equal(
      (await value('select session_results($1)', [tonight])).bests.find(
        (b: any) => b.rider_id === alex
      ).best_ms,
      1200
    );

    // Who may correct: the session's coach and admins; not another session's coach, families or anyone signed out.
    for (const who of [otherCoach, parentA, null]) {
      await as(who);
      await rejects(
        "select correct_effort($1,'invalid',null,'False start')",
        [falseStart],
        '42501'
      );
    }
    await as(coach);
    await rejects("select correct_effort($1,'invalid',null,'  ')", [falseStart], '22023');
    await rejects("select correct_effort($1,'delete',null,'x')", [falseStart], '22023');
    await rejects("select correct_effort($1,'restore',null,null)", [falseStart], '22023');
    await db.query("select correct_effort($1,'invalid',null,'False start: rolled the gate')", [
      falseStart
    ]);
    await rejects("select correct_effort($1,'invalid',null,'again')", [falseStart], '22023');

    // Move the mix-up to Sam. Charlie never rode in this session, so he isn't a valid target.
    assert.deepEqual(
      (await value('select effort_move_candidates($1)', [mixUp])).map((c: any) => c.display_name),
      ['Sam Test'],
      'only riders in this session, not the current rider'
    );
    await rejects("select correct_effort($1,'move',$2,'Wrong tag')", [mixUp, charlie], '23514');
    await rejects("select correct_effort($1,'move',$2,'Wrong tag')", [mixUp, alex], '22023');
    await db.query("select correct_effort($1,'move',$2,'Sam rode on Alex''s tag')", [mixUp, sam]);

    // The session page shows the corrected picture; the original effort itself is unchanged.
    await as(admin);
    let results = await value('select session_results($1)', [tonight]);
    const fs = results.efforts.find((e: any) => e.id === falseStart);
    assert.deepEqual(
      [fs.outcome, fs.elapsed_ms, fs.corrected, fs.correction_reason],
      ['invalid', 1200, true, 'False start: rolled the gate']
    );
    const mu = results.efforts.find((e: any) => e.id === mixUp);
    assert.deepEqual(
      [mu.rider_name, mu.original_rider_name, mu.rider_id],
      ['Sam Test', 'Alex Test', sam]
    );
    assert.deepEqual(results.bests.map((b: any) => [b.rider_name, b.best_ms, b.count]).sort(), [
      ['Alex Test', 1430, 1],
      ['Sam Test', 1410, 2]
    ]);
    await db.exec('reset role');
    const raw = (
      await db.query<any>(
        'select id, rider_id, outcome, elapsed_ms from efforts order by elapsed_ms'
      )
    ).rows;
    assert.deepEqual(
      raw.map((r) => [r.elapsed_ms, r.outcome, r.rider_id === alex]),
      [
        [1200, 'completed', true],
        [1410, 'completed', true],
        [1430, 'completed', true],
        [1500, 'completed', false]
      ],
      'efforts are never edited'
    );

    // Trackside: grid rows, bests and new-best marks follow the corrections.
    await as(coach);
    const side = await value('select session_trackside($1)', [tonight]);
    const rows = Object.fromEntries(
      side.riders.map((r: any) => [r.rider_name, [r.best_today, r.efforts]])
    );
    assert.deepEqual(rows, { 'Alex Test': [1430, 2], 'Sam Test': [1410, 2] });
    assert.equal(side.efforts.find((e: any) => e.id === falseStart).new_best, false);

    // Families: Alex's family no longer sees the moved effort; Sam's family does. No reasons shown.
    await as(parentA);
    const a = await value('select rider_results($1)', [alex]);
    assert.deepEqual(
      a.efforts.map((e: any) => [e.elapsed_ms, e.outcome]),
      [
        [1200, 'invalid'],
        [1430, 'completed']
      ]
    );
    assert.equal(a.groups[0].best_ms, 1430);
    assert.equal(
      JSON.stringify(a).includes('rolled the gate'),
      false,
      'families never see the reason'
    );
    await as(parentS);
    const s = await value('select rider_results($1)', [sam]);
    assert.deepEqual(s.groups[0].best_ms, 1410);
    assert.equal(s.efforts.length, 2);

    // A move can be combined with invalid, undone by moving back, and everything can be restored.
    await as(coach);
    await db.query("select correct_effort($1,'invalid',null,'Also a false start')", [mixUp]);
    results = await value('select session_results($1)', [tonight]);
    assert.deepEqual(
      ((e) => [e.rider_name, e.outcome])(results.efforts.find((e: any) => e.id === mixUp)),
      ['Sam Test', 'invalid']
    );
    await db.query("select correct_effort($1,'move',$2,'Actually Alex after all')", [mixUp, alex]);
    results = await value('select session_results($1)', [tonight]);
    const back = results.efforts.find((e: any) => e.id === mixUp);
    assert.deepEqual(
      [back.rider_name, back.original_rider_name, back.outcome],
      ['Alex Test', null, 'invalid']
    );
    await db.query("select correct_effort($1,'restore',null,null)", [mixUp]);
    await db.query("select correct_effort($1,'restore',null,'Video showed a clean start')", [
      falseStart
    ]);
    results = await value('select session_results($1)', [tonight]);
    assert.ok(results.efforts.every((e: any) => !e.corrected));
    assert.equal(results.bests.find((b: any) => b.rider_id === alex).best_ms, 1200);

    // Full history is kept, and each correction is in the club history.
    const history = await value('select effort_correction_history($1)', [mixUp]);
    assert.deepEqual(
      history.map((h: any) => [h.invalid, h.rider_name, h.reason, h.by_email]),
      [
        [false, 'Sam Test', "Sam rode on Alex's tag", email(coach)],
        [true, 'Sam Test', 'Also a false start', email(coach)],
        [true, null, 'Actually Alex after all', email(coach)],
        [false, null, 'Restored to the original', email(coach)]
      ]
    );
    await as(parentA);
    await rejects('select effort_correction_history($1)', [mixUp], '42501');
    await rejects('select * from effort_corrections', [], '42501');
    await db.exec('reset role');
    assert.equal(
      await value("select count(*)::int from club_audit where action='effort_corrected'"),
      6
    );
  } finally {
    await db.close();
  }
});
