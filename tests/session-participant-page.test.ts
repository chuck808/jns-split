import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/routes/sessions/[sessionId]/+page.server';

test('coach page responses never fetch eligible club riders or the admin coach directory', async () => {
  for (const canManage of [false, true]) {
    const calls: string[] = [];
    const event = {
      params: { sessionId: '00000000-0000-0000-0000-000000000001' },
      url: new URL('https://app.test/sessions/test?riderQuery=secret&candidatesPage=2'),
      locals: {
        user: { id: 'coach' },
        supabase: {
          rpc: async (name: string) => {
            calls.push(name);
            if (name === 'training_session_detail')
              return {
                data: { isAdmin: false, canManage, session: { status: 'planned' } },
                error: null
              };
            if (name === 'list_session_participants')
              return {
                data: {
                  items: [{ id: 'rider', display_name: 'Jamie808', archived: false }],
                  total: 1,
                  page: 1,
                  pages: 1
                },
                error: null
              };
            throw new Error('Unexpected privileged fetch: ' + name);
          }
        }
      }
    };
    const data = (await load(event as any)) as any;
    assert.deepEqual(calls, ['training_session_detail', 'list_session_participants']);
    assert.equal(data.candidates, null);
    assert.equal(data.directory, null);
    assert.equal(data.participants.items[0].display_name, 'Jamie808');
  }
});

test('free-ride admin page does not fetch candidates for manual enrolment', async () => {
  const calls: string[] = [];
  const data = (await load({
    params: { sessionId: '00000000-0000-0000-0000-000000000001' },
    url: new URL('https://app.test/sessions/test'),
    locals: {
      user: { id: 'admin' },
      supabase: {
        rpc: async (name: string) => {
          calls.push(name);
          if (name === 'training_session_detail')
            return {
              data: {
                isAdmin: true,
                canManage: true,
                session: { activity: 'free_ride', status: 'planned', club_id: 'club' }
              },
              error: null
            };
          if (name === 'club_coaches')
            return { data: { coaches: [], page: 1, pages: 1 }, error: null };
          if (name === 'list_session_participants')
            return { data: { items: [], total: 0, page: 1, pages: 1 }, error: null };
          throw new Error('Unexpected manual enrolment fetch: ' + name);
        }
      }
    }
  } as any)) as any;
  assert.equal(data.candidates, null);
  assert.deepEqual(calls, ['training_session_detail', 'club_coaches', 'list_session_participants']);
});
