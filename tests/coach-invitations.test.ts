import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { emailAddress, uuid } from '../src/lib/coaches';

test('coach form validation normalises email and rejects bad identifiers', () => {
  assert.equal(emailAddress(' COACH@example.test '), 'coach@example.test');
  for (const value of [null, 'bad', 'x y@example.test', 'x'.repeat(255) + '@a.test'])
    assert.equal(emailAddress(value), null);
  assert.equal(uuid('broken'), false);
  assert.equal(uuid('00000000-0000-0000-0000-000000000001'), true);
});
test('coach invitations enforce verified identity, lifecycle, scope and permissions', async (t) => {
  const db = new PGlite();
  const ids = Array.from(
    { length: 6 },
    (_, i) => '00000000-0000-0000-0000-' + String(i + 1).padStart(12, '0')
  );
  const [a, b, coach, wrong, unconfirmed, fresh] = ids;
  const emails = [
    'admin-a@example.test',
    'admin-b@example.test',
    'coach@example.test',
    'wrong@example.test',
    'unconfirmed@example.test',
    'fresh@example.test'
  ];
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const user = async (id: string) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const denied = async (sql: string, args: unknown[] = [], code = '42501') =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === code);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (let i = 0; i < ids.length; i++)
      await db.query('insert into auth.users values($1,$2,$3)', [
        ids[i],
        emails[i],
        i === 4 ? null : new Date()
      ]);
    for (const file of [
      '202611190001_club_registry.sql',
      '202611200002_club_workspace.sql',
      '202611210003_coach_invitations.sql'
    ])
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(a);
    const clubA = await value("select create_club('A club')");
    await value("select register_rider($1,'Private rider','001122AB')", [clubA]);
    const invitation = await value("select invite_coach($1,' COACH@EXAMPLE.TEST ')", [clubA]);
    await user(b);
    const clubB = await value("select create_club('B club')");
    await t.test('only own admin can create/list/revoke invitations', async () => {
      await denied("select invite_coach($1,'another@example.test')", [clubA]);
      await denied('select club_coaches($1)', [clubA]);
      await denied('select revoke_coach_invitation($1,$2)', [clubA, invitation]);
      assert.equal((await db.query('select * from coach_invitations')).rows.length, 0);
      await user(a);
      await denied("select invite_coach($1,'coach@example.test')", [clubA], '23505');
      await denied("select invite_coach($1,'admin-a@example.test')", [clubA], '23505');
      await denied("update coach_invitations set status='accepted'");
    });
    await t.test(
      'wrong and unconfirmed users cannot accept or inspect invitation details',
      async () => {
        await user(wrong);
        assert.equal((await value('select my_coach_workspace()')).invitations.length, 0);
        await denied('select respond_coach_invitation($1,true)', [invitation]);
        await user(a);
        const unverified = await value("select invite_coach($1,'unconfirmed@example.test')", [
          clubA
        ]);
        await user(unconfirmed);
        const inbox = await value('select my_coach_workspace()');
        assert.equal(inbox.emailConfirmed, false);
        assert.equal(inbox.invitations.length, 0);
        await denied('select respond_coach_invitation($1,true)', [unverified]);
      }
    );
    await t.test(
      'acceptance creates coach link only, never roster or admin access; replay fails',
      async () => {
        await user(coach);
        assert.equal((await value('select my_coach_workspace()')).invitations[0].id, invitation);
        await db.query('select respond_coach_invitation($1,true)', [invitation]);
        const workspace = await value('select my_coach_workspace()');
        assert.equal(workspace.clubs[0].name, 'A club');
        assert.equal(workspace.invitations.length, 0);
        assert.equal(
          await value('select role from club_memberships where club_id=$1', [clubA]),
          'coach'
        );
        for (const table of [
          'riders',
          'tag_assignments',
          'club_audit',
          'clubs',
          'coach_invitations'
        ])
          assert.equal((await db.query('select * from ' + table)).rows.length, 0, table);
        for (const sql of [
          'select club_overview($1)',
          'select club_roster($1)',
          "select update_club_settings($1,'Hijack','mph')",
          'select club_coaches($1)',
          "select invite_coach($1,'other@example.test')"
        ])
          await denied(sql, [clubA]);
        await denied("update club_memberships set role='admin'");
        await denied('select respond_coach_invitation($1,true)', [invitation], '22023');
      }
    );
    await t.test(
      'several club links work; removal affects only specified club and old invite cannot restore it',
      async () => {
        await user(b);
        const second = await value("select invite_coach($1,'coach@example.test')", [clubB]);
        await user(coach);
        await db.query('select respond_coach_invitation($1,true)', [second]);
        assert.equal((await value('select my_coach_workspace()')).clubs.length, 2);
        await user(a);
        await db.query('select remove_coach($1,$2)', [clubA, coach]);
        await denied('select remove_coach($1,$2)', [clubA, a], '22023');
        await user(coach);
        const links = (await value('select my_coach_workspace()')).clubs;
        assert.equal(links.length, 1);
        assert.equal(links[0].id, clubB);
        await denied('select respond_coach_invitation($1,true)', [invitation], '22023');
      }
    );
    await t.test(
      'revoked, declined and expired invitations cannot be accepted; fresh invite can be issued',
      async () => {
        await user(a);
        const revoked = await value("select invite_coach($1,'coach@example.test')", [clubA]);
        await db.query('select revoke_coach_invitation($1,$2)', [clubA, revoked]);
        await user(coach);
        await denied('select respond_coach_invitation($1,true)', [revoked], '22023');
        await user(a);
        const declined = await value("select invite_coach($1,'coach@example.test')", [clubA]);
        await user(coach);
        await db.query('select respond_coach_invitation($1,false)', [declined]);
        await denied('select respond_coach_invitation($1,true)', [declined], '22023');
        await user(a);
        const expired = await value("select invite_coach($1,'coach@example.test')", [clubA]);
        await db.exec('reset role');
        await db.query(
          "update coach_invitations set expires_at=now()-interval '1 second' where id=$1",
          [expired]
        );
        await user(coach);
        await denied('select respond_coach_invitation($1,true)', [expired], '22023');
        await user(a);
        const replacement = await value("select invite_coach($1,'coach@example.test')", [clubA]);
        assert.notEqual(expired, replacement);
      }
    );
    await t.test(
      'fresh confirmed email is required even when JWT email would still match',
      async () => {
        await user(a);
        const target = await value("select invite_coach($1,'fresh@example.test')", [clubA]);
        await db.exec('reset role');
        await db.query("update auth.users set email='changed@example.test' where id=$1", [fresh]);
        await user(fresh);
        await denied('select respond_coach_invitation($1,true)', [target]);
        assert.equal((await value('select my_coach_workspace()')).invitations.length, 0);
      }
    );
    await t.test('invitation history pagination preserves all entries', async () => {
      await user(a);
      for (let i = 0; i < 27; i++)
        await value('select invite_coach($1,$2)', [clubA, `invite${i}@example.test`]);
      const first = await value('select club_coaches($1,1,1)', [clubA]);
      const second = await value('select club_coaches($1,1,2)', [clubA]);
      assert.equal(first.invitations.length, 25);
      assert.ok(second.invitations.length > 0);
      assert.equal(
        new Set([...first.invitations, ...second.invitations].map((i) => i.id)).size,
        first.inviteTotal
      );
    });
    await t.test(
      'revoked issuing admin invalidates pending invitation and anonymous execution is denied',
      async () => {
        await user(b);
        const pending = await value("select invite_coach($1,'wrong@example.test')", [clubB]);
        await db.exec('reset role');
        await db.query('delete from club_memberships where club_id=$1 and user_id=$2', [clubB, b]);
        await user(wrong);
        await denied('select respond_coach_invitation($1,true)', [pending], '22023');
        assert.equal((await value('select my_coach_workspace()')).invitations.length, 0);
        await db.exec('reset role;set role anon');
        for (const sql of [
          'select my_coach_workspace()',
          'select club_coaches($1)',
          'select respond_coach_invitation($1,true)'
        ])
          await denied(sql, sql.includes('$1') ? [pending] : []);
      }
    );
  } finally {
    await db.close();
  }
});
