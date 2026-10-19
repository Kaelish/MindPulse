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
`-DryRun` (checks only). The script prints the correct
`EXPO_PUBLIC_MINDPULSE_API_URL` for emulator / physical phone / web if it is
missing from `mindpulse-mobile\.env`.

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

### Doctor registration and approval

The web app's **Register as a doctor** form creates a `doctor` account with the
professional details (license number, specialization, contact number, bio)
stored in `doctor_profiles`. The account starts **unverified**:

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

The `mindpulse-expo` folder is retained as a separate Expo prototype and is not the main mobile app.

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

The `mindpulse-expo` folder is a separate prototype. It is not required for the
main web, backend, or bare React Native mobile app.

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
