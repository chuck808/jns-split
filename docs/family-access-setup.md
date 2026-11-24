# Family access (migration 012)

Lets a club invite a parent or guardian, or the rider themself, to sign in and see one rider.
Follows `product-experience-v1.md` §5 (rider login, guardian access) and §14 (rider onboarding).
Requires migrations 001–011. It only adds things: existing riders, tags, sessions and coaches are
unchanged. Riders never need an account to ride.

## How it works

- **Club admin:** Riders & tags → **Manage** on a rider → **Family access and invitations**.
  - The club's age bands (Settings → Rider details) decide who can be invited. With the UK preset:
    under 13, a parent or guardian only; 13–17, the admin chooses; 18 and over, the rider.
    With only a year of birth, the rider is treated as the younger possible age.
  - The admin ticks that the club's own check is done, then creates the invitation.
  - Invitations work once, for one email and one rider, and last seven days. They can be renewed
    or withdrawn. **No email is sent yet**: tell the person to sign in with that address.
  - Linked people are listed with a **Remove access** option. Removing one link leaves their
    other riders untouched.
  - Correction requests from families appear on that page, and as a notice on Riders & tags.
- **Parent, guardian or rider:** signs in, or creates an account at `/signup`, with the invited email (see `email-and-sign-up-setup.md`), opens
  **Riders and family** from the account menu, and accepts. They see:
  - the details the club holds (read-only), with a way to ask the club for a correction;
  - a choice of how the name appears on the scoreboard (until they choose, the club default
    applies);
  - a "No results yet" panel. Results arrive once lane timing records them.
    A guardian with two children sees a picker; each child needs their own invitation. They never
    see the club register, other riders, or tag numbers.

Every change is checked in the database and recorded in the club's history.

## Apply the migration

1. Open `supabase/migrations/202611240012_family_access.sql` in VS Code.
2. Select all (**Ctrl + A**) and copy (**Ctrl + C**) the SQL contents — not the file name.
3. In your Supabase project, open **SQL Editor** → **New query**, paste, and click **Run** once.
   It should say "Success. No rows returned". Do not rerun earlier migrations.
4. Restart the app (`npm run dev`).

Until the migration is applied, the family access page and Riders and family show "Apply the
family access migration (012)"; the rest of the app keeps working.

## Trying it

Use made-up riders and a second email address you control (for example a `+family` alias, if your
email provider supports it). Create the invitation as the club admin, then sign in as the second
address in a private browser window.

## Not yet decided

- Who holds responsibility for children's data (hosted or self-hosted) must be settled before a
  second club is onboarded — see "Decisions still open" in `product-experience-v1.md`.
- When a rider passes the club's "rider from" age, existing guardian links stay until the club
  removes them.
