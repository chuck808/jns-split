import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '$app/env/private';
import { backendConfig } from '#lib/server/config';
import { benchCredential, benchInput, benchResponse, limitedJson } from '#lib/server/bench-device';
import type { RequestHandler } from './$types';
const reply = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  });
export const POST: RequestHandler = async ({ request }) => {
  let credential;
  try {
    credential = benchCredential(request.headers.get('authorization'));
  } catch {
    return reply('SIMULATED\nINVALID_CREDENTIAL', 401);
  }
  let input;
  try {
    input = benchInput(await limitedJson(request));
  } catch {
    return reply('SIMULATED\nINVALID_TEST_EVENT', 400);
  }
  const config = backendConfig(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  if (!config) return reply('SIMULATED\nBACKEND_UNAVAILABLE', 503);
  // No human cookies or service-role key: the RPC verifies this scoped test credential.
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await client.rpc('bench_device_event', { ...credential, ...input });
  if (error) {
    if (error.code === '42501') return reply('SIMULATED\nINVALID_OR_EXPIRED_CREDENTIAL', 401);
    if (error.code === 'P0001') return reply('SIMULATED\nWAIT_BEFORE_NEXT_TEST', 429);
    if (error.code === '22023') return reply('SIMULATED\nINVALID_EVENT_OR_TEST_LIMIT', 400);
    return reply('SIMULATED\nBACKEND_UNAVAILABLE', 503);
  }
  return reply(benchResponse(data, input.p_lane));
};
