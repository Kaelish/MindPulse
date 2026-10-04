/**
 * Track registry for the "Calming music" tool on the assessment result screen.
 *
 * Metro resolves `require()` statically, so a file must exist in
 * `assets/audio/` *before* its entry is added here — see the README in that
 * folder for the add-a-track steps.
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
}

export const CALM_TRACKS: CalmTrack[] = [
  {
    id: 'ambient-calm',
    title: 'Ambient Calm',
    subtitle: 'Soft looping pad · built in',
    icon: 'musical-notes-outline',
    color: '#6B79F2',
    source: require('../../assets/audio/calm-drone.wav'),
  },
  // Add royalty-free tracks below — instructions in assets/audio/README.md.
];
