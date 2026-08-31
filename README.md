# MindPulse

MindPulse contains the web and mobile frontends plus the Django backend.

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
SUPABASE_SERVICE_ROLE_KEY=sb_secret_LCvW79yXx3Y5pAqWXAnWww_i6t58Sn-
```

Important:
- Use the publishable key in browser/mobile code only.
- Use the service role key only in backend/server code.
- Never commit `.env` files or share the secret key publicly.

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
- Android Studio and an Android emulator or device for the bare React Native app
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

The web sequence is `WEB - REGISTER` -> `WEB - LOGIN` -> workspace selection.
From workspace selection, `Admin Dashboard` and `Doctor Dashboard` are
separate role-based destinations.

Build for production:

```powershell
npm run build
```

Run web tests:

```powershell
npm test -- --watch=false
```

## Mobile app

The main mobile app is the bare React Native project in `mindpulse-mobile`.

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

The mobile preview follows the Figma sequence: `SPLASH SCREEN` ->
`HEALTH-SETUP` -> `DASHBOARD`. The doctor web app starts directly on its
dashboard at port 3000.

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

- Real Daily.co credentials are still required for live video calls.
- The Supabase `video_sessions` table and its Row Level Security policies must
	exist before cloud session persistence works.
- The Django API currently uses local SQLite and is a separate backend contract;
	frontend session persistence currently targets Supabase directly.
- Windows mobile development also requires Android Studio, Android SDK
  Platform-Tools, an emulator or connected phone, and JDK 17.
