import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabaseConfig } from './config';

const isNative = Platform.OS !== 'web';

/**
 * AsyncStorage only works when its native module is linked. When it is not
 * (package version newer than the one compiled into the Expo Go binary, for
 * example) every auth call rejects and the auto-refresh tick throws
 * `AsyncStorageError: Native module is null`. The first failure switches us to
 * an in-memory store for the rest of the session so auth keeps working instead
 * of spamming errors.
 */
const memory = new Map<string, string>();
let nativeUnavailable = false;

const guardedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!nativeUnavailable) {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        nativeUnavailable = true;
      }
    }
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (!nativeUnavailable) {
      try {
        await AsyncStorage.setItem(key, value);
        return;
      } catch {
        nativeUnavailable = true;
      }
    }
    memory.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (!nativeUnavailable) {
      try {
        await AsyncStorage.removeItem(key);
        return;
      } catch {
        nativeUnavailable = true;
      }
    }
    memory.delete(key);
  },
};

export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.publishableKey,
  {
    auth: {
      // Keep the signed-in session across app restarts. Without a persisted
      // storage the session only lives in memory, so every reload of the app
      // silently signs the user out again.
      storage: isNative ? guardedStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // There is no browser URL to read a magic-link session from on a device.
      detectSessionInUrl: !isNative,
    },
  },
);
