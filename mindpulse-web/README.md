# MindPulse Web

The web application contains the Figma-aligned authentication flow, Admin
Dashboard, and Doctor Dashboard.

## Run

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

The app starts on the login screen; **Register as a doctor** opens the
professional sign-up form. The destination after sign-in comes from Supabase:
approved doctors get the Doctor Dashboard, administrators get the Admin
Dashboard, and unverified doctors see a pending-approval screen until the
administrator approves them (Manage Users → Doctors). Forgot Password and
Reset Password are available from the login screen.

## Environment

Copy `.env.example` to `.env.local` and set the Supabase publishable URL/key.
The Daily token is required for real authenticated video calls; `demo-token`
only supports the local UI preview.

## Validate

```powershell
npm test -- --watch=false
npm run build
```
