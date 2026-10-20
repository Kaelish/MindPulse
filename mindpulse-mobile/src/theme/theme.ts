import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from './colors';

export type ThemeMode = 'light' | 'dark';

const THEME_MODE_STORAGE_KEY = 'mindpulse.themeMode';

/** Copy of the light tokens taken before the first swap, used to restore them. */
const LIGHT_PALETTE = { ...Colors };

/**
 * Dark counterparts for the surfaces, text and tag tokens. Anything not listed
 * here (brand gradients, pure whites, accent dots) keeps its light value.
 */
const DARK_OVERRIDES: Partial<typeof Colors> = {
  // Surfaces
  pageBg: '#0E1120',
  surface: '#171A2B',
  healthCardBg: '#171A2B',
  healthCardBorder: '#262B41',
  border: '#262B41',
  divider: '#222739',

  // Brand (lifted so it keeps contrast on dark)
  primary: '#7FB2DE',
  primaryLight: '#1D2637',
  primaryDark: '#A8CBEE',

  // Buttons & CTAs
  btnBlue: '#6E9DF0',
  btnBlueInactive: '#27324E',
  btnOrange: '#E8A279',
  btnPurple: '#A99BFB',
  btnPurpleDark: '#8E7BF0',

  // Tag / badge colors
  tagPurpleBg: '#241F3D',
  tagPurpleText: '#A796FF',
  tagBlueBg: '#152639',
  tagBlueText: '#6FB4F5',
  tagGreenBg: '#122A1E',
  tagGreenText: '#4FD98A',
  tagRedBg: '#33191C',
  tagRedText: '#F98A80',
  tagYellowBg: '#332A16',
  tagYellowText: '#F5BE4F',

  // Dashboard tiles
  dashSurveyBg: '#1D2240',
  dashSurveyIcon: '#8FA0FF',
  dashFaceBg: '#2A2417',
  dashFaceIcon: '#F0CE72',
  dashAnalysisBg: '#122B2E',
  dashAnalysisIcon: '#5CD8C6',
  dashConsultBg: '#2C1A1C',
  dashConsultIcon: '#F09A9A',
  dashStressCheckBg: '#3E63C7',

  // Neutrals
  textPrimary: '#EEF1F8',
  textSecondary: '#9BA6BF',
  textHint: '#69728C',

  // Bottom tab bar
  tabBarBg: '#1B2440',
  tabBarInactive: '#7F93C4',

  // Legacy tokens (result & survey screens)
  ctaRedLight: '#33211C',
  badgeNormalBg: '#14301F',
  badgeNormalText: '#4FD98A',
  badgeElevatedBg: '#332C12',
  badgeElevatedText: '#F5C24F',
  badgeHighBg: '#3A1D1D',
  badgeHighText: '#FF8A80',
  resultCardBg: '#1C2138',
  resultPillBg: '#2A3050',
  redoBg: '#33191C',
  redoText: '#F98A80',
  redoBorder: '#4A2A2A',
  tipBg: '#332B12',
  tipBorder: '#4A3E18',
  tipText: '#F0C86A',
  tipHighlight: '#F5B84F',
  secTabActiveBg: '#241D3D',
  secTabActiveText: '#B9A6FF',
  tabHeartBg: '#33201F',
  tabFaceBg: '#152639',
};

export const DARK_PALETTE = { ...LIGHT_PALETTE, ...DARK_OVERRIDES };

type Rebuild = () => void;

/**
 * Style sheets are built once when their module loads, so every converted
 * screen registers a rebuild here. Switching the mode re-runs the factories
 * against the new palette and the next render picks the fresh values up.
 */
const rebuilders = new Set<Rebuild>();

export const registerThemeStyles = (rebuild: Rebuild): void => {
  rebuilders.add(rebuild);
};

let mode: ThemeMode = 'light';

export const getThemeMode = (): ThemeMode => mode;

