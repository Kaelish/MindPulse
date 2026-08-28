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
python manage.py runserver
```
