# Session participants

This update connects the rider register to session plans. A club administrator selects which riders belong to a session; assigned coaches can view only those participants. It does not check anyone into a lane, record attendance, operate equipment or save measured times.

## Install

Prerequisites: all releases through session planning, and SQL migrations 001–004 applied.

1. Stop the dev server with Ctrl+C. Save/commit local changes you want to keep. Run `git status`; resolve any unfinished patch (`am`) operation before continuing.
2. Extract `jns-split-session-participants.patch` into the repository folder.
3. Run:

```sh
git switch -c feat/session-participants
git am ./jns-split-session-participants.patch
```

If that branch already exists, skip branch creation. No dependencies changed; `npm ci` is not needed.

4. Open **supabase → migrations → 202611210005_session_participants.sql** in VS Code. Copy **the SQL code inside the file**, not its filename/path.
5. In your development Supabase project's SQL Editor, paste into a new query and click Run once. Do not rerun old migrations or delete tables. Existing clubs, riders, tags, coach links and session plans remain.
6. Run `npm run dev` and refresh the browser.

## Club-admin workflow

Open a planned session and find **Session participants** below its details.

- Search by rider name under **Add riders from this club**, then choose **Add rider**. Search matches a literal, case-insensitive substring; `%` and `_` are not wildcard characters.
- Only active riders from this club, not already in the session, are offered. Riders without tags may be included while planning.
- Participant and candidate lists have independent pagination, 25 riders per page. Search and participant pagination are retained when adding/removing riders.
- Use **Remove** to remove a rider from this session. Their rider record, tag and other sessions remain unchanged.
- Each actual change creates a club/session audit event and increments the session version. Duplicate add/remove requests do not create duplicate entries or audit events. Stale edits are rejected rather than overwriting someone else's changes.
- A closed or cancelled session's participant membership is read-only. Closing a plan still does not record any measured attempts.

## Coach access

Both view-only and editing coaches assigned to this session may view participant display names and whether their club registration is currently archived. No tag UID, account details, full club register or rider result history is returned by this participant view.

Only club administrators can add/remove participants. An editing coach's permission remains limited to the session plan configuration and closing/cancelling. Knowing a rider ID or another session URL does not grant additional access.

Removing the coach's session assignment or club membership removes participant access on subsequent requests. Re-inviting the coach does not restore their deleted session assignments. Previously loaded pages cannot be remotely erased, so shared devices should be signed out when finished.

Applying this release means existing assigned coaches can see names of participants you add to their sessions. No participants are added automatically during migration.

## Archived riders and historical records

Archiving a rider after adding them does not remove them from past/session records. Their participant row stays visible with an **Archived** label. The label reflects current registration status, even when the session is closed. Newly adding an archived rider is rejected. Closed/cancelled participant membership is retained.

This is a planning register, not a snapshot of measured results. Future recorded attempts must preserve their own measured configuration and identity association. Permanent deletion, club transfers and retention policies remain separate work.

## Test with fictional riders

1. Open a planned session as club admin. Add Jamie808 and a second rider without a tag; refresh and confirm both remain.
2. Search the candidate list: riders already included should not be offered again. A rider from a different club or an archived rider must not be eligible.
3. In a separate browser profile, sign in as an assigned coach. Confirm you can see the two names, but cannot search the club register, view tags or add/remove participants—even with session-editing permission.
4. Try the session URL from an unassigned coach or another club admin account: access must be denied.
5. Remove one participant as admin; refresh the coach page and verify the name disappears. Confirm the rider and tag still exist under Riders & tags.
6. Open two tabs. Change participants in one, then submit an older session configuration form in the other. A refresh warning should prevent a stale save.
7. Archive a test participant: the session retains them with an Archived label, and they cannot be added to a new session.
8. Close/cancel a test session: participant membership is now read-only. Removing a coach assignment must still remove their access.
9. With more than 25 test riders, check both pagination controls and search retention. Check mobile-width layout and light/dark themes.

No physical reader is needed for this walkthrough. Riders will still scan themselves into a lane for each run when controller integration is implemented; this update does not introduce per-run manual enrolment.
