# MindPulse

MindPulse contains the web and mobile frontends plus an optional Django backend.
Supabase is the single source of truth: both apps read and write the same
Postgres database directly, protected by Row Level Security.

## Run backend + mobile with one command (Windows)

The mobile app's face scan calls the Django backend (which runs the emotion
model), so both must be running. Start both at once:

```
start-dev.cmd
```

or, in PowerShell:

```
.\dev.ps1
```

Options: `-Port 8001`, `-NoBackend` (Expo only), `-NoExpo` (backend only),
`-DryRun` (checks only). When the mobile backend URL is missing,
`dev.ps1` writes the current computer LAN address to the ignored
`mindpulse-mobile\.env` so a physical phone can reach Django without a
machine-specific IP being committed to the repository.

### Deploy the Django backend

The repository includes [`render.yaml`](./render.yaml), which prepares the
backend as a Render Web Service using the Linux CPU/headless dependencies,
Gunicorn, migrations, and the `/api/health/` health check. To deploy it:

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint**, select the repository, and apply
   `render.yaml`.
3. Set `SUPABASE_SERVICE_ROLE_KEY` in the Render service environment. Never
   commit this value.
4. After deployment, copy the service's HTTPS URL into the mobile build
   environment as `EXPO_PUBLIC_MINDPULSE_API_URL`.

The free plan may sleep, so the first request can take up to a minute to wake
it. The pixel branch runs in NumPy rather than TensorFlow, which keeps the
service inside the free tier's 512 MB memory limit.

## Shared Supabase connection

This project uses one shared Supabase project for the app and backend connection.

Project URL:
https://whihfwcygbqpjtrpnlck.supabase.co

Project ID:
whihfwcygbqpjtrpnlck

Region:
ap-northeast-2

### Frontend web app
Create a local `.env` file in `mindpulse-web/`:

```env
REACT_APP_SUPABASE_URL=https://whihfwcygbqpjtrpnlck.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_WwxgnGMnrVQ-J2Ud6K-r8g_EJy9OSBP
```

### Mobile app
The mobile app uses the same project in `mindpulse-mobile/src/supabase/config.ts`:

```ts
export const supabaseConfig = {
  url: 'https://whihfwcygbqpjtrpnlck.supabase.co',
  publishableKey: 'sb_publishable_WwxgnGMnrVQ-J2Ud6K-r8g_EJy9OSBP',
};
```

### Backend
Create a local `.env` file in `mindpulse-backend/`:

