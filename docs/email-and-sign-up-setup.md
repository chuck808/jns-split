# Email and sign-up setup

Adds a **Create an account** page at `/signup` so parents, guardians, riders and coaches your club
invites can make their own account. No database migration is needed.

Sign-up is only safe from migration 010 onwards: a new account can't create a club, only apply for
one, and a platform administrator must approve it. Invitations only work for an account whose email
has been **confirmed**, so nobody can claim someone else's invitation by typing their address.

Supabase dashboard menus move around from time to time. If a name below doesn't match exactly, look
for the nearest equivalent under **Authentication**.

## 1. Switch sign-up on

1. In your Supabase project open **Authentication** → **Sign In / Providers**.
2. Turn on **Allow new users to sign up**.
3. Under **Email**, keep **Confirm email** turned on. Save.

## 2. Set the site address

**Authentication** → **URL Configuration** → **Site URL** must be the address people open the app
on. For testing on your network that's the address Vite prints, for example
`http://192.168.1.232:5173`. Links in emails only work on a device that can reach that address.

## 3. Use the app's confirmation link

The app confirms email links on its own page, like password reset does. Open **Authentication** →
**Emails** → **Confirm signup** and replace the template with this HTML (it is an email template,
not SQL):

```html
<h2>Confirm your JNS SPLIT account</h2>
<p>Use the link below to confirm this is your email address.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm my email</a>
</p>
<p>If you didn't create an account, you can ignore this email.</p>
```

Save it. The password reset template from `account-shell-setup.md` stays as it is.

## 4. Email delivery: the important bit

Supabase's built-in email sender is for trying things out only. It sends very few emails an hour,
and it only delivers to addresses belonging to members of your Supabase team. **Parents won't
receive confirmation or password reset emails until you add your own sender.**

To add one:

1. Choose an email-sending service with a free tier, such as Resend or Brevo.
2. Prove to it that you own a domain to send from, for example `jnssplit.co.uk`. They walk you
   through adding a few DNS records with whoever your domain is registered with. A domain you own
   is what stops these emails landing in spam; a Gmail or Hotmail address isn't suitable as the
   sender.
3. The service gives you SMTP details: host, port, username and password.
4. In Supabase open **Authentication** → **Emails** → **SMTP Settings**, turn on custom SMTP and
   enter those details, plus a sender such as `JNS SPLIT <no-reply@jnssplit.co.uk>`. Save.
5. Optionally raise the email rate limit under **Authentication** → **Rate Limits** to suit a club
   night (for example 30 an hour).

Never put SMTP passwords in the repository or in `.env` for this app; they live only in Supabase.

## Testing before a sender is set up

- **Easiest:** create test accounts by hand under **Authentication** → **Users** → **Add user** →
  **Create new user**, with **Auto Confirm User** ticked, then sign in at `/login`.
- Your own Supabase account email does receive the built-in emails, so you can try the real
  `/signup` flow once with that address.
- In a **development project only**, you can turn **Confirm email** off: `/signup` then signs
  people straight in. Never do this in a project with real families, because anyone could then
  create an account for someone else's email and accept their invitation.

## Check it works

1. Open `/signup` in a private window, enter a test email and a password of at least 12
   characters, twice.
2. The page says a link is on its way. It says the same thing whether or not the address already
   has an account, so it can't be used to find out who is registered.
3. Open the email link, then press **Confirm and sign in**. You land in the app, and any
   invitation for that address is waiting.
4. "Send the link again" asks for a fresh email if the first one didn't arrive.
