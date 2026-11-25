import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../supabase/migrations/', import.meta.url);

test('effort notes: session coaches and admins only, never riders or families', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3, 4].map((n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0'));
  const [admin, coach, otherCoach, parent] = ids;
  const email = (id: string) => id.slice(-1) + '@example.test';
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

    await as(admin);
    const alex = await value(
      "select register_rider_with_details($1,'Alex Test',2014,null,'{}'::jsonb,'001122AB')",
      [club]
    );
    const tonight = await value(
      "select create_session_plan($1,'Tonight',null,20,'flying',2,'free_ride')",
      [club]
    );
    const other = await value(
      "select create_session_plan($1,'Other night',null,20,'flying',2,'free_ride')",
      [club]
    );
    const device = await value("select create_timing_device($1,'ST-1','live',$2)", [
      club,
      createHash('sha256').update(token).digest('hex')
    ]);
    for (const [c, s] of [
      [coach, tonight],
      [otherCoach, other]
    ]) {
      await as(admin);
      await db.query('select invite_coach($1,$2)', [club, email(c)]);
      await as(c);
      await db.query('select respond_coach_invitation($1,true)', [
        (await value('select my_coach_workspace()')).invitations[0].id
      ]);
      await as(admin);
      await db.query('select assign_session_coach($1,$2,false)', [s, c]);
    }
    await as(null);
    await value("select record_effort($1,$2,'e1',$3,1,'001122AB','completed',1405)", [
      device,
      token,
      tonight
    ]);
    await as(admin);
    const effort = (await value('select session_results($1)', [tonight])).efforts[0].id;

    // The session's coach writes, edits and clears a note.
    await as(coach);
    assert.equal(
      await value('select set_effort_note($1,$2)', [effort, '  Late off the gate  ']),
      'Late off the gate'
    );
    let view = await value('select session_trackside($1)', [tonight]);
    assert.equal(view.efforts[0].note, 'Late off the gate');
    await rejects('select set_effort_note($1,$2)', [effort, 'x'.repeat(281)], '22023');
    await db.query('select set_effort_note($1,$2)', [effort, 'Better arm drive']);
    await as(admin);
    assert.equal(
      (await value('select session_results($1)', [tonight])).efforts[0].note,
      'Better arm drive'
    );

    // No access for a coach of another session, a parent, or anyone signed out; no direct reads.
    await as(otherCoach);
    await rejects('select set_effort_note($1,$2)', [effort, 'Hello'], '42501');
    await as(admin);
    const inv = await value("select invite_rider_access($1,$2,'guardian',true)", [
      alex,
      email(parent)
    ]);
    await as(parent);
    await db.query('select respond_rider_invitation($1,true)', [inv]);
    await rejects('select set_effort_note($1,$2)', [effort, 'Hello'], '42501');
    const family = await value('select rider_results($1)', [alex]);
    assert.equal(family.efforts.length, 1);
    assert.equal(JSON.stringify(family).includes('arm drive'), false, 'families never see notes');
    await rejects('select * from effort_notes', [], '42501');
    await as(null);
    await rejects('select set_effort_note($1,$2)', [effort, 'Hello'], '42501');

    // Notes can still be written after the session is closed, and an empty note clears it.
    await as(admin);
    await db.query("select finish_training_session($1,$2,'closed')", [
      tonight,
      await value('select version from training_sessions where id=$1', [tonight])
    ]);
    await as(coach);
    assert.equal(await value('select set_effort_note($1,$2)', [effort, '   ']), null);
    view = await value('select session_trackside($1)', [tonight]);
    assert.equal(view.efforts[0].note, null);
  } finally {
    await db.close();
  }
});
