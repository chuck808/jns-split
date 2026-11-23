import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { rememberedWorkspace } from '../src/lib/workspaces';
import { load, actions } from '../src/routes/app/+page.server';

const items = [
  {
    key: 'admin:club',
    label: 'Manage club',
    description: 'Club administration',
    href: '/club/club'
  },
  { key: 'coach', label: 'Coach', description: 'Sessions', href: '/coach' }
];
test('workspace selection is account-bound and always revalidated', async () => {
  assert.equal(rememberedWorkspace('user|coach', 'user', items)?.href, '/coach');
  assert.equal(rememberedWorkspace('other|coach', 'user', items), undefined);
  assert.equal(rememberedWorkspace('user|https://evil.test', 'user', items), undefined);
  assert.equal(rememberedWorkspace('user|coach', 'user', items.slice(0, 1)), undefined);
  const event = (available = items, raw = 'user|coach', choose = false) => ({
    locals: {
      user: { id: 'user', email: 'test@example.test' },
      supabase: {
        rpc: async (name: string) => {
          assert.equal(name, 'my_workspaces');
          return { data: available, error: null };
        }
      }
    },
    cookies: {
      get: () => raw,
      set: (name: string, value: string, options: any) => {
        assert.equal(name, 'workspace');
        assert.equal(value, 'user|coach');
        assert.equal(options.httpOnly, true);
        assert.equal(options.secure, true);
      }
    },
    url: new URL('https://app.test/app' + (choose ? '?choose=1' : '')),
    request: new Request('https://app.test/app', {
      method: 'POST',
      body: new URLSearchParams({ workspace: 'coach', href: 'https://evil.test' })
    })
  });
  await assert.rejects(
    load(event() as any) as Promise<unknown>,
    (e: any) => e.status === 303 && e.location === '/coach'
  );
  await assert.rejects(
    load(event(items.slice(0, 1), 'other|coach') as any) as Promise<unknown>,
    (e: any) => e.status === 303 && e.location === '/club/club'
  );
  assert.equal(((await load(event(items, '', true) as any)) as any).items.length, 2);
  assert.equal(((await load(event([], 'user|coach') as any)) as any).items.length, 0);
  await assert.rejects(
    actions.default!(event() as any) as Promise<unknown>,
    (e: any) => e.status === 303 && e.location === '/coach'
  );
  assert.equal(((await actions.default!(event([]) as any)) as any).status, 400);
});

