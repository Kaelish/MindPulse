import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from './translations';
import type { Language, Translations } from './types';

/**
 * App language store — modeled on `src/theme/theme.ts` (module-level
 * singleton + listeners + AsyncStorage persistence + a hook). No context
 * provider is needed: every screen that renders localized copy subscribes
 * through `useTranslation()` and re-renders the moment the language changes.
 *
 * Default is English. The choice is restored on the next launch.
 */

export type { Language, Translations } from './types';

const LANGUAGE_STORAGE_KEY = 'mindpulse.language';

/** Human-readable names for the picker (always shown in their own language). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fil: 'Filipino (Tagalog)',
  ceb: 'Cebuano (Bisaya)',
};

let current: Language = 'en';

export const getLanguage = (): Language => current;

const listeners = new Set<(next: Language) => void>();

export const subscribeLanguage = (listener: (next: Language) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Switches the language and notifies every subscribed screen. */
export const setLanguage = (next: Language): void => {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener(next));
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => {
    // Best effort: the switch still applies for this session.
  });
};

/** Restores the saved language at startup. Call before the main screens mount. */
export const loadLanguage = async (): Promise<Language> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'fil' || saved === 'ceb') {
      if (saved !== current) {
        current = saved;
        listeners.forEach((listener) => listener(saved));
      }
      return saved;
    }
  } catch {
    // Unreadable storage: keep the default English UI.
  }
  return current;
};

/** Current language, kept in sync with `setLanguage`. */
export const useLanguage = (): Language => {
  const [lang, setLang] = useState<Language>(current);
  useEffect(() => subscribeLanguage(setLang), []);
  return lang;
};

/**
 * The hook every localized screen uses: subscribing re-renders the component
 * when the language changes, and `t` always points at the active dictionary.
 */
export const useTranslation = (): { lang: Language; t: Translations } => {
  const lang = useLanguage();
  return { lang, t: TRANSLATIONS[lang] };
};

/** Lookup safe for values coming from storage/data (falls back to English). */
export const translate = (lang: Language): Translations => TRANSLATIONS[lang] ?? TRANSLATIONS.en;
