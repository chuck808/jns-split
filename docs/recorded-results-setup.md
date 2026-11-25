# Recorded results (migration 013)

Timing equipment can now save results to a session. Results show on the session page for club
admins and the session's coaches, and in **Riders and family** for linked riders and guardians.
Requires migrations 001–012. It only adds things.

The upload format for controllers is in [results-upload-v1.md](results-upload-v1.md). Until the
ST-1 sends uploads, a small script stands in for it.

## Apply the migration

1. Open `supabase/migrations/202611240013_recorded_results.sql` in VS Code.
2. Select all (**Ctrl + A**) and copy (**Ctrl + C**) the SQL contents, not the file name.
3. In Supabase, open **SQL Editor** → **New query**, paste, and click **Run** once. It should say
   "Success. No rows returned". Don't rerun earlier migrations.
4. Restart the app (`npm run dev`).

## Try it with a Test controller

Use fictional riders. You need a planned session with at least one rider who has a tag. For a
coached session the rider must be on its list; for open practice any rider with a tag will do.

1. As club admin, open **Timing controllers** in the sidebar. Add a controller called
   `Desk test`, choose **Test**, and create it. Copy the credential straight away; it is shown
   only once.
2. On the same page, copy the session ID of your planned session.
3. In PowerShell, in the project folder, store the credential for this window only:

   ```powershell
   $env:TIMING_CREDENTIAL = "paste-the-credential-here"
   ```

4. Send an effort, using your session ID and the rider's tag:

   ```powershell
   node scripts/send-test-effort.mjs --url http://192.168.1.232:5173 --session PASTE-SESSION-ID --lane 1 --uid 001122AB --ms 1405
   ```

   It should reply `Reply 200: SAVED · <rider name> · demo result`.

5. Open the session. **Results** lists the effort, marked **Demo — simulated data**. "Best in this
   session" stays empty because demo results never count.
6. Try the other replies:
   - a non-finish: `--outcome dnf` instead of `--ms 1405`;
   - a tag nobody has: `--uid FFFFFFFF` replies `TAG_UNAVAILABLE`;
   - a rider not on a coached session's list replies `NOT_IN_SESSION`;
   - resend the same effort with `--result <the ID it printed>`: it replies `SAVED (already
saved, nothing new)` and no second row appears.

## Live results

Results only reach riders and families from a **Live** controller, and only those count towards
bests. Create a Live credential only for the real timing equipment. If you do send yourself a
Live effort to see the Riders and family view, use a fictional rider in a throwaway session:
efforts can't be edited or deleted from the app.

## Who sees what

| Person                      | Sees                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| Club admin                  | Every effort in the club's sessions, demo ones labelled            |
| Coach assigned to a session | That session's efforts, demo ones labelled                         |
| Linked rider or guardian    | That rider's Live efforts only: most recent, best times, full list |
| Anyone else                 | Nothing                                                            |

Saved efforts are permanent and keep a copy of the session's distance, start type and activity and
the rider's name, so later edits don't change old results. Revoking a controller keeps the results
it saved.

## Sessions lock once results exist (migration 015)

Apply `supabase/migrations/202611250015_result_integrity.sql` the same way as 013.

- Once a session has any result, its **distance**, **start type** and **type of session** can't
  change, so the session can never misdescribe its results. Its name, date and lane count still
  can. To ride a different setup, plan a new session.
- Speeds and bests always use the distance and start type saved with each effort.
- The lock is enforced by the database, not just the form. Migration 016
  (`202611250016_config_lock_race.sql`, apply the same way) also covers an edit and the first
  upload arriving at the same moment: one always waits for the other, so an effort is never saved
  against settings that then change.
- Bests, counts and "new best" marks are worked out over the whole session in the database. Only
  the list on screen is capped at the newest 500, and the page says so when it is.

## Not yet

Lane check-in from the reader, a progress chart, coach notes and corrections are later steps.

## Progress chart (migration 018)

Apply `supabase/migrations/202611250018_rider_progress.sql` the same way. In **Riders and family**,
the Results card then shows a progress chart for each distance and start type the rider has
ridden. Each point is one session's best Live time, so the chart shows the trend without the noise
of every effort. Faster times are drawn higher, so an improving rider's line rises.

- Worked out over the rider's whole history in the database (up to the latest 100 sessions per
  chart), never from the capped list of efforts.
- A single session shows as a sentence, not a one-point chart.
- Hover or tap a point for the session, date and number of efforts. With the keyboard, focus the
  chart and use the left and right arrow keys; screen readers announce each session.
- **Show as a table** under each chart gives the same figures as a table.
- Demo results and coach notes never appear.

## Correcting results (migration 019)

Apply `supabase/migrations/202611250019_effort_corrections.sql` the same way. On a session page,
each result has a **Correct** link:

- **Mark invalid**, for example a false start or a hand breaking the beam. The time stays listed,
  struck through, but never counts towards bests, new-best marks, previous bests or progress charts.
- **Move to another rider**, for a tag mix-up. Only riders on the session's list, or who rode in it,
  can be chosen. The effort then counts for that rider everywhere, including their family's view.
- **Restore the original**, which undoes the corrections.

The measured result itself is never edited or deleted. Each correction is a separate record with who
made it, when and why, shown as the effort's history and recorded in the club history. Session
coaches and club admins can correct, including after the session is closed. Families see an
invalid effort as "Invalid" but never the reason.
