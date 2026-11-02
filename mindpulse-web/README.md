# MindPulse Web

The web application contains the Figma-aligned authentication flow, Admin
Dashboard, and Doctor Dashboard.

## Run

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

The app opens on the public MindPulse landing page. **Log In** in the landing
navigation opens the web portal login screen. **Register as a doctor** on that
screen opens the professional sign-up form. The destination after sign-in comes
from Supabase: approved doctors get the Doctor Dashboard, administrators get the
Admin Dashboard, and unverified doctors see a pending-approval screen until the
administrator approves them (Manage Users → Doctors). Forgot Password and Reset
Password are available from the login screen.

## Landing page configuration

The hero **Download Now** action is separate from web login and is controlled by
these optional environment values:

| Variable | Purpose |
| --- | --- |
| `REACT_APP_MOBILE_APP_DOWNLOAD_URL` | APK download URL or the mobile app's distribution page. Leave empty (or keep the `[MINDPULSE_MOBILE_APP_DOWNLOAD_URL]` placeholder) to show the disabled button with “Download link coming soon”. |
| `REACT_APP_MOBILE_APP_SCREENSHOT_SRC` | Optional real mobile screenshot, for example `/assets/mindpulse-app.png` served from `mindpulse-web/public`. When empty, the phone mockup renders a built-in preview of the patient app. |

The landing styles live in
`src/views/landing/LandingPage.css`, and the landing components are under
`src/views/landing/`. The brand logo comes from `src/assets/logo.png` through
the shared `BrandLogo` component.

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
