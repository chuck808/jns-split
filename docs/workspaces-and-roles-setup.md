# Account workspaces and independent club roles

This is the first implementation slice from the product-experience blueprint. It adds `/app`, a workspace chooser and independent admin/coach roles within a club. It does not yet add platform administration, public club applications, rider logins or guardian access.

## Install

Requires the live test monitor release and SQL migrations 001–008. No optional older requirements document or `tests/server-security.mjs` change is included in this patch.

1. Stop the dev server. Save/commit local changes, then run `git status`. Resolve any unfinished patch operation before continuing.
2. Extract `jns-split-workspaces.patch` into the web repository. Run these once, stopping on any error:

```powershell
git switch -c feat/account-workspaces
git am --3way ./jns-split-workspaces.patch
```

The `--3way` option lets Git merge previously committed local edits where it has the original file history. If it reports a conflict, stop and share the error; do not discard your login diagnostics or apply the patch again.

3. Open `supabase/migrations/202611220009_workspaces_and_roles.sql`. Copy its **SQL contents** into a new query in the development Supabase SQL Editor and run once. Apply this before starting the updated app. Do not rerun older migrations.
4. Run:

```powershell
npm run check
npm test
npm run dev
```

No new dependencies, `npm ci`, Core2 upload or device credential replacement is required.

The migration changes the authorisation model. Keep the migration and matching application code together; do not revert to older app code while keeping only part of the new schema. Existing data is migrated in one transaction. The legacy membership `role` column remains for compatibility but is no longer the source of permission decisions. There is no destructive down-migration in this bundle.

## What changes

- Sign-in now goes to `/app`, which checks the account's current permissions.
- One available workspace opens automatically. With several, the chooser appears unless you have a still-authorised remembered choice.
- **Workspaces** in the top navigation always opens the chooser. Selecting one remembers it on this browser for this account for up to 90 days. Another account on the same browser cannot inherit it.
- Each admin club has a **Manage [club]** workspace. **Coach** appears if the account has a coach role or an actionable coach invitation. A pending invitation gives access to accepting it, not club data.
- No linked workspaces produces an explanation and invitation link. Existing private-pilot club setup remains available; public club approval is the next implementation slice.
- Existing club, coach, account and session URLs continue to work. Platform, Rider and Family destinations are not shown before they are implemented and granted.

Workspace selection changes the view, not the account's combined permissions. Someone who is both an admin and a coach still has their separate admin access while viewing the coach workspace. This is not an impersonation or restricted-role session feature.

## Give an existing administrator a coach role

An admin is not automatically made a coach by migration. To explicitly add it:

1. Open the club's Coaches page and invite that administrator's confirmed account email. You may invite your own confirmed email for this test.
2. Open Coach workspace and accept the invitation while signed in as the recipient.
3. Open Workspaces. Both **Manage [club]** and **Coach** should be available.
4. Assign that account to a session as a coach if it should appear in the coach's assigned-session list. Coach membership alone does not create session grants.

The existing in-app invitation rules still apply: confirmed email, expiry, explicit acceptance, issuer authority, revocation and single use. No automatic invitation email delivery was added. New accounts are still provisioned through the private pilot's existing process.

## Removing roles

Removing a coach now removes only that coach role and its session assignments. If the same account is also an administrator, its admin role and club membership remain. If it has no other club role, its membership anchor is removed as before.

Re-inviting and accepting the coach role does not restore deleted session assignments. An admin+coach may still access that session through the independent admin role; check the coach assignment list to verify that the coach grant was removed.

This release does not expose admin-role removal, administrator handover or platform-role assignment. Those require their own invitation, last-admin and recovery rules in the next slices. Do not manually grant application roles through user-editable account metadata.

## Migration details

- Adds `club_membership_roles`, migrating every existing admin/coach role without changing club, account, rider, tag or session IDs.
- Keeps the `(club_id,user_id)` membership identity used by existing foreign keys.
- Adds a foreign key from session-coach assignments to the actual coach role, so deleting that role always removes its grants even when another role retains club membership.
- Updates admin/session permission helpers, coach invitations, coach removal, coach lists and session queries to use independent roles.
- Adds a permission-scoped `my_workspaces` RPC. Authenticated users can read only their own role rows; direct role writes remain forbidden.
- Existing pilot club creation creates both its membership and admin role. Replacing this pilot path with reviewed club applications remains future work; do not enable public registration based on this update alone.
- No session versions or test credentials are changed by the migration, and no real results are created.

## Acceptance walkthrough

1. Sign out/in as an existing admin. Confirm the club opens, riders/tags remain and the test monitor still works.
2. Open Workspaces and confirm only the account's own available contexts appear.
3. Sign in as a coach-only account. Confirm it opens Coach and sees only assigned sessions; no club-admin access is gained.
4. Complete the admin-plus-coach invitation flow above. Confirm both contexts are offered and the administrator can be explicitly assigned as a session coach.
5. Remove that account's coach role. Confirm admin access remains and the coach assignments are gone. Re-invite it; assignments must remain absent until explicitly granted again.
6. Choose Coach, sign out, then sign in as a different account in the same browser. The previous user's remembered choice must not choose an unauthorised destination.
7. Revoke a coach-only account's membership, then revisit `/app`. Its old remembered workspace must no longer open. An old direct session URL must also fail.
8. Verify the chooser on a phone-width screen, with keyboard navigation and in light/dark themes.

Automated coverage includes migration preservation, dual roles, loss of independent admin access, direct-write denial, cross-club isolation, no restored coach grants, account-bound preferences and rejection of client-supplied redirect destinations. Physical/browser walkthrough remains required on your installation.
