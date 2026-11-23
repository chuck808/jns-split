# Platform administration and reviewed club registration

Built from your pushed `feat/account-workspaces` commit `8f4c7d5`. Requires migrations 001–009. Existing clubs remain intact and do not need to apply again. This release adds the first platform dashboard and club approval workflow, not the later rider/family portals.

## Install the web update

Stop the dev server and save/commit your code edits. Run `git status` and resolve any unfinished patch operation before starting another. Do not add local secrets or loose installation files just for this update.

For the downloadable patch, extract `jns-split-club-admission.patch` into your web project and run once, stopping on any error:

```powershell
git switch -c feat/club-admission
git am ./jns-split-club-admission.patch
```

The patch is based on your exact pushed files, including your login diagnostics. It changes the remaining successful-login redirect from `/club` to `/app`, retaining those diagnostics. No optional historical planning or server-security test file is modified. If you install by fetching the published feature branch instead, do not also apply the patch.

Open `supabase/migrations/202611230010_club_admission.sql`. Copy its **SQL contents**, not its filename, into a new query in your development Supabase SQL Editor and run once. Do not rerun earlier migrations. Then:

```powershell
npm run check
npm test
npm run dev
```

No dependency installation, Core2 firmware upload or replacement device credential is needed solely for this update. Keep this code and migration together: it disables the previous direct-create-club path at the database boundary.

## Appoint your first platform administrator

**The migration appoints nobody automatically.** An existing club admin does not automatically become a platform admin.

1. Choose an existing, confirmed Supabase Auth account for administering the pilot. You may use your existing login; separate club roles remain intact.
2. Open `supabase/operator/grant-platform-admin.sql`. This is a separate operator setup script, not a migration or a PowerShell command.
3. Replace the two quoted placeholder values:
   - `REPLACE_WITH_YOUR_CONFIRMED_ACCOUNT_EMAIL`: the chosen account's email.
   - `REPLACE_WITH_WHO_AUTHORISED_THIS_AND_WHY`: a short note such as `Damien authorised initial pilot administration`.
4. Copy the edited SQL into a **second new query** in Supabase SQL Editor and run it. It rejects unchanged placeholders and requires exactly one confirmed account matching the email. Keep the personalised copy out of Git.
5. In the app, open **Workspaces** (`/app?choose=1`). Choose **Platform administration**. A remembered club workspace may still open after login; use the chooser to switch.

No application endpoint grants this role. Repeating the setup does not duplicate it. An authorised database operator can revoke it by deleting the account's row from `private.platform_admins`. Grant/revocation are audited with the database operator identity and original grant note; this is not a claim that SQL Editor supplied a named human identity. Runtime accounts cannot directly read/write these private tables.

## Applicant journey

Use an existing verified pilot account; this release does not enable public/anonymous account signup. New test accounts still use your normal Supabase Auth provisioning process.

- From Workspaces choose **Your club applications**, or visit `/clubs/request`.
- Enter applicant name, club name and town/region; BMX is the supported pilot sport. Confirm authority to apply for the club.
- The contact email comes from the signed-in verified account. Do not submit rider details or safeguarding documents.
- Submit and see **Awaiting review**. No club workspace exists until approval.
- One application can await review at a time, with a maximum of three new applications per account per 24 hours. Repeating the same submission does not duplicate it, even after approval.
- Pending applications can be withdrawn. Declined/withdrawn applications remain historical; a resubmission is a new application.

Application status and decision reasons are shown in the app. **No application or approval emails are sent in this release.**

## Platform administrator journey

- Open `/admin` through Workspaces. The dashboard shows pending applications, the actual club count, a paginated review queue and the latest ten decisions.
- Open an application. Up to ten existing clubs with exactly the same case-insensitive name are shown for duplicate checking. No automatic club or account merge occurs.
- Approve or decline with a reason and explicit confirmation. The reason is visible to the applicant.
- Approval atomically creates one club and grants its first admin role to the applicant account ID, never an arbitrary typed email/user ID. Repeating approval returns the existing club.
- A completed/withdrawn application cannot be switched to another outcome. Approval requires the applicant still to have a confirmed account; decline remains possible if verification has been lost.
- A platform administrator may review their own application in this pilot. Ordinary applicants cannot approve themselves; no two-reviewer policy is implied.

After approval, the applicant refreshes their application page and chooses **Open your club**, or opens Workspaces to find **Manage [club]**. The verified contact address shown on the application is explicitly the address at submission; subsequent email changes do not transfer the account's identity.

## Scope and access boundaries

Platform authority alone does not grant access to rider records, tags, sessions or test equipment. Someone with separate club roles still has those permissions. Use a platform-only test account to test this boundary accurately.

The initial dashboard does not provide platform-role editing, club suspension, billing, operational uptime, support impersonation or unrestricted rider access. Privileged-account MFA and wider public signup controls remain release work before general availability.

All existing club memberships, rider/tag/session IDs and device state are retained. The old `create_club` RPC rejects direct creation for every runtime account, including platform admins. Approval is now the only supported app path to create a new club.

Club name is copied to the club record. Location, sport and applicant information remain on the application; a fuller editable club profile is later UX work. No destructive rollback script is supplied. Do not restore the old create-club form as a workaround for migration issues.

## Acceptance walkthrough

1. Confirm the existing register, tags, sessions and Core2 monitor still work after installation.
2. Before operator setup, `/admin` must be unavailable. Afterwards the appointed account should have a Platform administration workspace.
3. Submit a fictional club application from a second confirmed account. It must not access another user's application or `/admin`.
4. Approve it. The applicant gains exactly one club and its admin role; refresh/retry must not create another club.
5. Check a platform-only account cannot open unrelated rider registers, sessions or test equipment.
6. Decline another fictional application and verify the applicant sees the reason. Withdraw a pending application and verify approval is blocked.
7. Check mobile-width forms, keyboard navigation, filtering/pagination and light/dark themes.

Automated tests cover the migrated permissions and old data, idempotent operator setup, approval and submission, cross-account access, direct-write and direct-create denial, verification loss, withdrawal, pagination, rate limits, role revocation and login routing. Physical/browser and live Supabase acceptance remain to be checked on your installation.
