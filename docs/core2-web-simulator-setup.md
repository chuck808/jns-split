# Core2 touchscreen scanner simulator

This release lets a Core2 send fictional tag scans over WiFi to JNS SPLIT. The web app resolves the tag against your test club and responds from an **isolated simulated controller**. No RFID reader is needed. It does not control the timer, create session participation or save measured results.

## 1. Update the web app

Requires the saved session activity update and Supabase migrations 001–006.

Stop the dev server, save/commit local changes and check `git status`. Resolve any unfinished patch operation first. Extract `jns-split-core2-web-test.patch` into the web repository and run these commands once, stopping on any error:

```powershell
git switch -c feat/core2-web-test
git am ./jns-split-core2-web-test.patch
```

Open `supabase/migrations/202611210007_bench_devices.sql`. Copy its **SQL contents** into a new query in your development Supabase SQL Editor and run once. No old migration needs rerunning. Then:

```powershell
npm run check
npm test
npm run dev
```

No dependency changes; no `npm ci` needed. No optional product-requirements document is patched.

## 2. Prepare fictional data

1. In your test club, register **Alex test** with tag `04112233445566` and **Sam test** with tag `04AABBCCDDEEFF`. These are made-up UIDs, not the unknown UIDs of your physical tags. If already assigned to test riders, reuse those records. Do not reassign real riders' tags for this exercise.
2. Create a **Free ride** test session with two lanes. Leave its participant list empty. Complete any configuration changes now.
3. Open the club's **Test equipment** page. Select that session, name the device `Core2 desk test`, confirm fictional test use and create a credential.
4. Copy the whole `device-id.secret` value. It is shown in that form response only; only a hash is stored. Keep it private and out of Git. It expires after 24 hours and can be revoked on the same page.

A credential is tied to the session's current version. Editing the plan, changing coach grants if they change the version, or changing participants may invalidate it: create a fresh credential after finishing setup. `SESSION_CHANGED` also covers closed/cancelled plans. Old credentials do not silently regain access to a new configuration.

## 3. Put the simulator on the Core2

The download contains a standalone `core2-web-simulator` PlatformIO project. Copy that folder somewhere convenient and open it using VS Code → PlatformIO → Open Project. It can also live under the firmware repo's `firmware` folder. This is a separate WiFi bench project, not an update to the ST-1 controller or RFID2 reader firmware.

1. Copy `include/jns_config.example.h` to `include/jns_config.h`.
2. Enter your WiFi SSID/password and paste the test credential into `JNS_TEST_CREDENTIAL`.
3. Set `JNS_ENDPOINT` to your PC's LAN IPv4 address and Vite port, followed by `/api/bench-device`. Example: `http://192.168.1.100:5173/api/bench-device`. Check the actual Vite port printed by `npm run dev`; it can differ if that port is busy.
4. Leave the two fictional tag UIDs as above, or change them to match your fictional web records.
5. Build and Upload with PlatformIO for the connected Core2. Close Serial Monitor if it holds the port open.

`jns_config.h` is ignored by Git in the supplied project. Do not commit WiFi credentials or test tokens. Uploading this project replaces the firmware currently on the Core2; the RFID reader firmware can be uploaded again when needed.

### Local WiFi setup

Run `ipconfig` on Windows and find the IPv4 address of the WiFi/Ethernet adapter connected to the same LAN as the Core2. The Core2's `localhost` would refer to the Core2, not your PC. The app's existing dev command listens on the network.

If Windows Firewall asks, allow Node on your **private** test network. Guest WiFi/client isolation may prevent the Core2 reaching the PC. No router port forwarding is required or recommended for this test.

The supplied example explicitly allows plain HTTP **only to private LAN IPv4 addresses**. Use a trusted test network and fictional data: HTTP does not encrypt the short-lived credential. The Supabase connection from the web server remains HTTPS. This local test setting is not the production device security design.

For a publicly reachable test deployment, use HTTPS, set `JNS_ALLOW_LOCAL_HTTP` to false and supply the appropriate issuing root CA in `JNS_ROOT_CA`. TLS certificate verification is mandatory; there is no insecure fallback. The Core2 waits for network clock synchronisation before TLS requests. Deployment protection that requires a browser login will block this endpoint; use the local setup first rather than putting deployment bypass secrets in firmware.

## 4. Screen controls

