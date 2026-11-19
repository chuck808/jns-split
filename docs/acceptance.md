# Acceptance checklist

## Automated here

Run `npm run check`, `npm test`, `npm run build`. Session tests cover full UID validation, unknown tags, occupied/disabled lanes, replay payload mismatch, lane moves, locking, missing assignments, timing validation, frozen result configuration, cancelled/DNF records and no re-registration on an old retry. Firmware has native presentation tests (including timer wrap and uncertain reads).

## Before hardware

Run README walkthrough. Check desktop and narrow/mobile layout, keyboard focus, screen-reader status announcements and CSV download. Verify refresh clears the test workspace and the simulator warning is visible. Browser visual QA could not run in the authoring environment because its preview relay was unavailable.

## When parts arrive

- Build/upload Core2 bench firmware in PlatformIO. Confirm RFID2 presence at 0x28 on SDA32/SCL33.
- Scan each actual tag; record type and full UID; compare with another known reader if available.
- Hold a tag still for 10s: expect one scan. Remove for >500ms and present: expect one new request ID.
- Move the tag around the edge of the read field: measure whether weak reads create false removal. Do not treat the 500ms threshold as proven until tested.
- Reconnect reader cable: show error then recover; do not claim successful check-in.
- Reboot Core2: new request ID boot prefix, stable reader ID.
- Confirm unknown tag → enrol test rider → fresh physical tap → simulator assignment.
- Try two tags together and record behaviour; only one-at-a-time presentation is supported.
- Close Serial Monitor before Web Serial, and close Web Serial before upload/monitor.
- Try browser disconnect and USB unplug. Existing simulator records remain until refresh; real controller is unaffected because no radio integration exists yet.
- Repeat through intended enclosure with cards, fobs and wristbands before choosing bulk tags.

Firmware build and physical read reliability are separate acceptance gates. No board was attached during authoring. The final handoff records whether the embedded toolchain build completed.
