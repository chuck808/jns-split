import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { sessionActivity } from '../src/lib/training-sessions';

test('activity input is explicit and separate from start type', () => {
  assert.equal(sessionActivity('free_ride'), 'free_ride');
  assert.equal(sessionActivity('coached'), 'coached');
  for (const value of [null, '', 'flying', 'public']) assert.throws(() => sessionActivity(value));
});
test('saved free ride preserves data, restricts admission changes, and rejects manual enrolment', async () => {
  const db = new PGlite();
  const [admin, coach, other] = [1, 2, 3].map(
    (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
  );
  const value = async (sql: string, args: unknown[] = []) =>
    Object.values((await db.query<Record<string, any>>(sql, args)).rows[0])[0];
  const user = async (id: string) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const denied = async (sql: string, args: unknown[], code = '42501') =>
    assert.rejects(db.query(sql, args), (e: any) => e.code === code);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [admin, coach, other])
      await db.query('insert into auth.users values($1,$2,now())', [id, id + '@example.test']);
    for (const file of [
      '202611190001_club_registry.sql',
      '202611200002_club_workspace.sql',
      '202611210003_coach_invitations.sql',
      '202611210004_session_planning.sql',
      '202611210005_session_participants.sql'
    ]) {
      await db.exec(
        await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
      );
    }
    await user(admin);
    const club = await value("select create_club('Test club')");
    const rider = await value("select register_rider($1,'Jamie808','001122AB')", [club]);
    const existing = await value(
      "select create_training_session($1,'Existing',null,20,'standing',2)",
      [club]
    );
    await db.query('select add_session_participant($1,$2,1)', [existing, rider]);
    const invitation = await value('select invite_coach($1,$2)', [club, coach + '@example.test']);
    await user(coach);
    await db.query('select respond_coach_invitation($1,true)', [invitation]);
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611210006_session_activity.sql', import.meta.url),
        'utf8'
      )
    );
    await user(admin);
    assert.equal(
      await value('select activity from training_sessions where id=$1', [existing]),
      'coached'
    );
    assert.equal((await value('select list_session_participants($1)', [existing])).total, 1);
    await denied("select set_session_activity($1,2,'free_ride')", [existing], '22023');
    assert.equal(
      await value('select uid from tag_assignments where rider_id=$1', [rider]),
      '001122AB'
    );
    const free = await value(
      "select create_session_plan($1,'Open practice',null,20,'flying',2,'free_ride')",
      [club]
    );
    assert.equal(
      (await value('select training_session_detail($1)', [free])).session.activity,
      'free_ride'
    );
    assert.equal(
      (await value('select list_training_sessions($1)', [club])).items.find(
        (s: any) => s.id === free
      ).activity,
      'free_ride'
    );
    await denied('select add_session_participant($1,$2,1)', [free, rider], '22023');
    await denied('select remove_session_participant($1,$2,1)', [free, rider], '22023');
    await denied('select session_participant_candidates($1)', [free], '22023');
    await denied("select create_session_plan($1,'Bad',null,20,'standing',2,null)", [club], '22023');
    await db.query('select assign_session_coach($1,$2,true)', [free, coach]);
    await user(coach);
    assert.equal(
      (await value('select training_session_detail($1)', [free])).session.activity,
      'free_ride'
    );
    assert.equal((await value('select list_session_participants($1)', [free])).total, 0);
    await denied("select set_session_activity($1,1,'coached')", [free]);
    await denied("select create_session_plan($1,'Bad',null,20,'standing',2,'free_ride')", [club]);
    await db.query("select update_training_session($1,1,'Open practice',null,30,'standing',2)", [
      free
    ]);
    assert.equal(
      (await value('select training_session_detail($1)', [free])).session.activity,
      'free_ride'
    );
    await user(other);
    await denied('select training_session_detail($1)', [free]);
    await denied("select set_session_activity($1,2,'coached')", [free]);
    await user(admin);
    await denied("select set_session_activity($1,1,'coached')", [free], '40001');
    await denied("update training_sessions set activity='coached' where id=$1", [free]);
    await db.query("select set_session_activity($1,2,'coached')", [free]);
    assert.equal(await value('select version from training_sessions where id=$1', [free]), 3);
    await db.query("select set_session_activity($1,3,'coached')", [free]);
    assert.equal(await value('select version from training_sessions where id=$1', [free]), 3);
    await db.query('select add_session_participant($1,$2,3)', [free, rider]);
    await db.query('select remove_session_participant($1,$2,4)', [free, rider]);
    await db.query("select set_session_activity($1,5,'free_ride')", [free]);
    await db.query("select finish_training_session($1,6,'closed')", [free]);
    await denied("select set_session_activity($1,7,'coached')", [free], '22023');
    await db.exec('reset role;set role anon');
    await denied("select set_session_activity($1,7,'coached')", [free]);
    await denied("select create_session_plan($1,'Bad',null,20,'standing',2,'free_ride')", [club]);
  } finally {
    await db.close();
  }
});
