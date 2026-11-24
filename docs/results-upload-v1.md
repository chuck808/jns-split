# Results upload v1

How a timing controller saves one measured effort to JNS SPLIT. Separate from the
[reader bench contract](reader-contract.md), which saves nothing. Requires migration 013.

## Credential

A club admin creates one under **Timing controllers**:

- **Test**: lasts 7 days. Results are shown to the club's admins and the session's coaches as
  "Demo — simulated data", and never reach riders, families or bests.
- **Live**: lasts 180 days. For real timing equipment only.

The credential looks like `<controller id>.<64 hex characters>`. Only a SHA-256 fingerprint is
stored. Keep it out of firmware repositories: put it in an ignored local config file, as with the
Core2 bench credential. It can be revoked at any time; results already saved are kept.

## Request

`POST /api/timing/efforts` with headers `Content-Type: application/json` and
`Authorization: Bearer <credential>`. Body at most 1024 bytes:

```json
{
  "version": 1,
  "resultId": "A1B2C3-000042",
  "sessionId": "7d0e8a8c-0000-4000-8000-000000000000",
  "lane": 1,
  "uid": "04A1B2C3D4E5F6",
  "outcome": "completed",
  "elapsedMs": 1405
}
```

- `resultId`: chosen by the controller, 1–80 letters, digits, `_` or `-`, unique per credential
  for ever. A boot token plus a counter works (for example the ST-1 boot ID and effort number).
  Reuse the same ID when retrying the same effort.
- `sessionId`: a planned session of the credential's club. Closed or cancelled sessions take no
  more results.
- `lane`: 1–4, within the session's lane count.
- `uid`: the tag the rider checked in with: 4, 7 or 10 bytes in hex; spaces, colons and hyphens
  are ignored. The app finds the rider from the club's active tags at upload time.
- `outcome`: `completed`, `dnf`, `cancelled` or `invalid`.
- `elapsedMs`: whole milliseconds, 1–600000, only when `outcome` is `completed`.

## Reply

JSON with `version: 1` and a `code`:

| HTTP | code                                                  | Meaning and what the controller should do                                                     |
| ---- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 200  | `SAVED`                                               | Stored. `replay: true` means it was already stored: nothing new. Includes `rider` and `test`. |
| 409  | `RESULT_ID_CONFLICT`                                  | That `resultId` was already used with different data. Don't retry; it's a controller bug.     |
| 422  | `TAG_UNAVAILABLE`                                     | No active tag with that UID in this club. Not stored.                                         |
| 422  | `NOT_IN_SESSION`                                      | Coached session and the rider isn't on its list. Not stored.                                  |
| 422  | `LANE_DISABLED`                                       | Lane is above the session's lane count. Not stored.                                           |
| 422  | `SESSION_CLOSED`                                      | Session is closed or cancelled. Not stored.                                                   |
| 422  | `SESSION_UNAVAILABLE`                                 | No such session in this club. Not stored.                                                     |
| 400  | `INVALID_EFFORT`                                      | Body doesn't match this format. Fix and resend.                                               |
| 401  | `INVALID_CREDENTIAL`, `INVALID_OR_EXPIRED_CREDENTIAL` | Wrong, revoked or expired credential.                                                         |
| 409  | `CONTROLLER_LIMIT_REACHED`                            | 20,000 efforts on one credential. Issue a new one.                                            |
| 503  | `BACKEND_UNAVAILABLE`                                 | Try again later with the same `resultId`.                                                     |

A controller should keep an effort queued until it gets **200**, and retry with the same
`resultId` after a timeout or 503. On 422 it should show the reason and drop the effort. Showing
"saved" before a 200 would be misleading.

## What the app stores

Each saved effort is permanent: the rider, lane, outcome and time, plus copies of the session's
distance, start type and activity and the rider's name at that moment. Editing the session or
renaming the rider later doesn't change old results. No one can edit or delete efforts through
the app; corrections will be a separate, audited record.

## Not covered yet

Check-in at the lane reader, controller clock or session binding beyond `sessionId`, and an
offline journal on the controller are separate work (development plan milestones 2 and 4). Until
the ST-1 sends uploads, use `scripts/send-test-effort.mjs` with a Test credential.
