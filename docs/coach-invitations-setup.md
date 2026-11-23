# Coach invitations and club links

This release adds an administrator-managed coach directory, expiring invitations, acceptance/decline, invitation revocation and removal of accepted coach memberships. It does not grant access to riders, sessions, results or equipment.

## Install

Prerequisites: the club workspace update and SQL migrations 001 and 002 already applied.

1. Stop the dev server with Ctrl+C. Save and commit any local edits you want to keep. Run `git status`; if it reports an unfinished `am` session, resolve that before applying another patch.
2. Extract `jns-split-coach-invitations.patch` into your repository folder.
3. Run:

```sh
git switch -c feat/coach-invitations
git am ./jns-split-coach-invitations.patch
```

Skip branch creation if you already created that branch. Dependencies have not changed; `npm ci` is not needed.

4. In VS Code, open **supabase → migrations → 202611210003_coach_invitations.sql**. Copy **the SQL code inside the file**, not the filename/path.
5. Paste the code into a new query in your development project's Supabase SQL Editor and click Run. Run this new migration once, after 001/002. Do not rerun old migrations or delete tables.
6. Start `npm run dev` and refresh the browser.

The migration creates the invitation table, permission-checked functions and audit event types. Existing records are retained. There is no service-role key or mail-provider credential to configure in the application.

## Two-account acceptance test

Use fictional test accounts and riders.

1. In Supabase Authentication → Users, ensure you have a separate coach test account with a password and confirmed email. The project owner still provisions new accounts in this pilot; club administrators do not receive global Supabase account-management access. Keep public sign-up disabled.
2. Sign into JNS SPLIT as your club administrator. Open your club → **Coaches**.
3. Enter the exact email of the coach test account and choose **Create invitation**. The invitation should appear as pending, with a seven-day expiry.
4. **No email is sent.** Tell the coach to sign in to the same installation and select **Coach workspace** in the top navigation. Invitations are addressed to the verified account, so there is no secret invitation link to copy.
5. For local testing, use a separate browser profile/private window for the coach, or sign out of the administrator account first. Signing into two tabs of the same browser profile shares the login cookies.
6. After coach login, the club chooser highlights pending invitations. Open Coach workspace and accept. The club appears in Your approved clubs, and the administrator's Coaches page shows the accepted membership.
7. As coach, try opening the administrator's club overview or riders URL. It must remain inaccessible. An accepted club link is not a rider-history or session grant.
8. As administrator, open Remove coach, tick the confirmation and submit. Refresh the coach workspace: that club link disappears. The old accepted invitation cannot recreate membership.
9. Create another invitation and revoke it before acceptance. It should disappear from the coach inbox. Reusing a pending, unexpired invitation is blocked; after decline, expiry or revocation, a fresh invitation can be created.
10. If you have a second club, invite the same coach there. Removing the coach from the first club must leave the second club link intact.

## Rules and limits

- Invite acceptance checks the account's current confirmed email in Supabase Auth, not browser-supplied email, user metadata or a stale JWT email claim.
- Invitation creation grants no membership. Acceptance is an explicit POST action. Wrong-account, expired, revoked and already-used invitations cannot be accepted.
- Invite expiry is seven days. Expiry affects pending invitations only; it does not automatically remove an accepted membership.
- Removing the issuing administrator makes their unaccepted invitations unavailable. An active administrator can revoke and replace those invitations.
- Invitations and coach lists are independently paginated at 25 items per page. Declined/revoked/expired invitations remain in administrator history.
- Accepted coaches can see only minimal club link details and their own available invitations. They cannot see the full club record, roster, tags or audit log, cannot invite others, and cannot promote themselves.
- The existing membership model permits one role per account per club. Inviting an existing club administrator as coach is rejected rather than downgrading their role. An administrator can still have coach links to other clubs.
- Removing a coach removes that club membership and cancels remaining pending invitations addressed to their current account email for that club. Their Auth account, other clubs and audit history remain.
- No session/history grants exist yet. When those are introduced, authorisation must require both a current membership and the relevant grant; removal must invalidate access immediately.
- Account onboarding, automatic email delivery, ongoing rider-history grants and session controls are separate future changes. The UI explicitly says no email has been sent.

## Validation

Automated tests execute all three migrations in PostgreSQL and exercise invitation scope, verified-email matching, duplicate invitations, accept/decline/revoke/expiry, replay rejection, multi-club membership, removal, role protection, pagination, revoked inviter access and anonymous denial. Existing registry and workspace tests remain in place.

After applying, also run `npm run check`, `npm test` and `npm run build` if you want to repeat the local automated checks. A real two-account browser walkthrough against your development Supabase project remains necessary.
