# Password setup email (Supabase Auth)

Configure in **Supabase Dashboard → Authentication → Email Templates → Reset Password**.

OAuth-only users receive this email when they choose **Set up password** on sign-up.
Supabase uses the recovery flow: cryptographically secure token, single-use, expires per project settings (default ~1 hour).

## Suggested subject

```
Set a password for your CampusBazar account
```

## Suggested body (HTML)

```html
<h2>Add a password to CampusBazar</h2>
<p>Hi,</p>
<p>
  You signed up for CampusBazar with Google. Click the link below to add a password
  so you can sign in with either Google or your email and password.
</p>
<p><a href="{{ .ConfirmationURL }}">Set my password</a></p>
<p>This link expires soon and can only be used once.</p>
<p>If you did not request this, you can ignore this email.</p>
```

## Redirect URL

Add to **Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:5173/reset-password` (local)
- `https://<your-production-domain>/reset-password` (production)

## Token security (handled by Supabase)

- Secure random tokens (not stored in app DB)
- Configurable expiry: **Authentication → Settings → Email → Mailer OTP expiry**
- Invalidated after first successful password update
