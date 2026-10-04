# Calming music tracks

Audio played by the **Calming music** card on the assessment result screen.

`calm-drone.wav` is a **generated placeholder** — a 10-second seamless ambient
pad, built by `scratch-audio/make_calm_drone.js`. It exists so the player works
out of the box. Replace it with real tracks whenever you like.

## Adding a track

1. Drop a royalty-free file in here (`.mp3`, `.m4a`, `.wav` all work).
2. Register it in `src/services/calmAudio.ts`:

```ts
{
  id: 'rain',
  title: 'Gentle Rain',
  subtitle: 'Rainfall ambience',
  icon: 'rainy-outline',        // Ionicons name
  color: '#4FA3D1',
  source: require('../../assets/audio/rain.mp3'),
},
```

`require()` is resolved statically by Metro, so **the file has to exist before
you add the entry**. Never delete `calm-drone.wav` without also removing its
entry from `calmAudio.ts` — a dangling `require` breaks the bundle.

## Licensing

Only add tracks you have the rights to distribute (CC0 / public domain /
properly licensed). Keep a note of the source next to the entry in
`calmAudio.ts`.
