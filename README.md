# MindPulse

MindPulse contains the web and mobile frontends plus the Django backend.

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
