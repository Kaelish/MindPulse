# Calming music tracks

Audio played by the **Calming music** card on the assessment result screen.
Every file here must be registered in `src/services/calmAudio.ts` before it can
be played — `require()` is resolved statically by Metro, so **the file has to
exist first**, and **a file must never be deleted while its entry is still in
`calmAudio.ts`** (that breaks the bundle).

## Tracks in use

All four are **CC0 1.0 Universal** (public domain dedication) from OpenGameArt —
no attribution is legally required. The licence is still stored per track in
`calmAudio.ts` and shown in the player.

| File | Title | Artist | Source |
|---|---|---|---|
| `Contemplation.mp3` | Contemplation | Joth | [OpenGameArt](https://opengameart.org/content/contemplation-0) |
| `002_Synthwave_15k.mp3` | Calm Ambient 2 (Synthwave 15k) | The Cynic Project / cynicmusic | [OpenGameArt](https://opengameart.org/content/calm-ambient-2-synthwave-15k) |
| `Mystical Piano.mp3` | Mystical Piano | Indieteur | [OpenGameArt](https://opengameart.org/content/mystical-piano) |
| `caveexplorer_hq.mp3` | Cave Explorer | mutantleg | [OpenGameArt](https://opengameart.org/content/cave-explorer) |

> **Note the filenames.** Two of them (`caveexplorer_hq.mp3`,
> `002_Synthwave_15k.mp3`) do not match the human-readable titles — the
> `require()` paths in `calmAudio.ts` must match the actual files on disk.

## Adding a track

1. Drop a royalty-free file in here (`.mp3`, `.m4a`, `.wav` all work).
2. Register it in `src/services/calmAudio.ts`:

```ts
{
  id: 'rain',
  title: 'Gentle Rain',
  subtitle: 'Artist name',
  icon: 'rainy-outline',        // Ionicons name
  color: '#4FA3D1',
  source: require('../../assets/audio/rain.mp3'),
  license: 'CC0 1.0 Universal',
  origin: 'OpenGameArt',
  sourceUrl: 'https://…',
},
```

## Licensing

Only add tracks you have the rights to distribute (CC0 / public domain /
properly licensed), and record the licence in `calmAudio.ts`.
