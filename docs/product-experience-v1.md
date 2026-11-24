# JNS SPLIT — roles, onboarding and product experience

Working implementation specification · 22 November 2026

This document turns the agreed four primary dashboards into one connected product. It supersedes the role, navigation and onboarding assumptions in the older v0.2 plan where they differ. It describes intended behaviour; the implementation inventory below distinguishes what exists. The older planning document is not required to install this one.

## 1. Product direction

JNS SPLIT makes useful sports timing affordable. BMX is the first use case. Most users should never need to understand UIDs, request IDs, database migrations or device credentials.

Everyday session journey: choose a session → check readiness → riders scan → view results. The rider checks in for each effort; a coach does not manually enrol them for every run.

Four primary workspaces: Platform administration, Club administration, Coach, Rider. A Family view supports approved guardians without making them club administrators. One account can access several workspaces through explicit, scoped roles and links. Signing in must never duplicate a rider record.

Public home is an entry point to the product, not a shop. No billing, subscriptions or marketing metrics are required.

## 2. Current implementation — verified against repository

| Area | Present | Gap before the intended experience |
| --- | --- | --- |
| Account | Sign-in/out, password recovery, account page; light/dark/system theme; `/app` workspace resolver and chooser (migration 009) | Safe post-sign-in destination handling (§6 step 1); account profile and managed invitations for new account types |
| Club | Reviewed club admission (migration 010), overview counts, settings, paginated roster, tag lifecycle; independent admin/coach roles | Administrator handover with last-admin protection, task-oriented home |
| Coach | In-app invitations, approved club links, assigned sessions, view/edit grants; coach role independent of a same-club admin role | Unified coach home; no broad rider-history access |
| Session planning | Coached/free-ride policy, distance, start type, lanes, participants, close/cancel | Actual operational session lifecycle and controller state |
| Equipment | Expiring test credentials, Core2 WiFi simulator, admin-only lane monitor | Production device pairing, real health/acknowledgements, friendly operational controls |
| Rider | Club-owned record, optional tag, no login required | Account-to-rider linkage, personal portal, recorded results |
| Guardian | No implementation | Club-approved links to specific children and Family view |
| Platform | Operator-appointed platform role with audit, `/admin` overview, application review with atomic approve/decline | Controlled support access and operational monitoring |
| Results | Browser-local simulation; test lane monitor creates no results | Immutable measured attempts, result permissions, rider charts and comparisons |
| Public | Home, About, Help, Contact page; club application journey at `/clubs/request` | Configured contact delivery and approved notices |

Source areas checked (updated 23 November 2026, after slices A and B): routes under `/app`, `/admin`, `/clubs`, `/club`, `/coach`, `/sessions`, `/account`, `/bench`; migrations 001–010; server access helpers. Existing production-like club data and isolated simulator tables must stay separate.

Two constraints that shaped slices A and B (both now addressed in migrations 009 and 010):

- `club_memberships` currently has one `(club_id,user_id)` row with a single `admin` or `coach` role. Coach queries often explicitly require `role='coach'`. An admin currently operates through admin permissions, not a separate same-club coach role.
- `create_club` still permits an authenticated user with no memberships to create a pilot club. Public registration must replace that entitlement in the database, not merely hide the button. Existing approved pilot clubs must remain intact.

## 3. Account, role and relationship rules

| Concept | Rule |
| --- | --- |
| Account | One authentication identity; email verification establishes email ownership, not club authority or guardianship |
| Platform role | Separately granted; never derived from an email domain, signup checkbox, client metadata or the first person to register |
| Club membership | An account can belong to several clubs; role grants apply only within that club |
| Admin + coach | Both may be granted in the same club; removing one must not remove the other |
| Rider | One current home club; stable rider identity independent of account or tag changes |
| Rider account link | Approved link from an account to its existing rider record, rather than creating another rider on signup |
| Guardian link | Approved, explicit child-specific access; multiple children/guardians supported; no inference from names or email addresses |
| Coach access | Club approval alone is not permission to browse riders. Assigned sessions and any later historical access are separate grants |
| Device | Separate scoped credential; never a human login or rider tag UID |
| Workspace switcher | Shows only authorised contexts. Selection changes the interface, not database entitlements |

