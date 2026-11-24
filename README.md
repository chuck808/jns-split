# JNS SPLIT web

Sports timing · Every effort counts.

A separate SvelteKit + TypeScript + Tailwind CSS + Flowbite Svelte app, configured with the Vercel adapter. This repository is the companion interface, not a sales site. Hardware stays in https://github.com/chuck808/jns-lanetime.

## Current milestone: workspaces and club admission

Built so far (migrations 001–011):

- **Accounts:** sign-in/out, password recovery, account page, light/dark/system theme, and `/app`, which opens the right workspace or offers a chooser.
- **Roles:** independent admin and coach roles within a club; removing a coach role keeps a separate admin role and revokes that coach's session grants.
- **Club admission:** verified accounts apply at `/clubs/request`; a platform administrator reviews at `/admin`. Direct club creation is disabled in the database. Existing pilot clubs are unaffected. The first platform administrator is appointed by an operator script, never by the app — see [club admission setup](docs/club-admission-setup.md).
- **Club administration:** rider register, tag issue/replacement/revocation, coach invitations, session planning with view/edit coach grants, participants, and admin-only test equipment.
- **Rider details:** year of birth on every new rider, up to two club-defined fields, and club settings for age groups, invitation age bands and scoreboard names — see [rider details setup](docs/rider-details-setup.md).
- **Bench:** the browser-local simulator at `/bench`, Core2 USB scan ingestion and an isolated Core2 WiFi test endpoint.

Not built yet: rider and family portals, recorded results, administrator handover, production device pairing and live timing. See the [product experience specification](docs/product-experience-v1.md) for the delivery sequence.

**Use fictional records during testing.** The simulator at `/bench` keeps its data in the current browser tab and loses it on refresh; exports are labelled SIMULATED. Nothing is connected to live timing or controller acknowledgement. The Core2 does not claim lane acceptance.

## Club workspace

The club landing page now shows real registry totals and recent changes. Rider management has moved to its own searchable, paginated section, and club settings support name and speed-unit defaults. **Apply the second SQL migration** using the [club workspace setup guide](docs/club-workspace-setup.md). Equipment remains marked Upcoming. Session planning and per-session coach permissions are now available after migration 004; follow the [session planning setup guide](docs/session-planning-setup.md). Coaches now has invitations and membership management; apply migration 003 using the [coach invitations setup guide](docs/coach-invitations-setup.md).

## Session participants

Club administrators can now add/remove active club riders in planned sessions. Assigned coaches see only those participant names and registration status. Apply migration 005 using the [session participants setup guide](docs/session-participants-setup.md). This is session planning, not lane assignment, attendance or result recording.

## App navigation and account recovery

Home is now `/`; the simulator has moved to `/bench`. Theme controls, About, Help, Contact and Account pages are included. See [account shell and recovery setup](docs/account-shell-setup.md) before testing password reset emails. Invitation management and the full dashboards remain planned.

## VS Code

Use Node.js 22.17+ (Node 24 supported) and npm. Open this folder in VS Code; accept the Svelte and Tailwind extension recommendations.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Commands work in PowerShell, Command Prompt and ordinary Unix terminals.

```sh
npm run check
npm test
npm run build
```

Use the included VS Code tasks, or the integrated terminal. The committed lockfile fixes the dependency versions. No environment variables are needed for the simulator. Club administration requires the setup linked above.

## Bench simulator walkthrough (`/bench`)

1. Live session: tap Alex into lane 1; choose lane 2 and tap Sam.
2. Try the unknown tag and an occupied lane: both should reject.
3. Replay a request: no extra assignment is created.
4. Arm the run. A new scan must not change its riders.
5. Enter simulated elapsed times and record finishes.
6. Results: select the rider; review time, average speed and the chart; export CSV.
7. Both lanes are empty again. Repeat with fresh scans; test cancel and DNF.
8. Clear all lane assignments to change lane count, distance or start mode.

There is deliberately no browser stopwatch: timings entered here are test data, not measurements.

## With the hardware

Follow `firmware/rfid-reader/README.md` in jns-lanetime. The first target is Core2 + RFID2 Port A. Close PlatformIO Serial Monitor before opening Equipment → Connect USB reader. Allow access to the Core2 USB serial device. Alternatively paste a JSON scan line from Serial Monitor.

Use Equipment → Use UID for registration to assign a new physical tag to a test rider. Remove it for at least 500ms before presenting it again. Bench firmware defaults to lane 1; use a one-lane simulator setup for the first physical test. Lane IDs in USB messages are not authenticated; this transport is a test fixture only.

## Repository

The web application lives in `chuck808/jns-split`, separately from the firmware. Never commit `node_modules`, `.env`, `.vercel` or `.svelte-kit`.

## Vercel test deployment

1. Import the new web repository into Vercel.
2. Use the **SvelteKit** framework preset and Node 22 or 24.
3. Root directory: repository root. Build command: `npm run build`. Leave output directory at its framework default.
4. For club registration, configure the two server environment variables in the setup guide. The simulator needs neither. The Vercel adapter is already configured.
5. Deploy and repeat the walkthrough. USB access requires a supported desktop browser and user permission; hosted deployment does not itself connect to local ESP-NOW devices.

No Vercel project or deployment has been created by this scaffold. Preview URLs should contain test data only. Check your Vercel plan terms before commercial use.

## Next milestones

See [development plan](docs/development-plan.md), [bench scan contract](docs/reader-contract.md) and [acceptance checklist](docs/acceptance.md).

Next: slice C (club and coach UX), then slice D (recorded results and account links). Slices are described in the [product experience specification](docs/product-experience-v1.md).

## Free-ride bench workflow

At `/bench`, select **Free ride** under Session configuration to test independent lane starts and finishes without advance session enrolment. All data remains fictional and local to the browser tab. See [setup, walkthrough and production requirements](docs/free-ride-setup.md). No database migration is needed for this simulator update.
