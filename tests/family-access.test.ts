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
  '202611230010_club_admission.sql',
  '202611240011_rider_details.sql',
  '202611240012_family_access.sql'
];

test('family access: age bands, single-use invitations, per-child links and read-only views', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3, 4, 5, 6].map(
    (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
  );
  const [admin, parent, teen, otherParent, outsider, unconfirmed] = ids;
  const email = (id: string) => id.slice(-1) + '@example.test';
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
  const year = new Date().getUTCFullYear();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of ids)
      await db.query('insert into auth.users values($1,$2,$3)', [
        id,
        email(id),
        id === unconfirmed ? null : new Date().toISOString()
      ]);
    for (const file of migrations.slice(0, 9))
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(admin);
    const club = await value("select create_club('Riverside test club')");
    await db.exec('reset role');
    for (const file of migrations.slice(9))
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );

    await user(admin);
    const register = (name: string, born: number) =>
      value("select register_rider_with_details($1,$2,$3,null,'{}'::jsonb,$4)", [
        club,
        name,
        born,
        name === 'Child A' ? '001122AB' : null
      ]);
    const childA = await register('Child A', year - 9);
    const childB = await register('Child B', year - 11);
    const teenRider = await register('Teen Rider', year - 15);
    const adult = await register('Adult Rider', year - 30);
    // Born 13 years ago by year only: might still be 12, so guardian only.
    const borderline = await register('Borderline', year - 13);

    const kinds = async (rider: string) =>
      (await value('select rider_access($1)', [rider])).allowedKinds;
    assert.deepEqual(await kinds(childA), ['guardian']);
    assert.deepEqual(await kinds(borderline), ['guardian']);
    assert.deepEqual(await kinds(teenRider), ['guardian', 'rider']);
    assert.deepEqual(await kinds(adult), ['rider']);

    const invite = (rider: string, to: string, kind: string, checked = true) =>
      value('select invite_rider_access($1,$2,$3,$4)', [rider, to, kind, checked]);
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [childA, 'x@example.test', 'rider', true],
      '23514'
    );
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [adult, 'x@example.test', 'guardian', true],
      '23514'
    );
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [childA, email(parent), 'guardian', false],
      '22023'
    );
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [childA, 'not-an-email', 'guardian', true],
      '22023'
    );

    const invA = await invite(childA, ' ' + email(parent).toUpperCase(), 'guardian');
    const invB = await invite(childB, email(parent), 'guardian');
    const invTeen = await invite(teenRider, email(teen), 'rider');
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [childA, email(parent), 'guardian', true],
      '23505'
    );

    // Only the club admin may invite or read access; other accounts see nothing.
    await user(outsider);
    await rejects('select rider_access($1)', [childA], '42501');
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [childA, email(outsider), 'guardian', true],
      '42501'
    );
    assert.equal((await db.query('select * from rider_invitations')).rows.length, 0);
    await rejects('select respond_rider_invitation($1,true)', [invA], '42501');
    assert.deepEqual(await value('select my_workspaces()'), []);

    await user(unconfirmed);
    await rejects('select respond_rider_invitation($1,true)', [invA], '42501');

    // The guardian sees invitations for their email only, then accepts each child separately.
    await user(parent);
    let mine = await value('select my_rider_workspace()');
    assert.equal(mine.invitations.length, 2);
    assert.deepEqual(mine.riders, []);
    assert.equal((await value('select my_workspaces()'))[0].href, '/riders');
    await db.query('select respond_rider_invitation($1,true)', [invA]);
    await rejects('select respond_rider_invitation($1,true)', [invA], '22023');
    mine = await value('select my_rider_workspace()');
    assert.equal(mine.riders.length, 1);
    assert.equal(mine.riders[0].display_name, 'Child A');
    assert.equal(mine.riders[0].kind, 'guardian');
    assert.equal(mine.riders[0].has_tag, true);
    assert.equal(mine.riders[0].scoreboard_name, 'first_initial');
    assert.equal(JSON.stringify(mine).includes('001122AB'), false, 'tag UID never shown');
    await db.query('select respond_rider_invitation($1,true)', [invB]);
    assert.equal((await value('select my_rider_workspace()')).riders.length, 2);

    // Guardians cannot read the register or another family's child directly.
    assert.equal((await db.query('select * from riders')).rows.length, 0);
    await rejects('select set_rider_scoreboard_name($1,$2)', [teenRider, 'initials'], '42501');
    await rejects('select request_rider_correction($1,$2)', [teenRider, 'Wrong'], '42501');

    // Scoreboard name and corrections for a linked child.
    await db.query("select set_rider_scoreboard_name($1,'lane')", [childA]);
    await rejects("select set_rider_scoreboard_name($1,'full')", [childA], '22023');
    mine = await value('select my_rider_workspace()');
    const a = mine.riders.find((r: any) => r.rider_id === childA);
    assert.equal(a.scoreboard_name, 'lane');
    assert.equal(a.scoreboard_chosen, true);
    for (let i = 0; i < 3; i++)
      await value('select request_rider_correction($1,$2)', [
        childA,
        'Year of birth is wrong ' + i
      ]);
    await rejects('select request_rider_correction($1,$2)', [childA, 'Again'], '23514');
    await rejects('select request_rider_correction($1,$2)', [childA, '   '], '22023');

    // The teen accepts their own invitation; a second "this is me" link is refused.
    await user(teen);
    await db.query('select respond_rider_invitation($1,true)', [invTeen]);
    await user(admin);
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [teenRider, email(otherParent), 'rider', true],
      '23505'
    );
    const invAdultToTeen = await invite(adult, email(teen), 'rider');
    await user(teen);
    await rejects('select respond_rider_invitation($1,true)', [invAdultToTeen], '23505');
    await db.query('select respond_rider_invitation($1,false)', [invAdultToTeen]);
    await rejects('select respond_rider_invitation($1,true)', [invAdultToTeen], '22023');
    mine = await value('select my_rider_workspace()');
    assert.deepEqual(
      mine.riders.map((r: any) => [r.display_name, r.kind]),
      [['Teen Rider', 'rider']]
    );

    // Admin view: links, corrections and resolving them.
    await user(admin);
    let access = await value('select rider_access($1)', [childA]);
    assert.equal(access.links.length, 1);
    assert.equal(access.links[0].email, email(parent));
    assert.equal(access.corrections.length, 3);
    assert.equal((await value('select club_correction_requests($1)', [club])).length, 3);
    await db.query('select resolve_rider_correction($1)', [access.corrections[0].id]);
    assert.equal((await value('select club_correction_requests($1)', [club])).length, 2);

    // Expired invitations cannot be accepted; renewing gives seven more days.
    const invOther = await invite(childA, email(otherParent), 'guardian');
    await db.exec('reset role');
    await db.query(
      "update rider_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [invOther]
    );
    await user(otherParent);
    assert.deepEqual((await value('select my_rider_workspace()')).invitations, []);
    await rejects('select respond_rider_invitation($1,true)', [invOther], '22023');
    await user(admin);
    access = await value('select rider_access($1)', [childA]);
    assert.equal(access.invitations.find((i: any) => i.id === invOther).status, 'expired');
    await db.query('select renew_rider_invitation($1)', [invOther]);
    await db.query('select revoke_rider_invitation($1)', [invOther]);
    await user(otherParent);
    await rejects('select respond_rider_invitation($1,true)', [invOther], '22023');

    // Removing one child's link leaves the other untouched.
    await user(admin);
    await db.query('select remove_rider_link($1)', [access.links[0].id]);
    await user(parent);
    mine = await value('select my_rider_workspace()');
    assert.deepEqual(
      mine.riders.map((r: any) => r.display_name),
      ['Child B']
    );
    await rejects("select set_rider_scoreboard_name($1,'initials')", [childA], '42501');
    // A guardian can step back from a link themselves.
    await db.query('select remove_rider_link($1)', [mine.riders[0].link_id]);
    assert.deepEqual((await value('select my_rider_workspace()')).riders, []);
    assert.deepEqual(await value('select my_workspaces()'), []);

    // Archiving a rider hides them and blocks new invitations.
    await user(admin);
    await db.query('select archive_rider($1)', [teenRider]);
    await rejects(
      'select invite_rider_access($1,$2,$3,$4)',
      [teenRider, email(otherParent), 'guardian', true],
      '22023'
    );
    await user(teen);
    assert.deepEqual((await value('select my_rider_workspace()')).riders, []);

    // Everything is in the club history.
    await db.exec('reset role');
    const actions = (await db.query<{ action: string }>('select action from club_audit')).rows.map(
      (r) => r.action
    );
    for (const action of [
      'rider_access_invited',
      'rider_invitation_accepted',
      'rider_invitation_declined',
      'rider_invitation_renewed',
      'rider_invitation_revoked',
      'rider_link_removed',
      'rider_scoreboard_name_set',
      'rider_correction_requested',
      'rider_correction_resolved'
    ])
      assert.ok(actions.includes(action), action);
  } finally {
    await db.close();
  }
});