test('independent roles migrate safely, preserve admin access and never revive removed coach grants', async () => {
  const db = new PGlite();
  const [admin, coach, other, pending, empty] = [1, 2, 3, 4, 5].map(
    (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
  );
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
    for (const id of [admin, coach, other, pending, empty])
      await db.query('insert into auth.users values($1,$2,now())', [id, id + '@example.test']);
    for (const file of [
      '202611190001_club_registry.sql',
      '202611200002_club_workspace.sql',
      '202611210003_coach_invitations.sql',
      '202611210004_session_planning.sql',
      '202611210005_session_participants.sql',
      '202611210006_session_activity.sql',
      '202611210007_bench_devices.sql',
      '202611220008_bench_monitor.sql'
    ])
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(admin);
    const club = await value("select create_club('Original club')");
    const rider = await value("select register_rider($1,'Alex test','001122AB')", [club]);
    const session = await value(
      "select create_training_session($1,'Original session',null,20,'flying',2)",
      [club]
    );
    const invite = await value('select invite_coach($1,$2)', [club, coach + '@example.test']);
    await user(coach);
    await db.query('select respond_coach_invitation($1,true)', [invite]);
    await user(admin);
    await db.query('select assign_session_coach($1,$2,true)', [session, coach]);
    const pendingInvite = await value('select invite_coach($1,$2)', [
      club,
      pending + '@example.test'
    ]);
    await user(other);
    const otherClub = await value("select create_club('Other club')");
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611220009_workspaces_and_roles.sql', import.meta.url),
        'utf8'
      )
    );
    await user(admin);
    assert.equal(await value('select private.is_club_admin($1)', [club]), true);
    assert.equal(
      await value('select uid from tag_assignments where rider_id=$1', [rider]),
      '001122AB'
    );
    assert.equal((await value('select my_workspaces()')).length, 1);
    assert.equal((await value('select my_workspaces()'))[0].href, '/club/' + club);
    await user(coach);
    assert.equal((await value('select training_session_detail($1)', [session])).canManage, true);
    assert.equal((await value('select my_workspaces()'))[0].href, '/coach');
    assert.equal((await value('select list_training_sessions()')).total, 1);
    await denied("insert into club_membership_roles(club_id,user_id,role) values($1,$2,'admin')", [
      club,
      coach
    ]);
    await denied("update club_membership_roles set role='admin' where user_id=$1", [coach]);
    await denied('delete from club_membership_roles where user_id=$1', [coach]);
    assert.equal(
      (await db.query('select * from club_membership_roles where user_id=$1', [admin])).rows.length,
      0
    );
    await user(pending);
    assert.equal((await value('select my_workspaces()'))[0].key, 'coach');
    await db.query('select respond_coach_invitation($1,false)', [pendingInvite]);
    assert.deepEqual(await value('select my_workspaces()'), []);
    await user(empty);
    assert.deepEqual(await value('select my_workspaces()'), []);
    const freshClub = await value("select create_club('Fresh pilot club')");
    assert.equal(await value('select private.is_club_admin($1)', [freshClub]), true);
    await user(admin);
    const selfInvite = await value('select invite_coach($1,$2)', [club, admin + '@example.test']);
    await db.query('select respond_coach_invitation($1,true)', [selfInvite]);
    assert.equal((await value('select my_workspaces()')).length, 2);
    assert.equal((await value('select club_coaches($1)', [club])).total, 2);
    await db.query('select assign_session_coach($1,$2,true)', [session, admin]);
    assert.equal((await value('select list_training_sessions()')).total, 1);
    await db.query('select remove_coach($1,$2)', [club, admin]);
    assert.equal(await value('select private.is_club_admin($1)', [club]), true);
    assert.equal((await value('select my_workspaces()')).length, 1);
    assert.equal(
      (await db.query('select * from session_coaches where coach_user_id=$1', [admin])).rows.length,
      0
    );
    assert.equal(
      (await db.query('select * from club_memberships where user_id=$1', [admin])).rows.length,
      1
    );
    const again = await value('select invite_coach($1,$2)', [club, admin + '@example.test']);
    await db.query('select respond_coach_invitation($1,true)', [again]);
    assert.equal((await value('select list_training_sessions()')).total, 0);
    // Revoke only the admin role as the operator to prove stale legacy role does not grant access.
    await db.exec('reset role');
    await db.query(
      "delete from club_membership_roles where club_id=$1 and user_id=$2 and role='admin'",
      [club, admin]
    );
    await user(admin);
    assert.equal(await value('select private.is_club_admin($1)', [club]), false);
    assert.equal((await value('select my_workspaces()')).length, 1);
    await denied('select training_session_detail($1)', [session]);
    await denied('select register_rider($1,$2)', [club, 'Not allowed']);
    // Restore original admin role only for the remaining regression checks.
    await db.exec('reset role');
    await db.query(
      "insert into club_membership_roles(club_id,user_id,role) values($1,$2,'admin')",
      [club, admin]
    );
    await user(admin);
    await db.query('select remove_coach($1,$2)', [club, coach]);
    await user(coach);
    assert.deepEqual(await value('select my_workspaces()'), []);
    await denied('select training_session_detail($1)', [session]);
    await user(admin);
    const reInvite = await value('select invite_coach($1,$2)', [club, coach + '@example.test']);
    await user(coach);
    await db.query('select respond_coach_invitation($1,true)', [reInvite]);
    await denied('select training_session_detail($1)', [session]);
    await user(other);
    assert.equal((await value('select my_workspaces()'))[0].href, '/club/' + otherClub);
    await denied('select remove_coach($1,$2)', [club, coach]);
    await db.exec('reset role;set role anon');
    await denied('select my_workspaces()');
  } finally {
    await db.close();
  }
});