The screen always labels responses **SIMULATED**. It shows **Pending server response** during a request. That is not a hardware acknowledgement.

| Button | Action |
| --- | --- |
| Tag A / Tag B | Send a fresh simulated UID scan for the selected lane |
| Unknown tag | Send `DEADBEEF`; leave this UID unregistered for rejection testing |
| Next lane | Cycle lanes 1–4; lanes outside the session's configured count reject scans |
| Sim start | Lock that test lane as running; stands in for a controller start event |
| Clear / end | Clear that test lane, including a running effort; **no time or result is created** |

The simulator allows independent lane tests for either activity. It does not model the real coached group-start protocol or elapsed timing. Coached sessions additionally require the rider to be on the planned participant list; free ride does not.

Wait at least a second between requests. The firmware adds a 1.5-second button guard. Credentials have a 1,000-event test budget and each club can hold up to 20 unexpired, non-revoked test devices. Issue a new credential if its test budget is exhausted; revoke old ones when finished.

## 5. Acceptance walkthrough

1. Lane 1 + Tag A → `ACCEPTED` and Alex's test name. Confirm the word **SIMULATED**.
2. Tag B on lane 1 → `LANE_OCCUPIED`, without replacing Alex.
3. Sim start on lane 1 → `STARTED`. Another scan → `LANE_RUNNING`.
4. Select lane 2 and scan Tag B. It should be accepted while lane 1 is running. Start it independently.
5. Clear/end lane 1. Lane 2 must remain running. Start lane 1 without a fresh scan → `SCAN_FIRST`.
6. Unknown tag → `TAG_UNAVAILABLE`. Lane 3 or 4 in this two-lane plan → `LANE_DISABLED`.
7. Clear a test lane, revoke Alex's test tag in Riders & tags, then scan Tag A → `TAG_UNAVAILABLE`. Archived riders and other-club tags also reject without disclosing another rider's name.
8. Check that the free-ride session still has no real participation or results. All lane state lives in separate private test tables.
9. Revoke the Core2 credential on Test equipment. The next request → `INVALID_OR_EXPIRED_CREDENTIAL`.
10. For a coached test, add the fictional riders to its participant list **before** issuing its credential. An unlisted rider should receive `NOT_IN_SESSION`.

If a request loses its response, the screen says outcome **UNKNOWN**: the server may have processed it. Clear the selected test lane before retrying, or issue a new credential after all existing credentials for that session have been revoked. There is no automatic retry or offline queue. Request IDs are unique across boots; the server safely recognises repeated IDs and marks historical responses `SIMULATED REPLAY` without reapplying lane changes.

Test devices for the same unchanged session share lane state. Creating another device does not reset those lanes while an existing valid credential for that version remains. Revocation blocks subsequent device requests; it does not pretend to cancel an actual timer. Expired/revoked device records and their bounded replay cache are cleaned up when a club provisions another test device.

## Scope and validation

The new SQL is tested with a PostgreSQL-compatible local engine for access control, credentials, revocation, expiry, replay protection, lane conflicts, wrong-club/revoked/archived tags, coached eligibility and free-ride admission. The web app is type checked and production built. The Core2 project is compiled with the pinned PlatformIO libraries.

Physical upload, WiFi reachability, touchscreen operation and your live Supabase walkthrough require testing on your Core2. The actual RFID2 driver, controller acknowledgement protocol, offline handling, automatic participation and measured results are future integration steps. This test endpoint must not be used as production lane authority.

## Optional: test the endpoint from PowerShell before flashing

With the dev server running, copy your new credential when prompted. The request uses the same contract as the Core2 and creates only simulated lane state:

```powershell
$benchCredential = Read-Host 'Paste the 24-hour test credential'
$benchEvent = @{
    simulated = $true
    requestId = [guid]::NewGuid().ToString()
    action = 'scan'
    lane = 1
    uid = '04112233445566'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5173/api/bench-device' -Method Post -ContentType 'application/json' -Headers @{ Authorization = "Bearer $benchCredential" } -Body $benchEvent
Remove-Variable benchCredential
```

Adjust the port if Vite chose another. This scan occupies the simulated lane; use the Core2's Clear/end button before starting the walkthrough, or send a fresh request with `action = 'clear'` and `uid = ''`. Do not paste credentials into chat or commit them to a script.