A person may be a platform administrator, club administrator, coach, rider and guardian using the same login. Platform authority alone does not confer access to rider-level data. Explicit club roles can separately grant that access.

## 4. Permission matrix

“Own club” means an active administrator grant. “Assigned” means an active club coach role plus an explicit session grant. Every read and write is checked on the server/database, including direct API calls.

| Capability | Platform admin | Club admin | Coach | Rider account | Guardian |
| --- | --- | --- | --- | --- | --- |
| Review club applications | Yes | Own application status | No | No | No |
| Grant platform administrators | Separate privileged process | No | No | No | No |
| Manage club administrators | Scoped recovery only, audited | Own club; protect last admin | No | No | No |
| Register/archive riders and manage tags | No default access | Own club | No | No | No |
| Invite/approve coaches | No default access | Own club | Accept own invitation | No | No |
| Approve rider/guardian account links | No default access | Own club | No | Accept own invitation | Accept own invitation |
| Create sessions/change admission policy | No default access | Own club | Not initially | No | No |
| View session | No default access | Own club | Assigned | Own results only | Linked child's results only |
| Edit/close session | No default access | Own club | Explicit edit grant | No | No |
| Prepare coached participant list | No default access | Own club | Not initially | No | No |
| View open-practice participants | No default access | Own club | Assigned session, after participation established | Self only | Linked child only |
| View historical results | No default access | Own-club scope under transfer policy | Separate approved history grant | Own rider record | Explicitly linked child |
| View test diagnostics/credentials | No default access | Own club | No initially | No | No |
| Correct results | No default access | Future audited workflow | Not initially | Request correction | Request correction |
| Export | Scoped support only | Authorised scope | Not initially | Own results | Linked child's results |
| Edit own preferences/recover password | Yes | Yes | Yes | Yes | Yes |

Support access, if later implemented, requires a reason, explicit scope, expiry and an audit record. No unrestricted “impersonate any rider” button. Platform suspension is not introduced until read, write, device-upload and in-progress-session behaviour are defined.

## 5. Onboarding contracts

### Club registration

Applicant signs in with a verified account → submits club details → sees Pending review → platform administrator approves or declines → approved applicant becomes the first club administrator → club setup checklist.

Minimum application fields: club name, sport (BMX initially), town/region, applicant name, verified contact email and confirmation that they are authorised to act for the club. Do not collect member rosters, children's details, payment information or safeguarding documents at this stage. Duplicate club names trigger review, not automatic account merging.

States: draft → submitted → approved / declined / withdrawn. Resubmission after decline is an explicit new review, not a hidden status reset. Applicant can view only their applications; reviewers see application metadata, not riders.

Approval transaction must lock the application, recheck reviewer authority, create exactly one club, grant exactly one initial admin role and append an audit entry. Repeated approval must not create duplicates. Approval of a withdrawn/declined application must fail unless an explicit resubmission exists. The verified applicant account ID is the recipient; a typed email is not enough to nominate another administrator.

For the pilot, provision the first platform administrator through a reviewed operator-only setup procedure. Never ship public self-promotion or automatic first-user elevation. Account creation remains controlled until signup, verification, application-abuse controls and email delivery are configured. Existing pilot clubs are migrated as established clubs, not forced through re-registration.

Checklist after approval: club details → administrators → register riders → invite coaches → equipment readiness → plan first session. Mark steps complete from actual stored facts. Production equipment readiness must not be satisfied by a simulator credential.

### Coach onboarding

Club admin invites a verified email → coach signs in and explicitly accepts → club link appears → club admin assigns sessions and view/edit permission. The existing invitation flow can be reused. Pending, declined, revoked and expired invitations need clear messages. Future email delivery should link to the app; never claim an email was sent when only an in-app invitation exists.

A visiting coach chooses the club and session they are working with. Membership does not expose the whole club roster. Removing a coach role revokes its session grants; re-adding the role must not restore old grants. If the account is also an admin, that separately authorised admin access remains.

### Rider registration and optional login

Club admin searches the register to avoid duplicates → creates the rider record → optionally assigns a tag → rider can train without an account. Registering a rider is not creating a password.

