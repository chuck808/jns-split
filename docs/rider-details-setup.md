# Rider details (migration 011)

Adds year of birth, the club's own optional fields and per-club rider settings, as agreed in
`product-experience-v1.md` §14. Requires migrations 001–010. It only adds things: existing riders,
tags, sessions and history are unchanged.

## What it adds

- **Year of birth** on every new rider. Existing riders keep working with no year; Riders & tags
  marks them "No year of birth" and opens **Add year of birth and details** when you manage them.
- **Full date of birth** only when the club's age rule needs it ("Age on 31 August"). With the
  default rule ("Age on 31 December", as used in BMX) only the year is stored.
- **Up to two club-defined fields**, for example "British Cycling licence". Each can be optional or
  required. They point to the club's own records and are never used to identify a rider. Removing a
  field keeps values already recorded but stops showing and requiring it.
- **Club rider settings** in Settings → Rider details:
  - how age groups are worked out (31 December, 31 August, or none);
  - who receives the invitation to see a rider's results, as age bands — guardian only under 13,
    the rider from 18, the club chooses in between (UK preset; nothing is hard-coded). These are
    stored now and used when family invitations are switched on;
  - the default name on the scoreboard (first name and initial, initials only, or lane number).

Every change is admin-only, checked in the database, and recorded in the club's history.

## Apply the migration

1. Open `supabase/migrations/202611240011_rider_details.sql` in VS Code.
2. Select all (**Ctrl + A**) and copy (**Ctrl + C**) the SQL contents — not the file name.
3. In your Supabase project, open **SQL Editor** → **New query**, paste, and click **Run** once.
   It should say "Success. No rows returned". Do not rerun earlier migrations.
4. Restart the app (`npm run dev`).

The web update and the migration go together: the new Riders & tags and Settings pages show
"Apply the rider details migration (011) first" until the migration has been run.

## Notes

- The earlier `register_rider` database function is unchanged, for compatibility. The web app now
  uses `register_rider_with_details`, which requires a year of birth.
- If a club switches to the 31 August rule, riders already registered keep their year of birth
  until someone edits them; new riders need a full date of birth.
- Use made-up riders while testing.
