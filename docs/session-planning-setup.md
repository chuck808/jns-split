# Session planning and assigned coach access

This release adds saved session plans and explicit coach permissions. It does **not** record measured times, check riders into lanes, arm equipment or upload results. The bench simulator remains separate.

## Install

Prerequisites: the club workspace and coach invitation releases, with migrations 001, 002 and 003 applied.

1. Stop the development server with Ctrl+C. Save and commit local changes you want to keep. Run `git status`; resolve any unfinished `am` operation before applying another patch.
2. Extract `jns-split-session-planning.patch` into your repository folder.
3. Run:

```sh
git switch -c feat/session-planning
git am ./jns-split-session-planning.patch
```

Skip creating the branch if it already exists. No dependencies changed, so `npm ci` is not needed.

4. Open **supabase → migrations → 202611210004_session_planning.sql** in VS Code. Copy **the SQL contents**, not the filename.
5. Paste into a new query in your development Supabase project's SQL Editor and Run once. Do not rerun earlier migrations. Existing clubs, riders, tags and coach links are retained.
6. Start `npm run dev` and refresh the browser.

## Club-admin workflow

- Open your club → Sessions and create a plan with a name, optional scheduled time, distance, standing/flying start and 1–4 lanes.
- Scheduling is explicitly **UTC** in this pilot. Convert local times when needed; for example British Summer Time is one hour ahead of UTC. Browser-local timezone entry is not implemented yet.
- Session configuration is planning metadata only; it is not sent to hardware. The future timing integration must freeze configuration for each measured attempt.
- On the session detail page, choose an approved club coach and assign either **View only** or **Edit configuration and close/cancel this session**. Pending invitations are not eligible until accepted.
- To change permission, select the same coach and save the new permission. Only club administrators can assign/remove session access, including when an assigned coach has editing permission.
- A coach can have different permissions on different sessions. No rider or historical-result access is implied.
- Use the approved-coach page controls if your club has more than 25 coaches. Assigned coaches are listed separately.

## Coach workflow

- Sign into the coach account and open Coach workspace → **My assigned sessions**.
- Only explicitly assigned sessions appear. A club membership by itself is insufficient.
- View-only coaches see the session plan and latest activity; editing and closing controls are absent and database requests to edit are denied.
- Coaches with editing permission can update planning configuration and close/cancel that session. They cannot create club sessions, assign other coaches or access the club register.
- Session permissions are checked for every read and write. Removing a session assignment ends access. Removing club membership deletes all that coach's session assignments for the club; re-invitation does not restore them.

## Lifecycle

Sessions start **planned**. An administrator or coach with editing permission may close or cancel after confirming. These are terminal states in this pilot: configuration becomes read-only and the session cannot be reopened. Closing creates no measured results. Administrators can still remove session access after closing.

Updates include a version number. If another user changes a session while a form is open, saving the stale version is rejected with a refresh message rather than silently overwriting their changes.

Session lists are paginated at 25 rows, filtered by Planned / Closed / Cancelled / All. The detail page shows the latest 20 session audit actions; older audit records remain stored. Club admins retain access to their club's sessions, and coaches retain their assigned session visibility until membership or assignment is removed.

## Acceptance walkthrough

1. As club admin, create two fictional session plans. Refresh and confirm they persist.
2. Assign your approved test coach to only the first, with View only. In a separate browser profile, log in as coach and verify that only that session is listed.
3. Copy the second session URL into the coach browser: it must be unavailable. Rider-register and other-club URLs must also remain inaccessible.
4. As admin, grant edit permission on the first session. Refresh the coach page and change the distance/start type; verify the saved values as admin.
5. Open the same session in two tabs. Save an edit in one, then submit the older form in the other. The older save must fail with a refresh message.
6. Downgrade the coach to View only; check editing is denied. Remove session access; check the session disappears.
7. Reassign a coach, remove their club membership, then re-invite/accept. The old session assignment must not reappear.
8. Close or cancel a test session. Confirm its configuration is read-only and that it appears under the corresponding list filter. No result or timing should have been generated.
9. Check both themes and a narrow/mobile screen.

## Validation and remaining work

Automated PostgreSQL tests cover all four migrations, cross-club and unassigned-user denial, view/edit separation, stale version checks, terminal states, pagination, anonymous denial and removal/re-invitation behaviour. Existing app tests and the native-form-origin regression check remain in place.

Live Supabase and browser acceptance remain required. Equipment provisioning, session participant access, controller acknowledgements, actual run lifecycle, result ingestion and rider analytics are separate future releases. Existing invitations still use the in-app workflow; no new email delivery is introduced.