For personal access, admin verifies the intended recipient using club procedures → issues an expiring invitation bound to that rider and recipient email → recipient verifies/signs in and accepts → link becomes active. Never allow public signup to claim a rider by name, UID or date of birth. No hard-coded age threshold is introduced until account eligibility is agreed.

The rider's dashboard initially shows an honest empty state until authorised recorded results exist. No invented personal bests, demo results mixed into history or invitations to another rider's data.

### Guardian access

Club verifies the relationship through its existing process → selects the specific child and recipient → sends an expiring invitation → guardian accepts → Family view shows that child. A second child requires a second approved link. Removing one link leaves other children untouched. Approving this relationship does not collect or certify safeguarding documentation.

The guardian can view results only; editing the rider profile, issuing tags and consenting to unrelated changes are not automatically included. Exact eligibility and permission wording must be agreed before launching this journey with real families.

### Administrator handover

An existing admin invites a replacement/additional admin. The invitee accepts before access changes. Prevent removal of the last active admin and prevent self-removal from stranding a club. Emergency recovery uses a separate platform support process with identity verification and audit; it is not a routine platform dashboard shortcut.

## 6. Navigation and sign-in

Proposed entry route: `/app`. After sign-in or invitation acceptance, resolve real permissions server-side:

1. Honour a safe internal destination only if the account is authorised for it.
2. Otherwise restore the last still-authorised workspace.
3. With one eligible workspace, open it; with several, offer a chooser.
4. With no grants, show pending invitations/application status and clear next steps. Do not display an empty club dashboard or allow self-selection of an admin role.

Workspace labels describe the task: “Manage [club]”, “Coach”, “My progress”, “Family”, “Platform administration”. Within Coach, select the club/session rather than changing login. Account, appearance, help and sign-out stay in consistent positions.

| Workspace | Main navigation | Landing priority |
| --- | --- | --- |
| Platform | Overview, Club applications, Clubs, Access, Audit | Applications needing review; actual service issues |
| Club | Home, Sessions, Riders, Coaches & access, Equipment, Settings | Today's work and a clear next action |
| Coach | Home, My sessions, Club links | Assigned sessions to prepare/resume |
| Rider | My progress, My sessions, Account | Most recent completed effort and comparable progress |
| Family | Children, Selected child's progress, Account | Choose a linked child; no mixed family leaderboard |

Retain existing URLs during transition. `/sessions/[sessionId]` stays the shared authorised session view. `/club`, `/coach` and `/coach/sessions` remain valid entry points. Do not break recovery links or remove the working test pages while moving diagnostics out of everyday navigation.

## 7. Dashboard screen specifications

### Platform home

Header: “Platform administration”, account and workspace switcher. Primary action: Review club applications. First section: pending applications with club, region, submitted date and reviewer state. Second: genuine operational issues, if a monitored source exists. Third: recent administrative decisions with actor/time. Do not show invented uptime or commercial metrics.

Empty state: “No club applications need review.” Application review has the submitted information, approval/decline actions and a decision reason. Neither a club list nor approval grants blanket access to riders.

### Club home

Header: club name and today's local date. Primary action initially **Plan a session**; change to **Start a session** only when real operational controls exist. First section: today's/upcoming sessions with activity, readiness and assigned coach. Quick tasks: register rider, assign tag, invite coach. Secondary cards: riders awaiting tags, outstanding invitations and equipment requiring attention, using real query data.

New club empty state: a short setup checklist, not a wall of zero-valued charts. Do not imply equipment is online based on an unexpired credential. Show “Not connected” or “Last heard at…” only when evidence supports it.

### Coach home

Header: “Your sessions” with club filter when needed. Primary card: next assigned session, time, club, activity and permitted action. “View session” for view-only access; editing controls only where granted. Secondary: upcoming sessions, club invitations and recent authorised sessions.

Empty states distinguish no club links, invitation awaiting acceptance and no assigned sessions. The coach must not infer that a blank list means there are no sessions at the club. Rider-history browsing is omitted until a separate access workflow exists.

### Rider home

Header: rider display name, home club and account context. First: most recent valid effort with distance, start type, elapsed time and average speed. Second: best comparable time and number of valid efforts. Third: a clear time-over-date graph with matching accessible table, units and filters. Compare like-for-like distance/start/activity initially; do not infer peak speed or acceleration.

