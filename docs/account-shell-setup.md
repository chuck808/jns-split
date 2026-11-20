# App shell and password recovery — pilot setup

This change moves the simulator from `/` to `/bench`. `/` is now the public home page. Existing club URLs and registration data remain unchanged. No SQL migration is required.

## Install

Apply the app-shell patch after the club-registration patch, run `npm ci`, then `npm run dev`. Save any local diagnostic edits first; a conflicting login-page edit may require resolving the patch instead of overwriting your work.

New pages: Home, About, Help, Contact, Account, Forgotten password, Recovery confirmation and Reset password. The theme selector supports Light, Dark and System and remembers the choice in this browser for a year. This is not yet an account-synchronised preference. Themes also apply to the club register and bench simulator.

The Contact page deliberately has no submission form or invented email address. Invite management, profile/email editing, notification preferences, guardian links, unit synchronisation, approved legal notices and site administration remain later work. No policy/compliance claims are made by this release.

## Configure reset emails in Supabase

1. Open your development Supabase project's Authentication URL configuration. Set **Site URL** to the exact local app address printed by Vite, for example `http://localhost:5173`. For a deployed test installation use its HTTPS URL instead. Do not use a production project to test local recovery.
2. Open Authentication → Email Templates → **Reset password**. Replace its reset link with the following HTML (this is an email template, not SQL):

```html
<h2>Reset your JNS SPLIT password</h2>
<p>If you requested a password reset, use the link below.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
<p>If you did not request this, you can ignore this email.</p>
```

3. Save the template. The default ConfirmationURL/implicit-fragment template is not used by this server-only flow. The Site URL must point to the same running installation you intend to reset through.
4. Check Supabase's email delivery settings. Test delivery may be restricted; use an allowed test recipient or configure your own SMTP provider. Auth rate limits apply. The generic request response is not a claim that an email was delivered.
5. Open `/forgot-password`, enter your test admin's email and request a link. The app does not reveal whether an address has an account.
6. Open the email link. A clean confirmation page appears; click **Continue to reset password**. The server verifies the recovery token and redirects to the new-password form.
7. Enter a matching new password of at least 12 characters, save, sign out and sign in with the new password. Additional Supabase password requirements still apply.

An expired, reused or missing link offers a fresh request. The app does not log tokens or passwords. Request URLs can contain tokens before the redirect: exclude query strings on auth routes from any proxy/hosting analytics you add. Confirmation pages use no-referrer headers and private/no-store caching. A GET email prefetch does not consume the Supabase token; verification requires the explicit form POST.

Signed-in users can also use `/reset-password`; Supabase remains responsible for session/reauthentication policy. Changing a password does not claim to sign out every existing device.

## Local acceptance

- `/` is Home; `/bench` still runs the simulator and test export.
- Login and existing club registration/tag flows still work.
- Select Light, Dark and System and press Apply; verify reloads, navigation and system appearance changes. Check on a phone-width window as well.
- Account page requires login; it shows the signed-in email and has a working logout action.
- Perform the complete email recovery flow above, then test the same link again.
- Test an incorrect/mismatched new password; no password should be echoed into the form.
- Navigate with keyboard, including the Skip to content link and theme controls.
- Contact clearly states that it is not collecting messages.

Automated checks cover recovery guards, non-enumerating request responses, redirect validation, preference validation, existing registry RLS/rollback tests and the simulator. Live email delivery and browser appearance need testing against your project.

Official reference: https://supabase.com/docs/guides/auth/passwords and https://supabase.com/docs/guides/auth/auth-email-templates.
