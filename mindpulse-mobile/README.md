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
Currently, the AuthScreen.tsx handles login/registration visually but bypasses actual authentication to speed up UI testing. Clicking "Sign In" will redirect you straight to the Patient Dashboard.

### 2. Facial Emotion Scan (TensorFlow.js)
The app uses @tensorflow/tfjs and @vladmandic/face-api for the camera-based emotion scanning. 
Note: There is a known issue where TF.js throws a "ReferenceError: property platform doesn't exist" in modern Expo Go environments. A patch has been applied in `FaceScanCameraScreen.tsx` that temporarily sets `navigator.product = 'Gecko'` during model initialization to bypass this error without requiring a native build.

### 3. Transparent Images
Custom flood-fill scripts were used to process assets (like the meditation figure) to ensure transparent backgrounds fit the UI themes correctly.

## Future Implementation Requirements

### Video Calling Integration
The TeleHealth video call UI (`VideoCallScreen.tsx`) is currently a mockup. To implement real video calls:
1. You must integrate a Video SDK (e.g., Stream Video or Daily.co).
2. Standard WebRTC requires native code. You will need to transition from the "Expo Go" app to an "Expo Development Build".
3. To do this, run `npx expo prebuild` and then build custom native apps using `npx expo run:android` or `npx expo run:ios`.

### Supabase Backend
Ensure your Supabase URL and Anon Key are correctly configured in `src/supabase/client.ts` before attempting real database queries or actual authentication.