Before measured results: “Your results will appear here after your first recorded session.” A rider without an active tag can receive a club-contact prompt without exposing the tag UID. Do not show simulated test-lane activity as progress.

### Family home

Choose an approved child, then reuse the rider progress components scoped to that child. Keep the child's identity visible on every page. No all-children merged progress graph. Empty state directs the guardian to the club for an invitation; no self-service child search.

## 8. Session language and separation of testing

| Interface label | Supporting explanation |
| --- | --- |
| Open practice | Club riders scan and take turns. No rider list needed. |
| Coached session | Choose the riders taking part before the session. Riders still scan for each effort. |
| Standing start | Time from the configured start signal. Equipment determines the supported trigger. |
| Flying start | Time begins when the rider crosses the start sensor. |
| Waiting for rider | Lane is available; scan at its reader. |
| Checking tag | Scan received; lane assignment is not yet confirmed. |
| Rider ready | Controller accepted this rider for the lane. |
| Running | Timing controller reports an effort underway. |
| Saving result | Measured effort received; storage confirmation is pending. |
| Result saved | Storage confirmed; show the valid measured result. |

“Open practice” is the user-facing name for the existing `free_ride` value; this does not require rewriting old identifiers. Distinguish saved plan, open operational session and running individual effort. Existing `planned/closed/cancelled` states are planning states; do not relabel planned as live.

Everyday equipment page: readable connection/readiness messages and guided setup. Administrator Diagnostics: test credentials, raw response codes, simulator and troubleshooting. Preserve a prominent “Demo — simulated data” label wherever simulated actions/results exist; testing cannot be made indistinguishable from real recording through visual polish.

Friendly rejection examples: “Lane already in use—please wait”; “Tag not recognised—ask a club administrator”; “You're not on this coached session's list”; “Connection lost—checking whether the lane accepted you.” Technical codes remain available in diagnostic details.

## 9. Shared design and interaction requirements

- Mobile-first single-column task flow; tablet-friendly lane cards and desktop sidebar. Design at 360 px phone, approximately 768 px tablet and desktop widths.
- One obvious primary action per screen. Larger, well-spaced touch controls at the track, text labels as well as status colours, visible focus and keyboard support.
- Light/dark/system themes have equivalent meaning and contrast. No hover-only help or colour-only status.
- Times display in the user's/local-club context with timezone visible when relevant; dates stored consistently. A schedule-time UI upgrade must deliberately convert values rather than relabel UTC inputs as local.
- No empty graphs, fake counters or buttons that look live before a feature exists. Use task-specific empty states and honest “not connected yet” messages.
- Preserve safe form input after validation errors. Explain what changed and the next useful action. Duplicate submission and stale edits must not create duplicate records or overwrite changes.
- Confirm destructive or access-changing actions with affected scope. Routine navigation, theme changes and normal scans need no confirmation dialog.
- Loading, offline, stale data, access removed, expired invitation and recovery states are part of the screen design, not later additions.

## 10. Data and migration strategy

Keep accounts, club roles, rider records, guardian links and device credentials separate. Candidate additions:

| Entity | Purpose / constraint |
| --- | --- |
| Platform role grants | Trusted assignment and revocation with audit; no self-service insert |
| Club applications | Applicant account, minimal club data, review status, reviewer and decision record |
| Club membership roles | Multiple roles on existing club/account membership, preserving its composite identity |
| Account–rider links | Explicit verified link to one existing rider identity; duplicate/conflicting claims handled by club |
| Guardian links | Account + rider + active/revoked state; per-child scope |
| Access invitations | Recipient, scope, expiry, revocation and single-use acceptance; never trust client role claims |
| Support grants | Future scoped/time-limited exceptional access; omitted until required and approved |

Preserve the existing `(club_id,user_id)` membership anchor used by session-coach foreign keys. Add role grants beneath it rather than casually changing the primary key. Migrate existing roles, update permission helpers/RPCs together, and remove old single-role assumptions only after equivalent tests pass. `remove_coach` currently deletes the membership row: it must be changed to remove the coach role and its grants while preserving an independent admin role. Removing/re-adding a coach must not resurrect old session permissions.

