import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '$app/env/private';
import { backendConfig } from '#lib/server/config';
import { benchCredential, limitedJson } from '#lib/server/bench-device';
import { deviceText, effortInput, effortStatus } from '#lib/server/timing';
import type { RequestHandler } from './$types';

const reply = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify({ version: 1, ...body }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

// Results upload v1. See docs/results-upload-v1.md.
export const POST: RequestHandler = async ({ request }) => {
  let credential;
  try {
    credential = benchCredential(request.headers.get('authorization'));
  } catch {
    return reply({ code: 'INVALID_CREDENTIAL' }, 401);
  }
  let input;
  try {
    input = effortInput(await limitedJson(request));
  } catch {
    return reply({ code: 'INVALID_EFFORT' }, 400);
  }
  const config = backendConfig(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  if (!config) return reply({ code: 'BACKEND_UNAVAILABLE' }, 503);
  // No person's cookies and no service-role key: the database checks the controller credential.
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await client.rpc('record_effort', {
    p_device_id: credential.p_id,
    p_token: credential.p_token,
    ...input
  });
  if (error) {
    if (error.code === '42501') return reply({ code: 'INVALID_OR_EXPIRED_CREDENTIAL' }, 401);
    if (error.code === '22023') return reply({ code: 'INVALID_EFFORT' }, 400);
    if (error.code === '23514') return reply({ code: 'CONTROLLER_LIMIT_REACHED' }, 409);
    return reply({ code: 'BACKEND_UNAVAILABLE' }, 503);
  }
  const decision = data as {
    code: string;
    resultId: string;
    replay: boolean;
    test?: boolean;
    name?: string;
  };
  return reply(
    {
      code: decision.code,
      resultId: decision.resultId,
      replay: decision.replay,
      ...(decision.code === 'SAVED'
        ? { test: decision.test, rider: deviceText(decision.name) }
        : {})
    },
    effortStatus(decision.code)
  );
};
