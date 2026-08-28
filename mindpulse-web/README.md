# MindPulse Web

The web application contains the Figma-aligned authentication flow, Admin
Dashboard, and Doctor Dashboard.

## Run

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

The starting sequence is `WEB - REGISTER` -> `WEB - LOGIN` -> workspace
selection -> Admin Dashboard or Doctor Dashboard. Forgot Password and Reset
Password are available from the login screen.

## Environment

Copy `.env.example` to `.env.local` and set the Supabase publishable URL/key.
The Daily token is required for real authenticated video calls; `demo-token`
only supports the local UI preview.

## Validate

```powershell
npm test -- --watch=false
npm run build
```