Approval must replace unrestricted pilot club creation at the database boundary. Existing clubs, rider IDs, tag history, sessions, participants and coach permissions survive. Schema changes are additive or explicitly migrated and shipped as numbered SQL files, with rollback/recovery instructions appropriate to each change. Do not infer a platform admin from existing club membership.

No final schema for guardian consent, transfers or measured-result retention is claimed here. Resolve their policy-dependent details before exposing those operations.

## 11. Delivery sequence

### A. Workspace and access foundation

Implement multi-role club membership and a server-side workspace resolver. Add `/app` and a permissions-driven switcher using only implemented destinations. Existing club and coach flows continue to work; rider/family/platform entries appear only once implemented and granted. Include access-revocation and role-combination tests.

### B. Platform administration and proper club admission

Trusted first-platform-admin setup; application submission/status; review dashboard; atomic approve/decline; initial club-admin role; removal of public pilot-create bypass. Configure account verification and invitation delivery before opening registration publicly. Migrate current pilot clubs as established.

### C. Club and coach UX

Apply the shared navigation, home dashboards, onboarding checklist and plain session language. Move test tools under Diagnostics with working redirects. Keep current plan/simulator limitations visible. Deliver screen previews for club home, coach home and session setup before broad visual restructuring.

### D. Recorded-results foundation and account links

Build validated measured-result ingestion and immutable identity/configuration snapshots, then club-approved rider account links. Demo result experiments remain separate. Result access tests come before personal progress displays.

### E. Rider and Family portals

Rider home, comparable progress, accessible history and scoped exports; approved guardian invitations and child selection. Release only after account eligibility/link approval and data-lifecycle decisions are settled.

Each slice is a separate tested patch. Do not combine access-control changes, all dashboard redesigns and hardware timing into one release.

## 12. Acceptance scenarios

1. An account with one workspace opens it; an account with several can switch without signing out. Guessed roles/club IDs never grant access.
2. Same-club admin+coach retains admin access when the coach role is removed; coach grants do not return upon re-invitation. A coach-only account never gains admin access.
3. Platform admin can review applications but cannot browse rider records through that role alone.
4. Repeated application approval creates one club; applicant substitution and self-approval without platform authority fail. Existing pilot clubs survive migration.
5. Expired, revoked, wrong-email and reused invitations fail clearly; no duplicate rider is created on account linking.
6. Rider A cannot read Rider B's results. A guardian can read only explicitly linked children. Revoking one relationship removes that access without affecting unrelated links.
7. Open practice requires no prepared participant list; coached sessions preserve their planned eligibility. Real lane acceptance is never inferred from a successful web upload.
8. No test events appear in genuine attendance/history or result charts. Offline/stale states remain explicit after visual redesign.
9. Every dashboard has usable mobile, keyboard, empty and access-removed states, checked in both themes.
10. Club handover cannot remove its last active administrator. Transfers and deletion are unavailable until their policies and implementations exist.

## 13. Decisions reserved for later slices

These do not block the workspace/design foundation: initial platform operator account; signup/invitation email delivery and support destination; rider-account eligibility and guardian verification wording; transfer and historical access policy; retention/deletion rules; suspension and support-recovery procedure. No arbitrary legal, age or retention rules are introduced by this document.

Slices A and B are implemented (migrations 009 and 010). The next code release is slice C.

## 14. Agreed direction — 23 November 2026

Recorded after reviewing two rounds of screen mock-ups. Where this section differs from earlier sections, this section wins. It describes intended behaviour only; nothing here is implemented yet.

### Build order

1. **One lane, no web app.** ST-1, FN-1 and LN-1 have passed synchronisation tests. Next: prove a single lane at the club (beam-to-timestamp latency, repeatability against a reference, outdoor conditions, ESP-NOW range, battery over a club night).
2. **Four lanes.**
3. **Lane readers (RFID).**
4. **Web app** — slice C onwards, aimed first at what one club needs: club admin, base station, trackside session mode, results and recaps. Rider/Family portals and platform polish follow.

### Four dashboards, one account

