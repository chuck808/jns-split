import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { participantFilters } from '../src/lib/session-participants';

test('participant search and pagination inputs are bounded', () => {
  assert.deepEqual(
    participantFilters(
      new URLSearchParams('participantsPage=-1&candidatesPage=1.2&riderQuery= Jamie ')
    ),
    { query: 'Jamie', participantsPage: 1, candidatesPage: 1 }
  );
  assert.equal(
    participantFilters(new URLSearchParams('riderQuery=' + 'a'.repeat(90))).query.length,
    60
  );
});
test('session participants remain club-admin managed and visible only within assigned sessions', async (t) => {
  const db = new PGlite();
  const [admin, other, coach, viewer, outsider] = [1, 2, 3, 4, 5].map(
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
  const version = (id: string) => value('select version from training_sessions where id=$1', [id]);
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [admin, other, coach, viewer, outsider])
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
    const jamie = await value("select register_rider($1,'Jamie808','001122AB')", [club]);
    const untagged = await value("select register_rider($1,'Untagged rider')", [club]);
    const archived = await value("select register_rider($1,'Archived rider')", [club]);
    await db.query('select archive_rider($1)', [archived]);
    const session = await value(
      "select create_training_session($1,'Practice',null,20,'standing',4)",
      [club]
    );
    const hidden = await value(
      "select create_training_session($1,'Not assigned',null,20,'standing',4)",
      [club]
    );
    for (const id of [coach, viewer, outsider]) {
      const invitation = await value('select invite_coach($1,$2)', [club, id + '@example.test']);
      await user(id);
      await db.query('select respond_coach_invitation($1,true)', [invitation]);
      await user(admin);
    }
    await db.query('select assign_session_coach($1,$2,true)', [session, coach]);
    await db.query('select assign_session_coach($1,$2,false)', [session, viewer]);
    await user(other);
    const otherClub = await value("select create_club('Club B')");
    const otherRider = await value("select register_rider($1,'Other club rider')", [otherClub]);
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611210005_session_participants.sql', import.meta.url),
        'utf8'
      )
    );
    await user(admin);
    await t.test(
      'migration preserves records; adding participants is idempotent and accepts untagged riders',
      async () => {
        assert.equal(
          await value('select uid from tag_assignments where rider_id=$1', [jamie]),
          '001122AB'
        );
        await db.query('select add_session_participant($1,$2,1)', [session, jamie]);
        assert.equal(await version(session), 2);
        await db.query('select add_session_participant($1,$2,1)', [session, jamie]);
        assert.equal(await version(session), 2);
        assert.equal(
          (
            await db.query(
              "select id from club_audit where session_id=$1 and action='session_rider_added'",
              [session]
            )
          ).rows.length,
          1
        );
        await db.query('select add_session_participant($1,$2,2)', [session, untagged]);
        assert.equal((await value('select list_session_participants($1)', [session])).total, 2);
      }
    );
    await t.test(
      'eligibility rejects archived and other-club riders; candidate search is literal',
      async () => {
        await denied('select add_session_participant($1,$2,3)', [session, archived], '22023');
        await denied('select add_session_participant($1,$2,3)', [session, otherRider], '22023');
        assert.equal(
          (await value('select session_participant_candidates($1)', [session])).total,
          0
        );
        const next = await value("select register_rider($1,'Casey 100%')", [club]);
        const found = await value("select session_participant_candidates($1,'100%',1)", [session]);
        assert.equal(found.total, 1);
        assert.equal(found.items[0].id, next);
        assert.equal(
          (await value("select session_participant_candidates($1,'_',1)", [session])).total,
          0
        );
        await denied('select add_session_participant($1,$2,1)', [session, next], '40001');
      }
    );
    await t.test(
      'assigned coaches receive participant names only, including view-only coaches',
      async () => {
        for (const id of [coach, viewer]) {
          await user(id);
          const list = await value('select list_session_participants($1)', [session]);
          assert.equal(list.total, 2);
          assert.deepEqual(Object.keys(list.items[0]).sort(), ['archived', 'display_name', 'id']);
          assert.equal((await db.query('select * from riders')).rows.length, 0);
          assert.equal((await db.query('select * from tag_assignments')).rows.length, 0);
          assert.equal(
            (await db.query('select rider_id from session_participants')).rows.length,
            2
          );
          await denied('select added_by from session_participants');
          await denied('select list_session_participants($1)', [hidden]);
          await denied('select session_participant_candidates($1)', [session]);
          await denied('select add_session_participant($1,$2,3)', [session, archived]);
          await denied('select remove_session_participant($1,$2,3)', [session, jamie]);
          await denied('delete from session_participants');
        }
      }
    );
    await t.test(
      'unassigned coaches, other-club admins and anonymous users are denied',
      async () => {
        for (const id of [outsider, other]) {
          await user(id);
          await denied('select list_session_participants($1)', [session]);
          await denied('select session_participant_candidates($1)', [session]);
          await denied('select remove_session_participant($1,$2,3)', [session, jamie]);
          assert.equal(
            (await db.query('select rider_id from session_participants')).rows.length,
            0
          );
        }
        await db.exec('reset role;set role anon');
        await denied('select list_session_participants($1)', [session]);
        await denied('select rider_id from session_participants');
      }
    );
    await t.test(
      'archival retains membership with visible status; removal leaves rider and tag records intact',
      async () => {
        await user(admin);
        await db.query('select archive_rider($1)', [untagged]);
        let list = await value('select list_session_participants($1)', [session]);
        assert.equal(list.items.find((r: any) => r.id === untagged).archived, true);
        await db.query('select remove_session_participant($1,$2,3)', [session, jamie]);
        assert.equal(await version(session), 4);
        await db.query('select remove_session_participant($1,$2,3)', [session, jamie]);
        assert.equal(await version(session), 4);
        assert.equal(
          await value('select uid from tag_assignments where rider_id=$1 and revoked_at is null', [
            jamie
          ]),
          '001122AB'
        );
        await user(viewer);
        list = await value('select list_session_participants($1)', [session]);
        assert.equal(list.total, 1);
        assert.equal(list.items[0].id, untagged);
      }
    );
    await t.test(
      'participant changes invalidate stale session edits; closing freezes membership',
      async () => {
        await user(admin);
        await denied(
          "select update_training_session($1,3,'Stale',null,30,'flying',2)",
          [session],
          '40001'
        );
        await db.query('select add_session_participant($1,$2,4)', [session, jamie]);
        await db.query("select finish_training_session($1,5,'closed')", [session]);
        await denied('select remove_session_participant($1,$2,6)', [session, jamie], '22023');
        await denied('select add_session_participant($1,$2,6)', [session, jamie], '22023');
        await denied('select session_participant_candidates($1)', [session], '22023');
        await user(viewer);
        assert.equal((await value('select list_session_participants($1)', [session])).total, 2);
      }
    );
    await t.test(
      'coach access removal and re-invitation cannot restore participant access',
      async () => {
        await user(admin);
        await db.query('select remove_session_coach($1,$2)', [session, viewer]);
        await user(viewer);
        await denied('select list_session_participants($1)', [session]);
        await user(admin);
        await db.query('select remove_coach($1,$2)', [club, coach]);
        const invite = await value('select invite_coach($1,$2)', [club, coach + '@example.test']);
        await user(coach);
        await db.query('select respond_coach_invitation($1,true)', [invite]);
        await denied('select list_session_participants($1)', [session]);
      }
    );
    await t.test(
      'participant and candidate pages cover more than 25 rows without duplicates',
      async () => {
        await user(admin);
        for (let i = 0; i < 27; i++) {
          const rider = await value('select register_rider($1,$2)', [
            club,
            'Page ' + String(i).padStart(2, '0')
          ]);
          await db.query('select add_session_participant($1,$2,$3)', [
            hidden,
            rider,
            await version(hidden)
          ]);
        }
        const first = await value('select list_session_participants($1,1)', [hidden]);
        const second = await value('select list_session_participants($1,999)', [hidden]);
        assert.equal(first.total, 27);
        assert.equal(first.items.length, 25);
        assert.equal(second.page, 2);
        assert.equal(second.items.length, 2);
        assert.equal(new Set([...first.items, ...second.items].map((r) => r.id)).size, 27);
        const empty = await value(
          "select create_training_session($1,'Empty',null,20,'standing',4)",
          [club]
        );
        const candidates = await value('select session_participant_candidates($1)', [empty]);
        assert.equal(candidates.items.length, 25);
        assert.equal(candidates.total, 29);
        await db.query("select finish_training_session($1,1,'cancelled')", [empty]);
        await denied('select add_session_participant($1,$2,2)', [empty, jamie], '22023');
      }
    );
  } finally {
    await db.close();
  }
});