```env
SUPABASE_URL=https://whihfwcygbqpjtrpnlck.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

Important:
- Use the publishable key in browser/mobile code only.
- Use the service role key only in backend/server code.
- Never commit `.env` files or share the secret key publicly.

## Database schema (apply once per project)

The canonical schema, RLS policies, signup triggers and legacy data mapping live
in a single script:

```
supabase/migrations/0001_canonical_schema.sql
```

Run it in the Supabase dashboard under **SQL Editor → New query → Run** (it is
one transaction, so a failure rolls everything back):

1. Creates the canonical tables: `profiles`, `doctor_profiles`,
   `stress_sessions`, `appointments`, `chat_messages`, `video_sessions`,
   `notifications`, `recommendations`, `migration_report`.
2. Enables RLS with policies for students, doctors and administrators.
3. Maps rows from the older tables (`USER`, `STUDENT_PROFILES`,
   `DOCTOR_PROFILES`, `ASSESSMENT_SESSIONS`, `NOTIFICATIONS`,
   `CONVERSATIONS`/`MESSAGES`) when they exist. Rows that cannot be mapped
   safely are left untouched and listed in `migration_report`.
4. Re-running it is safe (`create table if not exists` + `on conflict do nothing`).

### Roles

`profiles.role` is `student` (default), `doctor` or `admin`. It can only be
changed by an administrator — from the web Admin Dashboard (Manage Users) —
except for the very first administrator, which you create once with SQL in the
Supabase dashboard (**SQL Editor → New query**):

```sql
update public.profiles set role = 'admin' where email = 'you@school.edu';
```

Exactly one administrator account is allowed: the database rejects promoting
anyone else to `admin` and rejects demoting the administrator.

### Live login sessions and sign-in verification

Two later migrations add the server-side pieces for the Security tab shared by
the admin and doctor web portals:

- `supabase/migrations/0026_active_login_sessions.sql` — creates
  `revoke_profile_auth_session`, which lets the `profile-session-control` edge
  function delete a device's refresh token, and installs the private Realtime
  channel policy.
- `supabase/migrations/0027_verification_codes.sql` — stores hashed email /
  SMS / WhatsApp verification codes. Only the service role can read the table.
- `supabase/migrations/0029_reset_own_mfa_factors.sql` — creates
  `reset_own_mfa_factors()`, which lets a signed-in user delete their own MFA
  factors at `aal1` so a lost authenticator can be replaced.

Apply them in the Supabase SQL Editor, including
`supabase/migrations/0029_reset_own_mfa_factors.sql`. Then deploy the functions:

```powershell
supabase functions deploy profile-session-control
supabase functions deploy verification-code
```

Replacing a lost authenticator needs **either** migration `0029` **or** the
`mfa-reset` function:

- `0029_reset_own_mfa_factors.sql` creates `reset_own_mfa_factors()`. The web
  client calls it through `supabase.rpc(...)`; it deletes only the caller's own
  factors and keeps the session alive, so **Show QR Code** can display the new
  code immediately. This is the recommended path because it needs no function
  deployment.
- Alternatively deploy `supabase/functions/mfa-reset` and the client falls back
  to it when the SQL function is absent.

Both exist because Supabase answers `AAL2 required to enroll a new factor` when
a verified factor already exists and the session is only `aal1`, and it also
refuses to unenroll that factor at `aal1`. If neither is installed, delete the
old factor manually in **Supabase → Authentication → Users → (user) → Factors**
and press **Show QR Code** again.

Active Login Sessions works without the functions: every signed-in web tab
joins a Realtime presence channel, so devices appear live and a per-device
logout sends an immediate sign-out broadcast. The functions add refresh-token
revocation and email/SMS/WhatsApp delivery.

Verification methods in Profile → Security:

| Method | How it is delivered | What must be configured |
| --- | --- | --- |
| Authenticator app (QR) | Supabase TOTP MFA | Nothing beyond Supabase Auth |
| SMS | `verification-code` edge function + Twilio SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_SMS_FROM` or `TWILIO_MESSAGING_SERVICE_SID` secrets |
| Email | `verification-code` edge function + Resend | `RESEND_API_KEY`, `VERIFICATION_EMAIL_FROM` secrets |
| WhatsApp | `verification-code` edge function + Twilio WhatsApp | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` secrets |

SMS deliberately does not use Supabase phone MFA: this project has
`external.phone` disabled, so `mfa.enroll({ factorType: 'phone' })` cannot send
anything. The edge function calls Twilio directly, sharing the same
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` as WhatsApp.

`VERIFICATION_SECRET` is optional and adds an extra HMAC pepper to stored code
hashes. If a provider is missing, setup reports that instead of pretending a
code was sent. Once a method is enabled, a new browser session must pass it
before the portal opens; the authenticator app uses Supabase's authenticator
assurance level (`aal2`), and email/SMS/WhatsApp ask once per browser tab.

The same Sign-in Verification panel is available to both administrators and
doctors in **Profile → Security**, with identical behaviour: once a method is
active it is enforced at sign-in. While a method is active the panel shows only
**Turn Off Verification**. Turning it off clears the stored factor (through
`mfa-reset` when Supabase requires `aal2`) and returns to the setup card, where
**Show QR Code** / **Send Code** is available again. Confirming the new six-digit
code re-enables sign-in challenges.

### Doctor personal information

`supabase/migrations/0028_doctor_personal_information.sql` adds the columns
behind the doctor portal's **Profile Setting → Personal Information** card and
the matching registration fields:

- `profiles.middle_name` — full middle name (the portal displays only the
  initial, derived from this value)
- `profiles.home_address`
- `doctor_profiles.title` — honorific (`Dr.`, `Prof.`, …)
- `doctor_profiles.clinic_address`

It also rewrites `handle_new_user()` so registration metadata for
`middle_name`, `home_address`, `title`, `clinic_address`, `birth_date`, `sex`
and `license_no` is copied into `profiles` / `doctor_profiles` at sign-up, and
backfills existing accounts from auth metadata and the legacy
`doctor_profiles.availability_notes` JSON.

The web app still renders correctly before this migration is applied: profile
reads use `select('*')`, missing values fall back to auth metadata and the
legacy JSON, and saves retry with the legacy columns when PostgREST reports a
missing column.

### Doctor registration and approval

The web app's **Register as a doctor** form asks for first name, last name,
middle name (optional), birthdate, title/honorific, gender, work e-mail,
contact number, home address, clinic address, license number, specialization,
short bio and password. It creates a `doctor` account with the professional
details (license number, specialization, contact number, bio) stored in
`doctor_profiles` and the personal details stored in `profiles`. The account starts **unverified**:

