import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabaseConfig } from './config';

const isNative = Platform.OS !== 'web';

export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.publishableKey,
  {
    auth: {
      // Keep the signed-in session across app restarts. Without a persisted
      // storage the session only lives in memory, so every reload of the app
      // silently signs the user out again.
      storage: isNative ? AsyncStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // There is no browser URL to read a magic-link session from on a device.
      detectSessionInUrl: !isNative,
    },
  },
);
