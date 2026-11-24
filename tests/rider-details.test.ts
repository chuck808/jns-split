import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrations = [
  '202611190001_club_registry.sql',
  '202611200002_club_workspace.sql',
  '202611210003_coach_invitations.sql',
  '202611210004_session_planning.sql',
  '202611210005_session_participants.sql',
  '202611210006_session_activity.sql',
  '202611210007_bench_devices.sql',
  '202611220008_bench_monitor.sql',
  '202611220009_workspaces_and_roles.sql',
  '202611230010_club_admission.sql'
];

test('rider details: additive migration, validation, club scoping and field limits', async () => {
  const db = new PGlite();
  const [admin, outsider] = [1, 2].map(
    (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
  );
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const user = async (id: string) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const rejects = (sql: string, args: unknown[], code: string) =>
    assert.rejects(
      db.query(sql, args),
      (e: any) => e.code === code,
      `${sql} should fail with ${code}`
    );
  const thisYear = new Date().getUTCFullYear();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [admin, outsider])
      await db.query('insert into auth.users values($1,$2,now())', [id, id + '@example.test']);
    // Up to 009 so a pilot club can still be created directly, as on existing installs.
    for (const file of migrations.slice(0, 9))
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(admin);
    const club = await value("select create_club('Riverside test club')");
    const existing = await value("select register_rider($1,'Existing rider','001122AB')", [club]);
    await db.exec('reset role');
    for (const file of [migrations[9], '202611240011_rider_details.sql'])
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );

    await user(admin);
    // Existing riders survive untouched, with empty details.
    const before = await value('select club_roster($1)', [club]);
    assert.equal(before.riders[0].id, existing);
    assert.equal(before.riders[0].birth_year, null);
    assert.deepEqual(before.fieldValues, []);
    assert.equal(
      await value('select uid from tag_assignments where rider_id=$1', [existing]),
      '001122AB'
    );

    // Defaults before anything is saved: UK preset, no hard-coded rule in code paths.
    const defaults = await value('select rider_settings($1)', [club]);
    assert.deepEqual(
      { ...defaults, fields: undefined },
      {
        age_rule: 'year_end',
        guardian_only_under: 13,
        rider_from: 18,
        scoreboard_name: 'first_initial',
        fields: undefined
      }
    );

    // Year of birth is required for new registrations and must be plausible.
    await rejects("select register_rider_with_details($1,'No year',null)", [club], '22023');
    await rejects(
      "select register_rider_with_details($1,'Future',$2)",
      [club, thisYear + 1],
      '22023'
    );
    await rejects("select register_rider_with_details($1,'Ancient',1800)", [club], '22023');
    const alex = await value(
      "select register_rider_with_details($1,' Alex M. ',2015,null,'{}'::jsonb,'04A21B7C9D3FA3')",
      [club]
    );
    const roster = await value('select club_roster($1)', [club]);
    const alexRow = roster.riders.find((r: any) => r.id === alex);
    assert.equal(alexRow.display_name, 'Alex M.');
    assert.equal(alexRow.birth_year, 2015);
    assert.equal(alexRow.birth_date, null);
    assert.equal(
      await value('select uid from tag_assignments where rider_id=$1 and revoked_at is null', [
        alex
      ]),
      '04A21B7C9D3FA3'
    );

    // Extra fields: at most two active, labels validated, values scoped to the club.
    const licence = await value(
      "select save_rider_field($1,null,'British Cycling licence',false)",
      [club]
    );
    const kit = await value("select save_rider_field($1,null,'Kit size',true)", [club]);
    await rejects("select save_rider_field($1,null,'Third field',false)", [club], '23514');
    await rejects("select save_rider_field($1,null,'   ',false)", [club], '22023');
    // A required field must be supplied.
    await rejects(
      "select register_rider_with_details($1,'Sam K.',2014,null,'{}'::jsonb)",
      [club],
      '22023'
    );
    // Unknown field ids and over-long values are rejected.
    await rejects(
      'select register_rider_with_details($1,$2,2014,null,$3::jsonb)',
      [club, 'Sam K.', JSON.stringify({ [kit]: 'M', '11111111-1111-4111-8111-111111111111': 'x' })],
      '22023'
    );
    await rejects(
      'select register_rider_with_details($1,$2,2014,null,$3::jsonb)',
      [club, 'Sam K.', JSON.stringify({ [kit]: 'x'.repeat(101) })],
      '22023'
    );
    const sam = await value('select register_rider_with_details($1,$2,2014,null,$3::jsonb)', [
      club,
      'Sam K.',
      JSON.stringify({ [kit]: 'M', [licence]: '' })
    ]);
    assert.equal(
      await value('select count(*)::int from rider_field_values where rider_id=$1', [sam]),
      1
    );

    // Editing fills in details for an existing rider; empty values clear a field.
    await value('select update_rider_details($1,$2,2013,null,$3::jsonb)', [
      existing,
      'Existing rider',
      JSON.stringify({ [kit]: 'S', [licence]: '123456' })
    ]);
    assert.equal(await value('select birth_year from riders where id=$1', [existing]), 2013);
    await value('select update_rider_details($1,$2,2013,null,$3::jsonb)', [
      existing,
      'Existing rider',
      JSON.stringify({ [kit]: 'S', [licence]: '' })
    ]);
    assert.equal(
      await value('select count(*)::int from rider_field_values where rider_id=$1', [existing]),
      1
    );

    // Removing a field archives it: values are kept but no longer shown or required.
    await value('select remove_rider_field($1)', [kit]);
    assert.equal(
      await value('select count(*)::int from rider_field_values where field_id=$1', [kit]),
      2
    );
    assert.deepEqual((await value('select club_roster($1)', [club])).fieldValues, []);
    const ellis = await value("select register_rider_with_details($1,'Ellis M.',2015)", [club]);
    assert.ok(ellis);
    assert.equal((await value('select rider_settings($1)', [club])).fields.length, 1);

    // A rule that needs a full date of birth: date required, and year derived from it.
    await rejects(
      "select update_rider_settings($1,'season_31_aug',14,12,'initials')",
      [club],
      '22023'
    );
    await value("select update_rider_settings($1,'season_31_aug',13,18,'initials')", [club]);
    await rejects("select register_rider_with_details($1,'Mia D.',2014)", [club], '22023');
    await rejects(
      "select register_rider_with_details($1,'Mia D.',2013,'2014-03-01')",
      [club],
      '22023'
    );
    const mia = await value("select register_rider_with_details($1,'Mia D.',null,'2014-03-01')", [
      club
    ]);
    assert.equal(await value('select birth_year from riders where id=$1', [mia]), 2014);
    // Saving identical settings again is not audited twice.
    await value("select update_rider_settings($1,'season_31_aug',13,18,'initials')", [club]);
    assert.equal(
      await value(
        "select count(*)::int from club_audit where club_id=$1 and action='rider_settings_updated'",
        [club]
      ),
      1
    );

    // Archived riders cannot be edited.
    await value('select archive_rider($1)', [ellis]);
    await rejects("select update_rider_details($1,'Ellis M.',2015,null)", [ellis], '22023');

    // Other accounts cannot read or change any of it, directly or through the RPCs.
    await user(outsider);
    await rejects('select rider_settings($1)', [club], '42501');
    await rejects("select update_rider_settings($1,'none',13,18,'lane')", [club], '42501');
    await rejects("select save_rider_field($1,null,'Sneaky',false)", [club], '42501');
    await rejects('select remove_rider_field($1)', [licence], '42501');
    await rejects("select register_rider_with_details($1,'Intruder',2014)", [club], '42501');
    await rejects("select update_rider_details($1,'Renamed',2014,null)", [alex], '42501');
    for (const table of ['club_rider_settings', 'club_rider_fields', 'rider_field_values'])
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0, table);
    await rejects(
      'insert into rider_field_values(rider_id,field_id,club_id,value) values($1,$2,$3,$4)',
      [alex, licence, club, 'x'],
      '42501'
    );
    await rejects('select private.check_rider_details($1,2014,null,null)', [club], '42501');
  } finally {
    await db.close();
  }
});
