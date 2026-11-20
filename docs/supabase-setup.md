# Club registry setup and acceptance

This milestone adds password sign-in, club creation, rider registration and tag issue/replacement/revocation. It does not upload timing results or synchronise the simulator/controller. Use fictional riders while testing.

## Configure a development project

1. Create a separate development Supabase project. In its SQL editor, run `supabase/migrations/202611190001_club_registry.sql` once against a fresh database. The migration is transactional; do not rerun it over existing tables. Future changes should use new migrations.
2. In Authentication settings, disable **Allow new users to sign up**. This pilot is administrator-provisioned. An authenticated account without memberships can create its first club, so do not enable public sign-up.
3. In Authentication → Users, add a test admin with an email and password; confirm the test account through the dashboard. The app does not send invitations, provide password recovery, or accept rider self-registration yet. Account/password administration is currently handled by the project owner in Supabase.
4. Copy `.env.example` to `.env`. Set the project URL and **publishable key** from the project dashboard. A legacy `anon` JWT also works. Do not use a secret or `service_role` key. Never commit `.env` or paste credentials into a pull request.
5. Run `npm ci`, then `npm run dev`. Open `/login`, sign in, create your test club, and register a fictional rider. Refresh to verify persistence.

Without valid configuration, `/login` explains setup and the simulator at `/` still works. The app rejects elevated keys in configuration. Supabase Auth validates passwords and the server revalidates sessions; PostgreSQL policies and checked functions enforce club access.

For Vercel, add the same two environment variables to the intended test/preview environment and redeploy. Use a development database for previews, not real club data. No Supabase project or deployment is created by this code.

## Test the workflow

- Register a rider with no tag, then issue one. Paste `00:11:22:AB` and confirm it becomes `001122AB`, preserving leading zeros.
- Refresh and sign out/in: the rider and tag must persist.
- Replace a tag: the old assignment appears as retired in history.
- Assign a tag already active on another rider: saving must fail and the original tag must remain active. A failed new registration must leave no partial rider.
- Revoke a tag: the rider stays registered without an active tag.
- Archive a rider after ticking the confirmation: their tag is revoked and new assignment is blocked. Archiving retains history; it is not permanent deletion.
- Create a second test admin account and club. That account must not open the first club's URL or read/change its rows through the Supabase API.
- Remove a test admin's membership in the dashboard: access to that club must end on the next request.
- Sign out, then revisit a club URL: sign-in is required. Check a narrow/mobile screen as well as desktop.
- If available, connect the Core2 reader: scans capture a UID only. Choose a rider and save explicitly. Pasting bench JSON remains available without Web Serial.

Automated checks: `npm test` runs the actual migration in embedded PostgreSQL (PGlite), including role permissions, RLS and rollback tests. `npm run check` checks Svelte/TypeScript; `npm run build` checks the Vercel build. PGlite is a development dependency, not part of the app backend. These checks do not replace a live Supabase/Auth and browser walkthrough.

## Scope and access model

- A rider record has exactly one home club; no rider login is required. Each rider has at most one active tag, and each UID can belong to only one active assignment across clubs. UID is identification, not an authentication secret.
- Club admins see only their club records. Direct table mutations are denied to API users; checked database functions perform allowed operations and write audit entries.
- Coach memberships are reserved in the schema but deliberately grant no roster/history access yet. Session-specific access and approved ongoing coach links need their own grants and tests.
- Additional admins are provisioned by the project owner through `club_memberships` using an existing Auth user ID and club ID. There is no self-service role promotion or invitation UI.
- Display names only: safeguarding paperwork and permissions remain with the club. Before entering real children's records, complete the club's access, privacy and retention decisions. Account recovery, permanent deletion/retention tooling and guardian access are later work.
- No tag-to-lane registration, controller acknowledgement, timing ingestion or offline queue is implemented here. The bench simulator has separate temporary test records.
- Tag history currently loads with the roster and is intended for a small pilot. Larger deployments need pagination before exceeding Supabase's configured API row limit; the page reports an error rather than displaying a silently truncated register.
