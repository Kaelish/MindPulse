# MindPulse

MindPulse contains the web and mobile frontends plus the Django backend.

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

## Mobile app

The current Expo app is in `mindpulse-expo`.

Install dependencies once:

```powershell
Set-Location "mindpulse-expo"
npm ci
```

Start Expo:

```powershell
npm start
```

Then press `w` for web, `a` for an Android emulator, or scan the QR code with Expo Go.

Direct commands:

```powershell
npm run web
npm run android
npm run ios
```

The iOS command requires macOS and Xcode.

## Backend

```powershell
Set-Location "mindpulse-backend"
python manage.py runserver
```
