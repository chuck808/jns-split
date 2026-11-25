import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);

test('data rights: family download, admin full export, request → erase leaves nothing personal', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3, 4].map((n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0'));
  const [admin, coach, parent, otherParent] = ids;
  const email = (id: string) => `person${id.slice(-1)}@example.test`;
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

    // A rider with every kind of data: details, a club field, a tag, results, a note, a moved effort,
    // a correction, family access, an invitation, a correction request.
    await as(admin);
    await db.query("select save_rider_field($1,null,'British Cycling licence',false)", [club]);
    const field = await value('select id from club_rider_fields where club_id=$1', [club]);
    const zara = await value(
      "select register_rider_with_details($1,'Zara Quintrell',2015,'2015-04-09',$2::jsonb,'0A0B0C0D')",
      [club, JSON.stringify({ [field]: 'BC-ZQ-77' })]
    );
    const sam = await value(
      "select register_rider_with_details($1,'Sam Test',2014,null,'{}'::jsonb,'001122CD')",
      [club]
    );
    const tonight = await value(
      "select create_session_plan($1,'Tonight',null,20,'flying',2,'coached')",
      [club]
    );
    const version = () => value('select version from training_sessions where id=$1', [tonight]);
    await db.query('select add_session_participant($1,$2,$3)', [tonight, zara, await version()]);
    await db.query('select add_session_participant($1,$2,$3)', [tonight, sam, await version()]);
    const device = await value("select create_timing_device($1,'ST-1','live',$2)", [
      club,
      createHash('sha256').update(token).digest('hex')
    ]);
    await db.query('select invite_coach($1,$2)', [club, email(coach)]);
    await as(coach);
    await db.query('select respond_coach_invitation($1,true)', [
      (await value('select my_coach_workspace()')).invitations[0].id
    ]);
    await as(admin);
    await db.query('select assign_session_coach($1,$2,false)', [tonight, coach]);
    let n = 0;
    const upload = async (uid: string, ms: number) => {
      await as(null);
      await value("select record_effort($1,$2,$3,$4,1,$5,'completed',$6)", [
        device,
        token,
        `r${++n}`,
        tonight,
        uid,
        ms
      ]);
    };
    await upload('0A0B0C0D', 1450);
    await upload('0A0B0C0D', 1430);
    await upload('0A0B0C0D', 1390); // really Sam on Zara's tag
    await upload('001122CD', 1500);
    await as(admin);
    const list = (await value('select session_results($1)', [tonight])).efforts;
    const zarasNoted = list.find((e: any) => e.elapsed_ms === 1430).id;
    const mixUp = list.find((e: any) => e.elapsed_ms === 1390).id;
    await as(coach);
    await db.query("select set_effort_note($1,'Zara: great gate, keep elbows in')", [zarasNoted]);
    await db.query("select correct_effort($1,'move',$2,'Sam rode on Zara Quintrell''s tag')", [
      mixUp,
      sam
    ]);
    await as(admin);
    const inv = await value("select invite_rider_access($1,$2,'guardian',true)", [
      zara,
      email(parent)
    ]);
    await db.query("select invite_rider_access($1,'aunt.quintrell@example.test','guardian',true)", [
      zara
    ]);
    await as(parent);
    await db.query('select respond_rider_invitation($1,true)', [inv]);
    await db.query("select request_rider_correction($1,'Zara''s birthday is 9 April')", [zara]);

    // 1. The family's download: what they see, no notes, no reasons, no other people.
    const mine = await value('select my_rider_export($1)', [zara]);
    assert.equal(mine.rider.name, 'Zara Quintrell');
    assert.equal(mine.rider.birth_date, '2015-04-09');
    assert.equal(mine.results.length, 2, 'the moved effort is Sam’s, not Zara’s');
    assert.equal(mine.your_access.kind, 'guardian');
    const famText = JSON.stringify(mine);
    for (const hidden of ['elbows', 'Sam rode', 'aunt.quintrell', email(coach)])
      assert.equal(famText.includes(hidden), false, `family download never includes ${hidden}`);
    await as(otherParent);
    await rejects('select my_rider_export($1)', [zara], '42501');
    await rejects('select request_rider_erasure($1,null)', [zara], '42501');

    // 2. The admin's full export includes everything, and is logged.
    await as(coach);
    await rejects('select admin_rider_export($1)', [zara], '42501');
    await as(admin);
    const full = await value('select admin_rider_export($1)', [zara]);
    const fullText = JSON.stringify(full);
    for (const shown of [
      'elbows',
      'Sam rode',
      'aunt.quintrell',
      email(parent),
      '0A0B0C0D',
      '9 April'
    ])
      assert.ok(fullText.includes(shown), `full export includes ${shown}`);
    assert.equal(full.results.length, 3, 'its own two, plus the one measured on its tag and moved');

    // 3. The family asks; one pending request at a time; the admin can decline with a reason...
    await as(parent);
    const req = await value("select request_rider_erasure($1,'We are moving clubs')", [zara]);
    await rejects('select request_rider_erasure($1,null)', [zara], '23505');
    await as(admin);
    assert.equal(
      (await value('select club_erasure_requests($1)', [club]))[0].display_name,
      'Zara Quintrell'
    );
    await rejects("select decline_rider_erasure($1,'  ')", [req], '22023');
    await db.query(
      "select decline_rider_erasure($1,'Safeguarding record must be kept until review')",
      [req]
    );
    await as(parent);
    assert.equal((await value('select my_erasure_request($1)', [zara])).status, 'declined');
    // ...and the family can ask again.
    await db.query('select request_rider_erasure($1,null)', [zara]);

    // Free text about OTHER riders that names Zara is listed for review, not silently rewritten.
    const samsEffort = list.find((e: any) => e.elapsed_ms === 1500).id;
    await as(coach);
    await db.query("select set_effort_note($1,'Raced Zara well')", [samsEffort]);
    await as(admin);
    const mentions = await value('select erasure_mentions($1)', [zara]);
    assert.deepEqual(
      mentions.map((m: any) => [m.kind, m.text, m.about]),
      [['note', 'Raced Zara well', 'Sam Test']],
      'own notes and the moved effort’s reason are handled by erasure itself'
    );
    // The admin edits that note before erasing, as the confirmation screen asks.
    await db.query("select set_effort_note($1,'Raced well')", [samsEffort]);

    // 4. Erasure: only an admin, only with the exact name typed.
    await as(coach);
    await rejects("select erase_rider($1,'Zara Quintrell')", [zara], '42501');
    await as(admin);
    await rejects("select erase_rider($1,'zara quintrell')", [zara], '22023');
    await db.query("select erase_rider($1,'Zara Quintrell')", [zara]);
    await rejects("select erase_rider($1,'Removed rider')", [zara], '22023');

    // Nothing personal about Zara is left anywhere in the database.
    await db.exec('reset role');
    const tables = (
      await db.query<{ s: string; t: string }>(
        "select table_schema s, table_name t from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE'"
      )
    ).rows;
    for (const needle of [
      'Zara',
      'Quintrell',
      '2015-04-09',
      'BC-ZQ-77',
      'elbows',
      'aunt.quintrell',
      'moving clubs',
      '9 April'
    ]) {
      for (const { s, t } of tables) {
        const hits = await value(`select count(*)::int from ${s}.${t} x where x::text ilike $1`, [
          `%${needle}%`
        ]);
        assert.equal(hits, 0, `"${needle}" still in ${s}.${t}`);
      }
    }
    const row = (await db.query<any>('select * from riders where id=$1', [zara])).rows[0];
    assert.equal(row.display_name, 'Removed rider');
    assert.ok(row.erased_at && row.archived_at);
    assert.equal(
      await value(
        'select count(*)::int from tag_assignments where rider_id=$1 and revoked_at is null',
        [zara]
      ),
      0
    );

    // Sam keeps the effort that was really his; the session still makes sense.
    await as(admin);
    const after = await value('select session_results($1)', [tonight]);
    assert.deepEqual(
      after.efforts.map((e: any) => [e.rider_name, e.elapsed_ms, e.original_rider_name]).sort(),
      [
        ['Sam Test', 1390, 'Removed rider'],
        ['Sam Test', 1500, null]
      ]
    );
    // The family no longer sees the rider; the tag no longer times anyone.
    await as(parent);
    assert.deepEqual((await value('select my_rider_workspace()')).riders, []);
    await as(null);
    assert.equal(
      (
        await value("select record_effort($1,$2,'late',$3,1,'0A0B0C0D','completed',1400)", [
          device,
          token,
          tonight
        ])
      ).code,
      'TAG_UNAVAILABLE'
    );
    await db.exec('reset role');
    const actions = (
      await db.query<{ action: string }>(
        "select action from club_audit where action like 'rider_%'"
      )
    ).rows.map((r) => r.action);
    for (const a of [
      'rider_data_exported',
      'rider_erasure_requested',
      'rider_erasure_declined',
      'rider_erased'
    ])
      assert.ok(actions.includes(a), a);
  } finally {
    await db.close();
  }
});
