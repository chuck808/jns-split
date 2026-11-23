import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ locals, request, url }) => {
  if (request.headers.get('origin') !== url.origin) error(403, 'Invalid request origin.');
  const result = await locals.supabase?.auth.signOut({ scope: 'local' });
  if (result?.error) error(503, 'Sign-out failed. Please try again.');
  redirect(303, '/login');
};
