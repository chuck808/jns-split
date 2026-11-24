import { defineEnvVars } from '@sveltejs/kit/env';
const optional = (description: string) => ({
  schema: (value: string | undefined) => value?.trim() || '',
  description
});
// All optional: the simulator works without a backend, and the app works
// without email (invitations are then passed on by hand).
export const variables = defineEnvVars({
  SUPABASE_URL: optional('Supabase project URL'),
  SUPABASE_PUBLISHABLE_KEY: optional('Publishable or legacy anon key; never a service-role key'),
  APP_URL: optional('Address people open the app on, used in emailed links'),
  SMTP_HOST: optional('Email sending service host, for invitation emails'),
  SMTP_PORT: optional('Email sending service port, usually 587 or 465'),
  SMTP_USER: optional('Email sending service username'),
  SMTP_PASSWORD: optional('Email sending service password or API key'),
  EMAIL_FROM: optional('Sender, for example JNS SPLIT <no-reply@yourclub.example>')
});
