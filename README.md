# JNS SPLIT web

Sports timing · Every effort counts.

A separate SvelteKit + TypeScript + Tailwind CSS + Flowbite Svelte app, configured with the Vercel adapter. This repository is the companion interface, not a sales site. Hardware stays in https://github.com/chuck808/jns-lanetime.

## Current milestone: reader bench + simulator

Implemented:

- Mobile-responsive charcoal/lime coach workspace.
- Test rider/tag enrolment, full UID preservation, one to four enabled lanes.
- Simulated check-in acceptance/rejection, idempotent retries, unarmed lane moves, and assignment locking at arm.
- Simulated completed/cancelled/DNF runs; fresh scans required after each run.
- Comparable personal session best/mean, time chart, average speed and CSV export.
- Read-only Core2 USB scan ingestion (desktop Chrome/Edge) and pasted JSON fallback.

**This is a development sandbox, not a recorded training system.** All records live in the current browser tab and disappear on refresh. There is no login, Supabase connection, cloud persistence, real timing input or controller acknowledgement. Do not enter real children's details. USB scans are processed by the simulator only. Every exported result is labelled SIMULATED. The Core2 does not claim lane acceptance.

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

Use the included VS Code tasks, or the integrated terminal. The committed lockfile fixes the dependency versions. No environment variables or service accounts are needed for this milestone.

## First walkthrough — before the reader arrives

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

## Separate GitHub repository

Recommended name: `jns-split-web`. Keep it separate from the firmware. If starting from the supplied ZIP:

1. Extract this folder and open it in VS Code.
2. In Source Control, initialise the repository, commit the files, then use **Publish to GitHub** to create a private repository named `jns-split-web`. If you already created an empty GitHub repository, add it as a remote and push instead.
3. Never commit `node_modules`, `.env`, `.vercel` or `.svelte-kit`; these are ignored.

The source is ready, but a remote repository is not created by unpacking the ZIP.

## Vercel test deployment

1. Import the new web repository into Vercel.
2. Use the **SvelteKit** framework preset and Node 22 or 24.
3. Root directory: repository root. Build command: `npm run build`. Leave output directory at its framework default.
4. No Supabase keys are needed for this simulator. The Vercel adapter is already configured.
5. Deploy and repeat the walkthrough. USB access requires a supported desktop browser and user permission; hosted deployment does not itself connect to local ESP-NOW devices.

No Vercel project or deployment has been created by this scaffold. Preview URLs should contain test data only. Check your Vercel plan terms before commercial use.

## Next milestones

See [development plan](docs/development-plan.md), [bench scan contract](docs/reader-contract.md) and [acceptance checklist](docs/acceptance.md).

Supabase remains the intended production backend. Its Auth, database and row-level security will be introduced together; a connected database without permissions is not a usable club-registration release.