1. The doctor confirms their e-mail, then signs in and sees a *pending
   approval* screen — the portal stays locked.
2. The administrator reviews the request under **Manage Users → Doctors** and
   clicks **Approve** (sets `is_verified` and confirms the account) or **Deny**
   (removes the account).
3. Only after approval does the Doctor Dashboard open.

Approval runs through the `approve_doctor` database function, which only the
administrator can call; doctors cannot set their own verification status.
Students register through the mobile app — signup metadata `role` is only ever
honored for `doctor`, never for `admin`.

## Team access

Each teammate needs:
1. Access to the Git repository.
2. Access to the same Supabase project in the Supabase dashboard.
3. A local copy of the environment files above.
4. Dependencies installed for the app they are running.

Do not commit `.env` files. The repository `.gitignore` already ignores these files.

## Prerequisites

- Node.js 22 or newer
- Python 3.11 or newer
- Android Studio and an Android emulator or device for the mobile app
- Xcode and CocoaPods for iOS development (macOS only)

Install each app's dependencies once before running it.

## Environment

Web configuration is loaded from `mindpulse-web/.env.local`. Start from the
template when setting up a new checkout:

```powershell
Set-Location "mindpulse-web"
Copy-Item .env.example .env.local
```

Set the Supabase URL and publishable key in `.env.local`. Set
`REACT_APP_DAILY_TOKEN` to a real Daily.co token before testing real calls;
`demo-token` is only suitable for the local UI preview.

Backend configuration uses `mindpulse-backend/.env`:

```powershell
Set-Location "mindpulse-backend"
Copy-Item .env.example .env
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service
role key in either frontend app.

## Web app

```powershell
Set-Location "mindpulse-web"
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The web app starts on the sign-in screen. After signing in, the destination is
chosen from `profiles.role` (plus doctor approval) in Supabase: approved
doctors open the Doctor Dashboard, administrators open the Admin Dashboard,
unverified doctors see a *pending approval* screen, and student accounts are
told to use the mobile app (there is no manual workspace picker and no role
selector on signup — the register form creates doctor accounts only).

Build for production:

```powershell
npm run build
```

Run web tests:

```powershell
npm test -- --watch=false
```

## Mobile app

The main mobile app is the Expo (React Native) project in `mindpulse-mobile`.

Start Metro:

```powershell
Set-Location "mindpulse-mobile"
npm install
npm start
```

In a second terminal, run the native app:

```powershell
Set-Location "mindpulse-mobile"
npm run android
```

To preview the same mobile source in a browser without Android tooling:

```powershell
Set-Location "mindpulse-mobile"
npm run web
```

Open [http://localhost:8082](http://localhost:8082). This is the mobile app
preview; the doctor web dashboard remains at port 3000.

The mobile app follows `SPLASH` -> `ONBOARDING` -> `REGISTER / LOGIN` ->
`HEALTH-SETUP` -> `DASHBOARD`, all backed by Supabase Auth. The doctor web app
starts at its own login screen at port 3000.

For iOS, use macOS with Xcode and CocoaPods:

```powershell
npm run ios
```

## Backend

```powershell
Set-Location "mindpulse-backend"
python -m venv .venv
\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend is available at `http://127.0.0.1:8000`. The consultation session
API is available at `/api/video-sessions/`.

Run backend checks and tests:

```powershell
python manage.py check
python manage.py test core
```

## Run Everything

Use separate PowerShell terminals:

1. Backend: `python manage.py runserver`
2. Web: `npm start` from `mindpulse-web`
3. Mobile Metro: `npm start` from `mindpulse-mobile`
4. Mobile Android: `npm run android` from a second `mindpulse-mobile` terminal

## Current Limitations

- Real Daily.co credentials are still required for live video calls
	(`REACT_APP_DAILY_BASE_URL` / `REACT_APP_DAILY_TOKEN` for web,
	`EXPO_PUBLIC_DAILY_BASE_URL` / `EXPO_PUBLIC_DAILY_TOKEN` for mobile).
	Without them the call panel reports that video calling is not configured
	instead of faking a session.
- The face scan is an explicitly labelled demo: no camera is opened and no
	model runs, its values are never part of the stress score and are never
	saved to `stress_sessions`.
- The Django API is optional. Neither frontend calls it today — both talk to
	Supabase directly — and it stores its own video-call rows in local SQLite.
- Windows mobile development also requires Android Studio, Android SDK
  Platform-Tools, an emulator or connected phone, and JDK 17.
