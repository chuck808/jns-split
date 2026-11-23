import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { theme, returnPath } from '#lib/preferences';
export const POST: RequestHandler = async ({ request, url, cookies }) => {
  if (request.headers.get('origin') !== url.origin) error(403, 'Invalid request origin.');
  const form = await request.formData();
  cookies.set('theme', theme(form.get('theme')), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 31536000
  });
  redirect(303, returnPath(form.get('returnTo')));
};
