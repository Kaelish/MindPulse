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

## Video consultations

The in-page video player is an `https://meet.jit.si` iframe, and a browser only
gives an iframe camera and microphone access when the embedding page is also a
secure context. That means the player embeds when the portal is opened from
`https://` or `http://localhost`, and otherwise the call opens in its own tab
instead (the panel says so and shows exactly which flags it saw).

To force a secure context during development:

```powershell
npm run start:https
```

Then open `https://localhost:3000` and accept the self-signed certificate
warning once. Serving the portal from a LAN IP or a plain `http://` host keeps
working — only the in-page embed is affected.

## Environment

Copy `.env.example` to `.env.local` and set the Supabase publishable URL/key.
The Daily token is required for real authenticated video calls; `demo-token`
only supports the local UI preview.

## Validate

```powershell
npm test -- --watch=false
npm run build
```
