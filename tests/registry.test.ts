import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Execute the real migration under PostgreSQL roles, not mocked API responses.
test('club registry permissions and atomic tag lifecycle', async (t) => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000001';
  const b = '00000000-0000-0000-0000-000000000002';
  const coach = '00000000-0000-0000-0000-000000000003';
  async function user(id: string) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('set role authenticated');
  }
  async function value(sql: string, args: unknown[] = []): Promise<string> {
    return Object.values((await db.query<Record<string, string>>(sql, args)).rows[0])[0];
  }
  const denied = (sql: string, args: unknown[] = [], code = '42501') =>
    assert.rejects(db.query(sql, args), (e: unknown) => (e as { code: string }).code === code);
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;`);
    for (const id of [a, b, coach]) await db.query('insert into auth.users values($1)', [id]);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611190001_club_registry.sql', import.meta.url),
        'utf8'
      )
    );
    await user(a);
    const clubA = await value("select create_club('Club A')");
    const rider = await value("select register_rider($1,'Alex','00:11:22:ab')", [clubA]);
    await user(b);
    const clubB = await value("select create_club('Club B')");
    const other = await value("select register_rider($1,'Sam','04010203040506')", [clubB]);

    await t.test(
      'cross-club reads and writes denied, including direct privilege escalation',
      async () => {
        assert.equal((await db.query('select * from riders where id=$1', [rider])).rows.length, 0);
        assert.equal(
          (await db.query('select * from tag_assignments where club_id=$1', [clubA])).rows.length,
          0
        );
        assert.equal(
          (await db.query('select * from club_audit where club_id=$1', [clubA])).rows.length,
          0
        );
        await denied('select register_rider($1,$2)', [clubA, 'Intruder']);
        for (const fn of ['archive_rider', 'revoke_rider_tag'])
          await denied(`select ${fn}($1)`, [rider]);
        await denied('select set_rider_tag($1,$2)', [rider, '11223344']);
        await denied("update club_memberships set role='admin'");
        await denied('delete from club_audit');
        await denied('update riders set club_id=$1', [clubA]);
        await denied("select create_club('Duplicate')", [], '23505');
      }
    );
    await user(a);
    await t.test('duplicate UID rolls back replacement and registration', async () => {
      await denied('select set_rider_tag($1,$2)', [rider, '04010203040506'], '23505');
      assert.equal(
        await value('select uid from tag_assignments where rider_id=$1 and revoked_at is null', [
          rider
        ]),
        '001122AB'
      );
      await denied("select register_rider($1,'Failed','04010203040506')", [clubA], '23505');
      assert.equal((await db.query('select * from riders')).rows.length, 1);
    });
    await t.test(
      'replacement preserves history; repeat is idempotent; archive revokes',
      async () => {
        await db.query('select set_rider_tag($1,$2)', [rider, '00010203040506070809']);
        await db.query('select set_rider_tag($1,$2)', [rider, '00010203040506070809']);
        assert.equal((await db.query('select * from tag_assignments')).rows.length, 2);
        assert.equal(
          (await db.query('select * from tag_assignments where revoked_at is null')).rows.length,
          1
        );
        await denied('select set_rider_tag($1,$2)', [rider, 'bad'], '22023');
        await db.query('select archive_rider($1)', [rider]);
        assert.equal(
          (await db.query('select * from tag_assignments where revoked_at is null')).rows.length,
          0
        );
        await denied('select set_rider_tag($1,$2)', [rider, '11223344'], '22023');
      }
    );
    await t.test(
      'coach has no roster access and revoked admin loses access immediately',
      async () => {
        await db.exec('reset role');
        await db.query("insert into club_memberships(club_id,user_id,role) values($1,$2,'coach')", [
          clubA,
          coach
        ]);
        await user(coach);
        assert.equal((await db.query('select * from riders')).rows.length, 0);
        await denied('select register_rider($1,$2)', [clubA, 'No access']);
        await denied("select create_club('Promote myself')", [], '23505');
        await db.exec('reset role');
        await db.query('delete from club_memberships where user_id=$1', [b]);
        await user(b);
        assert.equal((await db.query('select * from riders')).rows.length, 0);
        await denied('select archive_rider($1)', [other]);
      }
    );
    await t.test('anonymous users cannot read or invoke mutations', async () => {
      await db.exec('reset role; set role anon');
      await denied('select * from riders');
      await denied("select create_club('Anonymous')");
      await denied('select archive_rider($1)', [rider]);
    });
  } finally {
    await db.close();
  }
});
