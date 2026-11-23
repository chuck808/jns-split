import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit/hooks';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '$app/env/private';
import { theme } from '#lib/preferences';
import { backendConfig } from '#lib/server/config';

export const handle: Handle = async ({ event, resolve }) => {
  const config = backendConfig(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  event.locals.backendReady = !!config;
  event.locals.supabase = null;
  event.locals.user = null;
  const protectedArea =
    /^\/(app|admin|clubs|club|coach|sessions|login|logout|account|forgot-password|reset-password|auth)(\/|$)/.test(
      event.url.pathname
    );
  const authHeaders: Record<string, string> = {};
  if (config && protectedArea) {
    const client = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (values, headers) => {
          for (const { name, value, options } of values)
            event.cookies.set(name, value, {
              ...options,
              path: '/',
              httpOnly: true,
              sameSite: 'lax',
              secure: event.url.protocol === 'https:'
            });
          Object.assign(authHeaders, headers);
        }
      }
    });
    event.locals.supabase = client;
    // Revalidate with Supabase Auth, never trust a cookie's getSession().user.
    const { data, error } = await client.auth.getUser();
    if (!error) event.locals.user = data.user;
  }
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%app.theme%', theme(event.cookies.get('theme')))
  });
  response.headers.set('vary', [response.headers.get('vary'), 'Cookie'].filter(Boolean).join(', '));
  response.headers.set('cache-control', 'private, no-store');
  if (protectedArea) {
    for (const [name, value] of Object.entries(authHeaders)) response.headers.set(name, value);
    response.headers.set('cache-control', 'private, no-store');
    response.headers.set('referrer-policy', 'same-origin');
  }
  return response;
};
