import { defineEnvVars } from '@sveltejs/kit/env';
// Optional so the simulator remains usable without a configured backend.
export const variables = defineEnvVars({
  SUPABASE_URL: { schema: (value) => value?.trim() || '', description: 'Supabase project URL' },
  SUPABASE_PUBLISHABLE_KEY: {
    schema: (value) => value?.trim() || '',
    description: 'Publishable or legacy anon key; never a service-role key'
  }
});
