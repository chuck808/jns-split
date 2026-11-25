# Families' data rights (migration 020)

Download and erasure for riders' data. Requires migrations 001–019. Not legal advice: the club is
responsible for its riders' data, and the ICO's guidance on children's data and on subject access
and erasure requests is the place to check your club's policy.

## Apply the migration

1. Open `supabase/migrations/202611250020_data_rights.sql` in VS Code.
2. Select all (**Ctrl + A**) and copy (**Ctrl + C**) the SQL contents, not the file name.
3. In Supabase, open **SQL Editor** → **New query**, paste, and click **Run** once.
4. Restart the app (`npm run dev`).

## For families (Riders and family → Your data)

- **Download data** gives a file of everything that page shows about the rider: details, club
  details, results and the family's own requests. It's JSON, which other apps and spreadsheets can
  read. It doesn't include coaches' notes or correction reasons; the page says to ask the club for
  a full copy.
- **Ask the club to erase** sends a request, with an optional message. The family sees whether
  it's waiting or was declined, and the reason given.

## For club admins (Riders & tags → Manage → Family access and invitations → Data and erasure)

- **Download full record**: everything held about the rider, including coaches' notes, correction
  reasons, who has or had access, invitations, requests and the club history. Use it for formal
  subject access requests. **Check it before sending**: it names coaches and other adults, and you
  may be entitled to withhold some of it. Each download is recorded in the club history.
- **Erasure requests** show as a notice on Riders & tags. Decline with a reason the family will see,
  or erase.
- **Erase** (also possible without a request):
  1. **Start erasing…** first lists notes, correction reasons and requests about _other_ riders
     that mention this rider's name. Erasure can't safely rewrite those, so edit them first if they
     should go.
  2. Type the rider's name exactly and tick the confirmation.

## What erasure does

| Data                                                                                                 | Result                                             |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Name, year and date of birth, scoreboard choice                                                      | Replaced: "Removed rider", archived                |
| Club-defined details (e.g. licence number)                                                           | Deleted                                            |
| Their results, with their notes and corrections                                                      | Deleted                                            |
| Results measured on their tag but moved to another rider                                             | Kept for that rider; name copy and reason scrubbed |
| Family links, invitations (including email addresses), correction requests, erasure request messages | Deleted                                            |
| Session lists, test-lane entries, test-simulator records with their tag                              | Deleted                                            |
| Tags                                                                                                 | Revoked (tag numbers are club equipment)           |
| Club history                                                                                         | Kept, holding only an internal ID                  |

The tests check that after erasure the rider's name, date of birth, club details, a guardian's
email and the family's message appear nowhere in the database. Accounts of people who were linked
are not deleted: they're those adults' own accounts.

## Not covered

- Automatic deletion after a retention period (for example when a rider leaves): set a club policy
  first, then this can be scheduled.
- Backups: Supabase backups keep older copies for their retention period. Say so in your privacy
  notice.