- Four role dashboards: Platform administrator, Club administrator, Coach, Rider. One login may hold several roles; switching is a lightweight account menu, not a separate chooser screen most people ever see.
- Guardian access is the Rider dashboard scoped to a linked child (child picker, child's name always visible, view only). It is designed in now and may launch later.
- When one person both coaches a rider and is their guardian, the interface makes clear which role grants which access. Full history comes through the guardian link, not through coaching.

### Three contexts

| Context | Who | Character |
| --- | --- | --- |
| Trackside | Coach (session mode), riders (scoreboard), club admin (equipment check) | Full-screen, light, high contrast, large targets, minimal navigation; works on a tablet |
| Desk | Club admin, coach, platform admin | Sidebar layout; planning, riders, results, administration |
| Phone | Rider, guardian | Own times, bests by effort type, progress, session recaps; no administration or device terms |

### Trackside

- Sessions are planned as structure (for example 6 × 20 m flying, 3 min rest); riders run in heats of up to four lanes.
- Coach session mode shows lanes, a rest timer, one primary action per step and a squad grid (riders × reps, gap to each rider's prior best, new bests marked, coach notes per effort).
- A scoreboard view for a TV or tablet at the start shows the latest reveal, who is next and rest time. It lists new bests rather than a ranking; any ranking is a later, opt-in decision.
- Lane colours are fixed everywhere — posts, lane displays, scoreboard and app: lane 1 `#FF5A36`, lane 2 `#3B82F6`, lane 3 `#FFC83D`, lane 4 `#22C3A6`. Lane numbers are always shown with the colour.

### Two kinds of RFID reader

| Reader | Where | Does | Never does |
| --- | --- | --- | --- |
| Base station | USB on the club laptop, under Riders & tags | Registers riders, links tags, replaces lost tags, batch-tags riders | Takes part in a session or timing |
| Lane reader | A few metres behind each start line, in Flying, Standing and Open practice | A tap reserves that lane for one effort; the rider then rolls or walks to the line | Creates riders or assigns tags; unknown tags are rejected |

A lane check-in is pending until the rider starts. It needs an expiry and a coach "clear" action. Wrong-lane and swapped-tag behaviour must be tested at the track before the trackside interface is finalised.

### Rider onboarding

*Implemented in migration 011 (core and club-defined fields, age rule, invitation bands, scoreboard default). Invitations themselves arrive with family access.*

- **Core fields, every club and sport:** display name, year of birth, who to invite (rider, guardian or nobody yet) with an email, a tick that the club's own permissions process is complete, and the tag (read by the base station, never typed).
- **Club-defined optional fields:** up to two, labelled by the club (for example British Cycling licence, KNWU licentie, USA BMX membership). They point to the club's own records and are never used for identity or duplicate detection.
- A tagged rider can ride immediately. No invitation has to be accepted first, and a rider with no linked account is normal rather than a warning state.
- The registration desk is the guardian check: the admin enters the guardian's email with them present. The invitation is bound to one rider and one email, single-use and expiring, and can be resent from the rider record.
- The invitee signs in, confirms the club-held details (read-only, with a "request a correction" route) and chooses how the rider's name appears on the scoreboard (first name and initial, initials only, or lane number only).

### Club settings that keep SPLIT country- and sport-neutral

- **Age rule chosen by sport:** for example age on 31 December, which needs only year of birth, or age on 31 August, which needs a full date of birth. A full date of birth is collected only when the club's age rule requires it.
- **Invitation recipient by country and age band:** for example the UK preset is guardian only under 13, club's choice from 13 to 17, rider from 18. No age threshold is hard-coded. Presets must be checked against each country's rules before clubs there are onboarded.
- **Default scoreboard name** until a family chooses.
- **Terminology and units:** rider or athlete, km/h or mph. User-facing wording is kept in one place so translation is configuration later.

### Decisions still open

- Hosted service versus self-hosted open source. This determines who holds responsibility for children's data across jurisdictions, and must be settled before a second club is onboarded.
- Heat size, rest defaults and set structures need checking against real coaching practice.
- Whether to offer family pre-registration before a club night. Deferred; desk registration plus an invitation is sufficient for now.

Reference mock-ups: the "JNS SPLIT — app mock-ups" design canvas, page "Round 2 — four dashboards". The mock-ups are illustrative; this section is the agreed record.
