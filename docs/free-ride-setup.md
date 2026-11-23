# Free ride: bench testing and production requirements

## Install this update

This patch follows the session-participants update. Stop the dev server, save/commit your local edits and check `git status` for an unfinished patch operation.

Extract `jns-split-free-ride.patch` into your repository folder, then run:

```powershell
git switch -c feat/free-ride-bench
git am ./jns-split-free-ride.patch
npm run dev
```

No dependencies changed and no Supabase SQL migration is required.

## Try it without hardware

1. Open `/bench`. This uses fictional riders in browser memory, not your Supabase rider register. Refresh clears it.
2. Under Session configuration select **Free ride**, two lanes and the desired distance/start type, then Apply setup. Clear assignments first if necessary.
3. Tap Alex into lane 1. Leave lane 2 empty. Select **Simulate start signal** on lane 1; it should start without waiting for lane 2.
4. While lane 1 is running, tap Sam into lane 2 and start that effort. Finish lane 2 first, then lane 1. Results should retain the correct rider, lane and configuration.
5. Try moving Alex to lane 2 while Alex is running, replacing a running rider, or changing setup. These must be rejected.
6. After finishing, replay the original scan request: it must not reassign the rider. A fresh scan is required for a fresh effort.
7. Test unknown tags, occupied lanes, DNF and cancellation. DNF/cancellation must not create a time or speed.
8. Open Results and export CSV. Results are labelled SIMULATED and include activity. Comparable history separates coached and free-ride activities as well as distance and start type.
9. Check the controls at mobile width and in both themes. Switch back to Coached with empty lanes to check the existing group-run flow.

Start and finish buttons substitute for timing-controller events. They are not proposed per-effort coach controls. A tag identifies the rider; it does not itself start the clock. Real start/finish sensing must be validated on the hardware.

## Agreed direction for ordinary club practice

Free ride is now in the intended pilot scope, rather than deferred as in the original requirements. It is an activity/access workflow, separate from standing/flying start.

- A club administrator or authorised session operator opens a club practice session once, with enabled lanes, distances and supported start mechanisms. Closing stops new efforts; handling efforts already underway must be explicit.
- An active rider with a valid, non-revoked tag issued by that club can scan at an available lane without advance session enrolment. Visiting/cross-club riders are not implicitly admitted in this first version.
- The selected-participant list remains useful for planned coached sessions; it must not become a prerequisite for open club practice. Accepted controller check-ins will establish free-ride participation automatically, once per rider/session, rather than adding the whole club register.
- Each lane has independent waiting, ready and running states. A rider cannot occupy two running lanes. A running lane cannot be reassigned. Finishing, DNF or cancellation consumes that effort's check-in; the next effort needs a fresh scan.
- The timing controller accepts or rejects the check-in and owns timing. Reader detection alone is not acceptance. Unknown/revoked tags, archived riders, wrong-club tags, closed sessions and occupied/disabled lanes receive clear rejections.
- Tag UID is an identifier, not a login credential or strong proof of identity. Readers/controllers need their own authenticated device identity and club/session binding.
- Settings and rider identity are snapshotted per accepted effort. Events need unique IDs, deduplication, reconnect reconciliation and stale-request rejection. A stale retry must not create a new effort.
- Only authorised club staff and explicitly assigned coaches may view the session. Free ride must not grant every coach access to the club register or historic rider results. Automatic participant creation must preserve this session-scoped access.
- No public leaderboard by default. Rider-facing history and average-speed summaries follow the existing permission rules.

## What this release does and does not implement

Implemented: independent-lane free-ride simulation, scan-based assignment from the fictional club roster, running-lane locks, separate results and CSV activity labels, automated regression tests.

Still to implement: persisted session activity/access policy, opening/closing a live practice session, real club tag resolution including revoked/archived checks, authenticated controller integration, automatic persisted participation, real results, offline recovery and device acknowledgements. The Supabase session screens still support planning only; selecting Free ride in `/bench` does not open a real club session.

The next production slice should add that persisted activity/access policy before connecting the lane scanner to club data. Do not require admins to pre-populate the session participant list as a workaround.
