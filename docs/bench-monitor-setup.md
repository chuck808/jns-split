# Live simulated lane monitor

This update adds a read-only view to the club's **Test equipment** page. It follows the Core2 web test update and requires migrations 001–007. No firmware change is needed.

## Install

1. Stop the web dev server, save/commit your local changes and run `git status`. Resolve any unfinished patch operation before starting another.
2. Extract `jns-split-bench-monitor.patch` into the web repository. Run these once, stopping on any error:

```powershell
git switch -c feat/bench-monitor
git am ./jns-split-bench-monitor.patch
```

3. Open `supabase/migrations/202611220008_bench_monitor.sql`. Copy its **SQL contents**, not its filename, into a new Supabase SQL Editor query. Run once. Do not rerun previous migrations.
4. Run:

```powershell
npm run check
npm test
npm run dev
```

No dependency changes, so no `npm ci`. This patch does not depend on the optional requirements document or the previously missing `tests/server-security.mjs` file.

## Use it

1. Sign in as a club administrator and open **Test equipment**.
2. Under **Live test lanes**, select the session associated with your Core2 credential. Planned sessions on the current page and sessions referenced by the recent test devices are offered. Use the session pagination below if needed.
3. Keep the browser tab visible. It refreshes approximately every three seconds, with no overlapping requests. The timestamp shows the last successful refresh in your browser's local time. Hidden tabs pause scheduled polling.
4. Press Tag A on the Core2. Expect Alex's test name in the selected lane and a **Rider accepted** event.
5. Press Sim start: the lane changes to **Simulated running**. Clear/end returns it to **Awaiting scan** and adds **Lane cleared — no result**.
6. Try Tag B on an occupied lane, an unknown tag and a disabled lane. The recent responses should explain each rejection without replacing the lane's rider.

The Core2 can keep its existing endpoint, including your PC's `192.168.1.232` address if still current. No new credential is required solely for this update. Credentials still expire after 24 hours; if expired, issue a new one and update/re-upload `include/jns_config.h` as before.

## What the screen means

- Four lane cards show enabled/disabled lanes, assigned test rider and simulated running state. They do not show real timing hardware status.
- A successful refresh proves the app reached the database, not that the Core2 is online. The usable-credential count is not a device heartbeat.
- With no usable credentials for the current plan, a notice explains that the cards are retained test state. Revoking a credential does not silently clear a running test lane.
- A failed refresh labels the last snapshot **OUT OF DATE**. Authentication/access failures clear the snapshot and stop polling. Sign in again or use Reconnect / refresh now after resolving the problem.
- Choosing a different session clears the old snapshot immediately. Late responses from the previous selection are ignored.
- Polling does not reload the parent form or hide a newly issued credential.

## Recent test responses

The table shows up to 20 retained requests, newest timestamp first, with device name, lane, action and response. A replay is not a new event and does not apply lane changes again. Events from earlier session versions are marked.

Requests saved before migration 008 have no known timestamp and are labelled accordingly; the migration does not invent historical times. New requests receive a timestamp automatically. The Core2 request/response protocol is unchanged.

Invalid/expired credentials, malformed requests, throttling and SESSION_CHANGED responses are rejected before entering the existing request cache, so they do not appear in this table. Check the Core2 screen for those diagnostics.

The event list is temporary test data, not an audit log. Provisioning another device removes expired/revoked device records and their cached responses, as before. Token secrets, token hashes, full tag UIDs and raw request fingerprints are never returned by the monitor.

## Acceptance checks

- Run Tag A / occupied lane / Sim start / second lane / Clear/end and verify the cards match after the next refresh.
- Keep a test rider in lane 1 while using lane 2; confirm the first lane is not replaced.
- Switch sessions while refreshing and confirm no previous-session data appears under the new selection.
- Stop the web server temporarily: the last snapshot must become explicitly out of date, then recover after restarting. A timeout can take up to 10 seconds to show.
- Revoke the last usable credential: the monitor shows retained state and warns that no usable credentials remain.
- Check mobile-width layout and both themes.
- A coach or another club's admin must not be able to call the monitor endpoint for this club/session. Admin access is checked in the database on every request.

All state remains in the isolated simulator tables. This update creates no participation, attendance, measured times or rider results.
