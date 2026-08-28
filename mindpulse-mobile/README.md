# MindPulse Mobile

The main MindPulse patient mobile app is a bare React Native application. The
separate `mindpulse-expo` folder is an older prototype and is not required for
this app.

## Requirements

- Node.js 22 or newer
- Java JDK 17 (React Native 0.86 supports JDK 17-20)
- Android Studio with Android SDK, Platform-Tools, Build-Tools, and Emulator
- A running Android emulator or an Android phone with USB debugging enabled

## Install

From the repository root:

```powershell
Set-Location "mindpulse-mobile"
npm install
```

The React Native packages are intentionally aligned to version `0.86.3` so a
fresh install does not hit npm peer-dependency resolution errors.

## Run Android

Start Metro in one terminal:

```powershell
npm start
```

In a second terminal, with an emulator running or a phone connected:

```powershell
npm run android
```

## Run Mobile in a Browser

To preview the actual mobile app source without an emulator or phone:

```powershell
npm run web
```

Open `http://localhost:8082`. This is a browser preview of `mindpulse-mobile`,
not the separate doctor web dashboard in `mindpulse-web`.

The mobile startup sequence is `SPLASH SCREEN` -> `HEALTH-SETUP` -> `DASHBOARD`.
The patient can then open the video consultation from the dashboard.

Check the Android connection with:

```powershell
adb devices
```

The device must appear with the state `device`. If `adb` is not recognized,
install Android Studio Platform-Tools and add the SDK `platform-tools` folder
to your Windows PATH.

## Environment

Mobile Supabase settings are in `src/supabase/config.ts`. Keep publishable
client settings there only; never put a Supabase service-role key in mobile
source code.

The call screen uses `EXPO_PUBLIC_DAILY_BASE_URL` and
`EXPO_PUBLIC_DAILY_TOKEN` when supplied by the build environment. The default
`demo-token` is only a local UI placeholder and cannot authenticate a real call.

## Validate

```powershell
npx tsc --noEmit
npm test -- --runInBand
npx react-native doctor
```

The Metro configuration excludes the optional macOS-only `fsevents` watcher so
the app can start correctly on Windows.
