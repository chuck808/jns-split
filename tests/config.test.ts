import test from 'node:test';
import assert from 'node:assert/strict';
import { backendConfig } from '../src/lib/server/config';
const token = (role: string) =>
  'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
test('backend config permits publishable/anon credentials only', () => {
  assert.ok(backendConfig('https://example.supabase.co', 'sb_publishable_example'));
  assert.ok(backendConfig('http://localhost:54321', token('anon')));
  for (const key of ['', 'sb_secret_example', token('service_role'), 'broken'])
    assert.equal(backendConfig('https://example.supabase.co', key), null);
  for (const url of ['', 'nonsense', 'http://example.com', 'https://user:pass@example.com'])
    assert.equal(backendConfig(url, 'sb_publishable_example'), null);
});
