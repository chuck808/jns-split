import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { sessionInput, sessionFilters } from '../src/lib/training-sessions';
const form = (overrides: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    name: 'Practice',
    distance: '20',
    mode: 'standing',
    lanes: '4',
    scheduled: '2026-11-21T16:00',
    ...overrides
  }))
    f.set(k, v);
  return f;
};
test('session validation handles UTC scheduling and rejects invalid configuration', () => {
  assert.equal(sessionInput(form()).p_scheduled_at, '2026-11-21T16:00:00.000Z');
  assert.equal(sessionInput(form({ scheduled: '' })).p_scheduled_at, null);
  const invalidInputs: Record<string, string>[] = [
    { distance: 'NaN' },
    { distance: '0' },
    { distance: 'Infinity' },
    { lanes: '2.5' },
    { lanes: '9' },
    { mode: 'bogus' },
    { scheduled: '2026-02-30T12:00' },
    { scheduled: '2026-01-01T25:00' },
    { name: '' }
  ];
  for (const override of invalidInputs) assert.throws(() => sessionInput(form(override)));
  assert.deepEqual(sessionFilters(new URLSearchParams('status=bad&page=-9')), {
    status: 'planned',
    page: 1
  });
});
test('session grants constrain visibility, editing, transitions and removal', async (t) => {
  const db = new PGlite();
  const [admin, other, coach, viewer] = [1, 2, 3, 4].map(
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
  const create = (club: string, name: string) =>
    value("select create_training_session($1,$2,null,20,'standing',4)", [club, name]);
  const update = (id: string, version: number) =>
    db.query("select update_training_session($1,$2,'Updated',null,30,'flying',2)", [id, version]);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [admin, other, coach, viewer])
      await db.query('insert into auth.users values($1,$2,now())', [id, id + '@example.test']);
    for (const file of [
      '202611190001_club_registry.sql',
      '202611200002_club_workspace.sql',
      '202611210003_coach_invitations.sql',
      '202611210004_session_planning.sql'
    ])
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    await user(admin);
    const club = await value("select create_club('Club A')");
    await value("select register_rider($1,'Private rider','001122AB')", [club]);
    const s1 = await create(club, 'Session 1');
    const hidden = await create(club, 'Not assigned');
    for (const id of [coach, viewer]) {
      const invitation = await value('select invite_coach($1,$2)', [club, id + '@example.test']);
      await user(id);
      await db.query('select respond_coach_invitation($1,true)', [invitation]);
      await user(admin);
    }
    await user(other);
    const otherClub = await value("select create_club('Club B')");
    const otherSession = await create(otherClub, 'Other club session');
    await t.test('unassigned coaches and other admins cannot view or mutate sessions', async () => {
      await denied('select training_session_detail($1)', [s1]);
      await denied('select list_training_sessions($1)', [club]);
      await denied("select create_training_session($1,'Intruder',null,20,'standing',4)", [club]);
      await user(coach);
      assert.equal((await value('select list_training_sessions()')).total, 0);
      assert.equal((await db.query('select * from training_sessions')).rows.length, 0);
      await denied('select training_session_detail($1)', [s1]);
      await denied('select assign_session_coach($1,$2,true)', [s1, coach]);
    });
    await t.test(
      'view grant reveals only assigned session and never riders or other coaches',
      async () => {
        await user(admin);
        await db.query('select assign_session_coach($1,$2,false)', [s1, viewer]);
        await db.query('select assign_session_coach($1,$2,true)', [s1, coach]);
        await denied('select assign_session_coach($1,$2,true)', [otherSession, coach]);
        await denied('select assign_session_coach($1,$2,true)', [s1, other], '22023');
        await user(viewer);
        const detail = await value('select training_session_detail($1)', [s1]);
        assert.equal(detail.canManage, false);
        assert.equal(detail.isAdmin, false);
        assert.equal(detail.coaches.length, 0);
        assert.equal((await value('select list_training_sessions()')).total, 1);
        assert.equal((await db.query('select * from riders')).rows.length, 0);
        assert.equal((await db.query('select * from session_coaches')).rows.length, 1);
        await denied('select training_session_detail($1)', [hidden]);
        await assert.rejects(update(s1, 1), (e: any) => e.code === '42501');
        await denied("select finish_training_session($1,1,'closed')", [s1]);
        await denied('update session_coaches set can_manage=true');
      }
    );
    await t.test(
      'editing grant supports planning but rejects stale updates and grant administration',
      async () => {
        await user(coach);
        await update(s1, 1);
        const detail = await value('select training_session_detail($1)', [s1]);
        assert.equal(detail.session.version, 2);
        assert.equal(Number(detail.session.distance_metres), 30);
        await assert.rejects(update(s1, 1), (e: any) => e.code === '40001');
        await denied('select remove_session_coach($1,$2)', [s1, viewer]);
        await denied('select assign_session_coach($1,$2,true)', [s1, viewer]);
        await denied("update training_sessions set name='Bypass' where id=$1", [s1]);
      }
    );
    await t.test(
      'downgrade and removal take effect immediately; re-invitation does not restore old grants',
      async () => {
        await user(admin);
        await db.query('select assign_session_coach($1,$2,false)', [s1, coach]);
        await user(coach);
        await assert.rejects(update(s1, 2), (e: any) => e.code === '42501');
        await user(admin);
        await db.query('select remove_coach($1,$2)', [club, coach]);
        await user(coach);
        await denied('select training_session_detail($1)', [s1]);
        await user(admin);
        const invite = await value('select invite_coach($1,$2)', [club, coach + '@example.test']);
        await user(coach);
        await db.query('select respond_coach_invitation($1,true)', [invite]);
        assert.equal((await value('select list_training_sessions()')).total, 0);
        await user(admin);
        await db.query('select remove_session_coach($1,$2)', [s1, viewer]);
        await user(viewer);
        await denied('select training_session_detail($1)', [s1]);
      }
    );
    await t.test('closed/cancelled configurations cannot be changed or reopened', async () => {
      await user(admin);
      await db.query("select finish_training_session($1,2,'closed')", [s1]);
      await assert.rejects(update(s1, 3), (e: any) => e.code === '22023');
      await denied("select finish_training_session($1,3,'planned')", [s1], '22023');
      await denied('select assign_session_coach($1,$2,true)', [s1, coach], '22023');
      await db.query("select finish_training_session($1,1,'cancelled')", [hidden]);
      await assert.rejects(update(hidden, 2), (e: any) => e.code === '22023');
      assert.equal((await value("select list_training_sessions($1,'closed')", [club])).total, 1);
    });
    await t.test(
      'pagination spans all sessions and invalid values are rejected at the database',
      async () => {
        for (let i = 0; i < 27; i++) await create(club, 'Plan ' + i);
        const p1 = await value("select list_training_sessions($1,'planned',1)", [club]);
        const p2 = await value("select list_training_sessions($1,'planned',2)", [club]);
        assert.equal(p1.total, 27);
        assert.equal(p1.items.length, 25);
        assert.equal(p2.items.length, 2);
        assert.equal(new Set([...p1.items, ...p2.items].map((s) => s.id)).size, 27);
        await denied(
          "select create_training_session($1,'Bad',null,0,'standing',4)",
          [club],
          '22023'
        );
        await denied(
          "select create_training_session($1,'Bad','infinity',20,'standing',4)",
          [club],
          '23514'
        );
      }
    );
    await t.test('anonymous users cannot read or invoke session APIs', async () => {
      await db.exec('reset role;set role anon');
      await denied('select * from training_sessions');
      await denied('select training_session_detail($1)', [s1]);
      await denied('select list_training_sessions()');
    });
  } finally {
    await db.close();
  }
});
