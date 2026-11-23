import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { rosterFilters } from '../src/lib/club-workspace';
test('roster filters bound page and search input', () => {
  assert.deepEqual(rosterFilters(new URLSearchParams('status=bad&page=-2')), {
    query: '',
    status: 'active',
    page: 1
  });
  assert.equal(rosterFilters(new URLSearchParams('page=1.5')).page, 1);
  assert.equal(rosterFilters(new URLSearchParams('q=' + 'x'.repeat(100))).query.length, 60);
});
test('workspace migration, pagination, metrics and settings authorisation', async (t) => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000001',
    b = '00000000-0000-0000-0000-000000000002',
    coach = '00000000-0000-0000-0000-000000000003';
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
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;`
    );
    for (const id of [a, b, coach]) await db.query('insert into auth.users values($1)', [id]);
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611190001_club_registry.sql', import.meta.url),
        'utf8'
      )
    );
    await user(a);
    const club = await value("select create_club('Original club')");
    const rider = await value("select register_rider($1,'Jamie808','001122AB')", [club]);
    await db.exec('reset role');
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202611200002_club_workspace.sql', import.meta.url),
        'utf8'
      )
    );
    await user(a);
    await t.test(
      'existing records survive migration and settings changes are audited',
      async () => {
        assert.equal(await value('select speed_unit from clubs where id=$1', [club]), 'km/h');
        await db.query("select update_club_settings($1,'Renamed club','mph')", [club]);
        assert.equal(await value('select name from clubs where id=$1', [club]), 'Renamed club');
        assert.equal(
          await value('select uid from tag_assignments where rider_id=$1', [rider]),
          '001122AB'
        );
        assert.equal(
          (await db.query("select * from club_audit where action='club_updated'")).rows.length,
          1
        );
        await db.query("select update_club_settings($1,'Renamed club','mph')", [club]);
        assert.equal(
          (await db.query("select * from club_audit where action='club_updated'")).rows.length,
          1
        );
        await denied("select update_club_settings($1,'','mph')", [club], '22023');
        await denied("update clubs set name='Bypass' where id=$1", [club]);
      }
    );
    for (let i = 0; i < 27; i++)
      await db.query('select register_rider($1,$2)', [club, 'Test ' + String(i).padStart(2, '0')]);
    await t.test('roster pages are stable, bounded and search is literal', async () => {
      const first = await value("select club_roster($1,'','active',1)", [club]);
      const second = await value("select club_roster($1,'','active',2)", [club]);
      assert.equal(first.total, 28);
      assert.equal(first.riders.length, 25);
      assert.equal(second.riders.length, 3);
      assert.equal(new Set([...first.riders, ...second.riders].map((r) => r.id)).size, 28);
      assert.equal((await value("select club_roster($1,'','active',999)", [club])).page, 2);
      assert.equal(
        (await value("select club_roster($1,'jamie','all',1)", [club])).riders[0].id,
        rider
      );
      assert.equal((await value("select club_roster($1,'001122ab','all',1)", [club])).total, 1);
      assert.equal((await value("select club_roster($1,'%','all',1)", [club])).total, 0);
      assert.equal((await value("select club_roster($1,'','untagged',1)", [club])).total, 27);
    });
    await t.test('overview reflects archive and tag revocation rather than page size', async () => {
      let summary = await value('select club_overview($1)', [club]);
      assert.equal(summary.active, 28);
      assert.equal(summary.tagged, 1);
      assert.equal(summary.untagged, 27);
      assert.equal(summary.audit.length, 10);
      await db.query('select archive_rider($1)', [rider]);
      summary = await value('select club_overview($1)', [club]);
      assert.equal(summary.active, 27);
      assert.equal(summary.archived, 1);
      assert.equal(summary.tagged, 0);
      assert.equal((await value("select club_roster($1,'','archived',1)", [club])).total, 1);
    });
    await t.test(
      'other clubs, coaches and anonymous users cannot use workspace functions',
      async () => {
        await user(b);
        await value("select create_club('Other club')");
        for (const sql of [
          'select club_roster($1)',
          'select club_overview($1)',
          "select update_club_settings($1,'Intruder','mph')"
        ])
          await denied(sql, [club]);
        await db.exec('reset role');
        await db.query("insert into club_memberships(club_id,user_id,role) values($1,$2,'coach')", [
          club,
          coach
        ]);
        await user(coach);
        await denied('select club_overview($1)', [club]);
        await denied("select update_club_settings($1,'Intruder','mph')", [club]);
        await db.exec('reset role;set role anon');
        await denied('select club_roster($1)', [club]);
      }
    );
  } finally {
    await db.close();
  }
});
