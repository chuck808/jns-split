# Trackside coach view (migration 014)

A live screen for coaches at the track: open a session and choose **Trackside view**. Requires
migrations 001–013. It adds one read-only database function.

## Apply the migration

1. Open `supabase/migrations/202611240014_trackside.sql` in VS Code.
2. Select all (**Ctrl + A**) and copy (**Ctrl + C**) the SQL contents, not the file name.
3. In Supabase, open **SQL Editor** → **New query**, paste, and click **Run** once.
4. Restart the app (`npm run dev`).

## What it shows

- **Lane cards:** the newest effort in each lane: rider, time, "New best" and how long ago.
- **Squad grid:** one row per rider, one column per effort in order, then:
  - **Best today:** fastest Live time in this session;
  - **Previous:** the rider's best Live time at this distance and start type from earlier
    sessions;
  - **Gap:** best today minus previous; negative (highlighted) means faster;
  - **Rest:** time since their last effort, ticking.
- For a coached session, riders on the list who haven't ridden yet are listed at the bottom.
- **New best** marks a time faster than the rider's previous best and anything earlier today.
  With no previous best, the first time sets the bar.
- Demo results from a Test controller appear in grey and never count as bests.

It refreshes every two seconds while the tab is visible and pauses when hidden. If a refresh fails
it says **Out of date** with the time of the last good update. New efforts are highlighted
briefly and read out to screen readers.

## Who sees previous bests

A coach only sees a rider's earlier results with a separate history grant (product spec §3), so
**Previous** only uses sessions the viewer can already open. A club admin sees the club's sessions.
A coach sees their own assigned sessions only, so a coach on just tonight's session sees "—".

## Try it

1. Open a planned session with riders, choose **Trackside view**, and leave it open.
2. Send efforts with `scripts/send-test-effort.mjs` (see `recorded-results-setup.md`). Each
   appears within about two seconds. Test-controller efforts show as demo, so they never become a
   "New best". To see bests and gaps you need Live results, which you'd only send from real
   timing equipment or for a fictional rider in a throwaway session.

## Coach notes (migration 017)

Apply `supabase/migrations/202611250017_effort_notes.sql` the same way.

Tap any time in the squad grid to add a short note (up to 280 characters), such as "Late off the
gate". A dot marks times with a note, and all of a session's notes are listed under the grid.
Notes also show on the session page's results.

- One shared note per effort. Any coach on the session, or a club admin, can write, change or
  clear it. The last writer and time are kept.
- **Seen only by the session's coaches and club admins.** Riders and families never see notes.
- Notes can be added after the session is closed. They never change the result itself.

## Not yet

A rest timer you can start yourself, and lane check-in from the readers.
