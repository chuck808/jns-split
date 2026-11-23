import { error, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from './access';
import type { PlatformOverview } from '#lib/club-admission';
export async function requirePlatform(event: RequestEvent) {
  const { client, user } = requireUser(event);
  const { data, error: problem } = await client.rpc('platform_overview');
  if (problem)
    error(
      problem.code === '42501' ? 404 : 503,
      problem.code === '42501'
        ? 'Workspace unavailable.'
        : 'Unable to load platform administration. Check migration 010.'
    );
  return { client, user, overview: data as PlatformOverview };
}
