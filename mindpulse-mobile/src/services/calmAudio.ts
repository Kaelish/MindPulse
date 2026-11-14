/**
 * Track registry for the "Calming music" tool on the assessment result screen.
 *
 * Metro resolves `require()` statically, so a file must exist in
 * `assets/audio/` *before* its entry is added here — see the README in that
 * folder for the add-a-track steps. Deleting a file without removing its entry
 * breaks the bundle.
 *
 * All four tracks are CC0 1.0 Universal (public domain dedication) from
 * OpenGameArt, so no attribution is legally required — the licence fields are
 * kept anyway and surfaced in the player so credits stay honest.
 */
import type { AudioSource } from 'expo-audio';

export interface CalmTrack {
  /** Stable React key + selection id. */
  id: string;
  title: string;
  subtitle: string;
  /** Ionicons name for the list row. */
  icon: string;
  /** Accent colour used by the now-playing card. */
  color: string;
  source: AudioSource;
  /** SPDX-style licence string, shown under the track list. */
  license?: string;
  /** Where it came from, e.g. "OpenGameArt". */
  origin?: string;
  /** Direct link to the original page (kept for your own reference). */
  sourceUrl?: string;
}

const CC0 = 'CC0 1.0 Universal';

export const CALM_TRACKS: CalmTrack[] = [
  {
    id: 'contemplation',
    title: 'Contemplation',
    subtitle: 'Joth',
    icon: 'sparkles-outline',
    color: '#7E57C2',
    source: require('../../assets/audio/Contemplation.mp3'),
    license: CC0,
    origin: 'OpenGameArt',
    sourceUrl: 'https://opengameart.org/content/contemplation-0',
  },
  {
    id: 'calm-ambient-2',
    title: 'Calm Ambient 2 (Synthwave 15k)',
    subtitle: 'The Cynic Project / cynicmusic',
    icon: 'pulse-outline',
    color: '#D81B60',
    source: require('../../assets/audio/002_Synthwave_15k.mp3'),
    license: CC0,
    origin: 'OpenGameArt',
    sourceUrl: 'https://opengameart.org/content/calm-ambient-2-synthwave-15k',
  },
  {
    id: 'mystical-piano',
    title: 'Mystical Piano',
    subtitle: 'Indieteur',
    icon: 'musical-note-outline',
    color: '#5C6BC0',
    source: require('../../assets/audio/Mystical Piano.mp3'),
    license: CC0,
    origin: 'OpenGameArt',
    sourceUrl: 'https://opengameart.org/content/mystical-piano',
  },
  {
    id: 'cave-explorer',
    title: 'Cave Explorer',
    subtitle: 'mutantleg',
    icon: 'water-outline',
    color: '#00897B',
    source: require('../../assets/audio/caveexplorer_hq.mp3'),
    license: CC0,
    origin: 'OpenGameArt',
    sourceUrl: 'https://opengameart.org/content/cave-explorer',
  },
  {
    id: 'bangkok_rain',
    title: 'Raining in Bangkok',
    subtitle: 'kijjaz',
    icon: 'rainy-outline',
    color: '#4FA3D1',
    source: require('../../assets/audio/bangkok_rain.mp3'),
    license: CC0,
    origin: 'Freesound',
    sourceUrl: 'https://freesound.org/people/kijjaz/sounds/856405/',
  },
];
