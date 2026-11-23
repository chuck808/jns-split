# Club workspace update

This update adds a club overview, a separate searchable rider register, database pagination and club settings. Existing riders, tags and audit records are retained.

## Install the code

Prerequisites: the club-registration and account-shell patches, including the same-origin theme/form fix. Save and commit any local edits before applying a patch; do not overwrite unresolved changes.

1. Stop the local dev server with Ctrl+C.
2. Extract `jns-split-club-workspace.patch` from the download ZIP into your repository folder.
3. In the repository terminal run:

```sh
git switch -c feat/club-workspace
git am ./jns-split-club-workspace.patch
```

If you already created that branch, skip the `git switch -c` command. No dependencies changed, so `npm ci` is not needed for this update.

## Apply the new SQL migration

1. In VS Code, open **supabase → migrations → 202611200002_club_workspace.sql**.
2. Click inside that file, press Ctrl+A, then Ctrl+C to copy **the SQL code inside it**.
3. In your development Supabase project's SQL Editor, open a new query and paste that code. Do not paste the filename or path.
4. Click **Run**. A successful run normally says “Success. No rows returned”.
5. Run this migration once, after the original registry migration. Do **not** rerun `202611190001_club_registry.sql` and do not delete existing tables.
6. Start the app with `npm run dev` and refresh your browser.

The new migration adds one default preference column, allows a club-settings audit event, and adds three permission-checked database functions. It uses a transaction. If it fails, keep the full error text; do not try removing constraints or disabling RLS.

## What changed

- `/club/[clubId]` is now the overview. It shows actual active riders, active tags, riders awaiting tags, archived riders and the latest ten club actions.
- `/club/[clubId]/riders` contains registration, tag management and USB/pasted scan capture. Existing register URLs lead to the overview, with a prominent rider-management link. Submissions from old open register tabs remain supported.
- Search matches part of the rider's name or active UID, case-insensitively and literally. `%` and `_` do not act as wildcards. For tag search, enter contiguous hexadecimal characters.
- Filters: Active, Awaiting tag, Archived and All riders. Results show 25 riders per page, ordered by name then immutable ID. Out-of-range pages clamp to the final available page.
- Individual tag history displays the latest 50 assignments, with the active assignment first. Older assignments remain stored. This is a bounded history view, not permanent deletion.
- Settings let a club administrator change the club name and preferred speed unit. Changed settings create an audit entry; saving the same values again does not. The speed preference is stored for future recorded displays and does not change the bench simulator or measured data.
- Coaches, Sessions and Equipment have honest Upcoming pages, with no invented activity, status or disabled controls that look operational.
- All routes and functions remain restricted to administrators of the specified club. Coach access is not enabled by this update.

## Test locally

1. Open your club. Confirm Jamie808 and the rider totals are still correct.
2. Open Riders & tags. Search for Jamie808 and, if present, part of their current UID.
3. Try Active, Awaiting tag, Archived and All riders. An empty search result must not imply that records were deleted.
4. Register a fictional rider without a tag; verify the overview's awaiting-tag count increases. Issue a dummy tag and check the count decreases.
5. Replace/revoke a tag and inspect history. Archive a test rider, then locate them using the Archived filter.
6. If you have more than 25 test riders, use Next and Previous; check that filters stay selected.
7. Rename the club in Settings and refresh. Confirm the sidebar and club chooser use the saved name. Change the speed preference and check that it survives refresh.
8. Use a different club admin account: it must not open this club's overview, riders or settings URLs. Log out and verify protected pages require sign-in.
9. Check narrow/mobile layout, both themes and keyboard navigation.

Automated validation executes both migrations against a populated PostgreSQL test database, tests cross-club/coach/anonymous denials, protects direct table writes, and checks search, page boundaries, metrics and audited settings updates. This does not replace a walkthrough against your live development project.
