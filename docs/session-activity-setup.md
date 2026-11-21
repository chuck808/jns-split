# Saved free-ride session plans

This update follows the session-participants and free-ride bench releases. It requires database migrations 001–005. No optional product-requirements document is required by this patch.

## Install

1. Stop the dev server. Save/commit your local changes and run `git status`. If a patch operation is already in progress, resolve it before starting another.
2. Extract `jns-split-session-activity.patch` into your repository folder.
3. Create the branch and apply the patch **once**:

```powershell
git switch -c feat/session-activity
git am ./jns-split-session-activity.patch
```

If the branch already exists, check `git status` before proceeding; do not repeat the apply command blindly. If Git reports a failure, retain its first error and ask for help rather than resetting files.

4. Open `supabase/migrations/202611210006_session_activity.sql`. Copy its **SQL contents**, not the filename, into a new query in your development Supabase SQL Editor. Run once. Do not rerun earlier migrations.
5. Run:

```powershell
npm run check
npm test
npm run dev
```

No dependency changes: `npm ci` is not needed.

## Behaviour

- Club admins can choose **Coached session** or **Free ride · open club practice** when creating a plan. Club and assigned-coach lists show the saved activity.
- Activity is separate from standing/flying start. Existing sessions remain coached, with all participants, tags and coach grants preserved.
- On a planned session, only a club administrator can change activity. The participant list must be empty before switching. Remove planned participants explicitly, or create a separate free-ride session. Nothing is automatically deleted.
- Free-ride plans do not offer manual participant enrolment. The database also rejects add/remove/candidate-list calls for free-ride sessions. This does not give coaches access to the full club register.
- Assigned editing coaches can still change distance, start type and other plan settings or close/cancel the plan, but cannot change its activity. Closed/cancelled plans cannot change activity.
- Stale saves are rejected using the existing session version. Activity changes create a session-updated audit event.

## Test with fictional data

1. Sign in as admin. Create a free-ride plan with flying start. Refresh and confirm both settings persist and the session list labels it Free ride.
2. Open the plan. Confirm it explains open club practice and offers no rider search or manual participant controls.
3. Create a coached plan, add Jamie808 and try switching activity. The change must be blocked until the planned participant list is empty. The rider and tag must remain in the club register.
4. With an empty plan, switch activity in one browser tab, then try saving old settings in another. The stale save must be rejected.
5. Sign in as an assigned editing coach. Confirm the activity is visible but cannot be changed; distance/start-type editing remains available. An unassigned coach or another club admin cannot view the session.
6. Close/cancel a test plan. Confirm activity and plan configuration are read-only.
7. Check the new controls and labels on mobile width and in both themes.

## Scope and next stage

This stores the free-ride **planning policy** only. It does not open equipment, accept a real RFID scan, automatically add participants or record measured attempts. The existing `/bench` free-ride simulator remains fictional and separate from Supabase.

The intended live flow remains: an authorised operator opens practice once; active club riders with valid club-issued tags scan into available lanes without prior enrolment; the controller acknowledges assignment; start/finish signals record independent efforts. Accepted check-ins will establish participation automatically. Device authentication, revoked/archived tag checks, real results and reconnect handling are still separate implementation work.