const listeners = new Set<(next: ThemeMode) => void>();

export const subscribeThemeMode = (listener: (next: ThemeMode) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const applyMode = (next: ThemeMode): void => {
  mode = next;
  Object.assign(Colors, next === 'dark' ? DARK_PALETTE : LIGHT_PALETTE);
  rebuilders.forEach((rebuild) => rebuild());
};

/** Switches the palette, rebuilds every registered style sheet and notifies listeners. */
export const setThemeMode = (next: ThemeMode): void => {
  if (next === mode) return;
  applyMode(next);
  listeners.forEach((listener) => listener(next));
  AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, next).catch(() => {
    // Best effort: the switch still applies for this session.
  });
};

/** Restores the saved mode at startup. Call before the main screens mount. */
export const loadThemeMode = async (): Promise<ThemeMode> => {
  try {
    const saved = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      if (saved !== mode) {
        applyMode(saved);
        listeners.forEach((listener) => listener(saved));
      }
      return saved;
    }
  } catch {
    // Unreadable storage: keep the default light theme.
  }
  return mode;
};

/** Current mode, kept in sync with `setThemeMode`. */
export const useThemeMode = (): ThemeMode => {
  const [current, setCurrent] = useState<ThemeMode>(mode);
  useEffect(() => subscribeThemeMode(setCurrent), []);
  return current;
};

/* ─────────── Literal colour helpers ───────────
 * Plenty of screens hard-code hex values instead of design tokens. Both
 * helpers are identity in light mode, so nothing about the existing look
 * changes; in dark mode they only nudge colours that would otherwise lose
 * contrast (dark text → lighter, pale surfaces → deeper), keeping the hue.
 */
const hexToRgb = (hex: string): [number, number, number] | null => {
  const value = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(value)) return null;
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

const luminance = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

const toHex = (r: number, g: number, b: number): string =>
  '#' +
  [r, g, b]
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('');

/** Mix a colour toward white (t) or black (t) — t in 0..1. */
const mix = (rgb: [number, number, number], target: number, toward: 'white' | 'black'): string => {
  let [r, g, b] = rgb;
  let t = 0;
  while (t <= 1) {
    const nr = toward === 'white' ? r + (255 - r) * t : r * (1 - t);
    const ng = toward === 'white' ? g + (255 - g) * t : g * (1 - t);
    const nb = toward === 'white' ? b + (255 - b) * t : b * (1 - t);
    const lum = luminance(nr, ng, nb);
    if (toward === 'white' ? lum >= target : lum <= target) return toHex(nr, ng, nb);
    t += 0.04;
  }
  return toHex(r, g, b);
};

/**
 * Text colour: in dark mode lifts anything that would sink into the
 * background up to a readable brightness, preserving its hue.
 */
export const tone = (hex: string): string => {
  if (mode !== 'dark') return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lum = luminance(rgb[0], rgb[1], rgb[2]);
  if (lum >= 160) return hex;
  return mix(rgb, 160, 'white');
};

/**
 * Button surface: in dark mode `Colors.*` button tokens are *lifted* so they
 * keep contrast as borders/text on a dark page — but the white labels sitting
 * on them then wash out. Pull any such lift back down to a depth where white
 * still reads. Identity in light mode and on colours already dark enough.
 */
export const toneBtn = (hex: string): string => {
  if (mode !== 'dark') return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lum = luminance(rgb[0], rgb[1], rgb[2]);
  if (lum <= 150) return hex;
  return mix(rgb, 112, 'black');
};

/**
 * Background / border colour: in dark mode deepens pale surfaces (cards,
 * sheets, chips, dividers) into dark equivalents, leaving brand accents alone.
 */
export const toneBg = (hex: string): string => {
  if (mode !== 'dark') return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lum = luminance(rgb[0], rgb[1], rgb[2]);
  if (lum <= 190) return hex;
  return mix(rgb, 45, 'black');
};
