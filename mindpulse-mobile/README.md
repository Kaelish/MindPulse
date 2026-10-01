# MindPulse Mobile

MindPulse is a React Native mobile application built with Expo. It provides a multi-modal stress analysis tool, telehealth appointment booking, and patient profile tracking.

## Getting Started

To run the application locally:

1. Install dependencies:
   npm install

2. Start the Expo development server:
   npx expo start

3. Open the app using Expo Go on your physical device, or press 'a' for Android emulator / 'i' for iOS simulator.

## Current Architecture & Workarounds

### 1. Authentication
`AuthScreen.tsx` performs real Supabase authentication: register creates an
account with `supabase.auth.signUp`, sign-in uses `signInWithPassword`, and a
`profiles` row is created server-side by the `on_auth_user_created` trigger
(with a best-effort upsert for accounts created before that trigger existed).
You land on the dashboard only after a session exists.

### 2. Facial Emotion Scan (demo)
The face scan is an explicitly labelled demo: `FaceScanCameraScreen.tsx` opens
no camera and runs no model, shows a fixed sample result, and that result is
never written to `stress_sessions` or counted in the stress score (the score
uses the survey, heart rate and reaction test only). The `@tensorflow/tfjs` and
`@vladmandic/face-api` packages are still installed but no longer imported.

### 3. Transparent Images
Custom flood-fill scripts were used to process assets (like the meditation figure) to ensure transparent backgrounds fit the UI themes correctly.

## Future Implementation Requirements

### Video Calling Integration
Teleconsultations run entirely in-app: `VideoCallScreen.tsx` opens the
deterministic Jitsi room (`mindpulse-appt-<appointment id>` — shared by
`appointments.ts`, `doctorConsultations.ts` and the web doctor portal) in a
full-screen `InAppVideoCall` WebView (`react-native-webview`, included in
Expo Go), so nobody leaves MindPulse for an external browser. Camera/mic
permissions are requested up front on Android; a "open in browser" fallback
lives in the call header. `src/services/video.ts` (Daily.co) is unused
scaffolding — it throws when `EXPO_PUBLIC_DAILY_BASE_URL` /
`EXPO_PUBLIC_DAILY_TOKEN` are missing and nothing imports it. Only revisit
providers (Daily/Zoom) if you need hosted rooms or recordings; Zoom's SDK
also requires a custom development build instead of Expo Go.

### Supabase Backend
The app talks to Supabase directly with the publishable key configured in
`src/supabase/config.ts` (loaded by `src/supabase/client.ts`). Apply
`supabase/migrations/0001_canonical_schema.sql` in the Supabase SQL editor
before querying — it creates the tables and Row Level Security policies the
services expect.
