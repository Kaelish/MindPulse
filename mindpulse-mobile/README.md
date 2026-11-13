# MindPulse Mobile

MindPulse is a React Native mobile application built with Expo. It provides a multi-modal stress analysis tool, telehealth appointment booking, and patient profile tracking.

## Getting Started

To run the application locally:

1. Install dependencies:
   npm install

2. Start the Expo development server:
   npx expo start

3. Open the app using Expo Go on your physical device, or press 'a' for Android emulator / 'i' for iOS simulator.

If iOS remains on the MindPulse splash screen, update Expo Go and restart the
development server with `npx expo start -c`. The app gives its startup storage
and session checks a timeout and falls back to onboarding when they cannot
complete, but an outdated Expo Go binary can still prevent native modules such
as AsyncStorage from working correctly.

### Backend URL

The emotion scan calls the local Django backend, so a physical iPhone cannot
use `localhost`—that means the iPhone itself. Run `.\dev.ps1` from the
repository root; it starts Django on the computer's LAN interface and writes
the current LAN address to this ignored `.env` file automatically. This avoids
committing or hardcoding a machine-specific IP address.

If the computer changes networks, run `.\dev.ps1` again after clearing the old
`EXPO_PUBLIC_MINDPULSE_API_URL` line in `mindpulse-mobile\.env`, or update it
to the new computer LAN address. The iPhone and computer must be on the same
Wi-Fi network, and Windows Firewall must allow the backend port.

### Confirmation e-mail links

Mobile registration sends confirmation links back to the app through the
`mindpulse://auth/callback` deep link. Add this exact URI to Supabase
Dashboard → Authentication → URL Configuration → Redirect URLs:

```
mindpulse://auth/callback
```

After changing the app scheme or confirmation-link handling, restart Expo with
`npx expo start -c`. An installed standalone build must be rebuilt so the
`mindpulse` scheme is registered on the device.

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

### 4. Self-care journal is stored locally, on purpose
The three journal prompts on the assessment result screen — gratitude note
(low), worry journal (moderate), next small step (high) — write to
`AsyncStorage` (`src/services/journal.ts`) and are **never** sent to Supabase.
This is a deliberate data-governance decision, not a missing migration:

- **Free text is the most sensitive and least bounded data in the app.** A
  PSS-10 answer is a structured item from a validated instrument that the
  patient deliberately completed as part of an assessment they chose to run;
  its lifecycle is defined by the instrument. A "worry journal" has no
  boundaries — for a high-stress user it can contain things no clinician ever
  asked to see. Sending it to a shared table would drag in consent scope,
  retention windows and row-level security obligations that structured scores
  do not carry.
- **The app already ships crisis hotlines** (988 / 1553 / 741741) for exactly
  that population. Being conservative where users are most vulnerable is
  design maturity, not laziness.
- **The value is the writing act, not the record.** `stress_sessions` exists
  to be read — by the patient, by the doctor, as a trend over time. A
  gratitude note exists to be written. Different data, different lifecycle.
- **It matches an existing principle in this codebase.** The demo face scan
  result is already "intentionally not persisted" and excluded from scoring
  (§2 above). Data with no consumer should not be retained.

*Accepted tradeoffs, stated openly:* entries do not survive a reinstall or a
device change (there is no sync), and a clinician cannot read them during a
session. Mitigated in-product by a "Stored on this device only" line on every
sheet and a one-tap delete on every entry.

*If this is ever revisited*, it needs a `journal_entries` table with row-level
security scoped to the owning patient, an explicit consent toggle at write
time, and a documented retention window — not a bare insert.

### 5. The no-screen pause timer lets the screen sleep
`PauseTimerModal` powers the "Take a 5-minute no-screen pause" suggestion.
Four deliberate choices worth knowing before changing them:

- **The screen itself goes black.** (Adviser feedback: don't just *say* "put
  your screen down".) The ready card counts 3-2-1, then the sheet turns pure
  black for the remaining minutes with only an ultra-dim countdown in the
  middle — no readable copy while running, and the status bar is hidden too.
  One tap anywhere (or the Android back button) reveals Pause / Resume / End
  early over the black, which re-hides after 4 idle seconds or on a second
  tap; reaching zero brightens back to the ✓ COMPLETE card. This changes only
  rendering: `dark` is true solely in the running phase, so the lead-in, the
  paused state and completion are never black, and the wall-clock maths in
  `pauseTimer.ts` is untouched.
- **No `expo-keep-awake`.** The tip is to *stop looking at the screen*, so
  letting the OS sleep the display is the point, not a defect. Adding a
  keep-awake dependency would work against the feature.
- **Wall-clock timing, not a tick counter.** `GuidedExerciseModal` does
  `elapsedRef.current += TICK_MS`, which is safe because an exercise is a few
  minutes of someone watching the screen. A pause suspends JavaScript
  partway through, so an accumulating counter would freeze at ~3:47 and hang
  forever. The pause stores *when the run started* and derives every reading
  from `Date.now()`, so the first tick after resume computes the true elapsed
  time and finishes correctly. The maths lives in `pauseTimer.ts` and is
  covered by transition tests (including a simulated 10-minute suspension).
- **No sound and no haptics.** Completion is visual, matching
  `GuidedExerciseModal`. A vibration would need `android.permission.VIBRATE`,
  which is not declared in `app.json`, and a chime would need another licensed
  audio asset — neither is worth a failure at the one moment the user is
  waiting on.

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
