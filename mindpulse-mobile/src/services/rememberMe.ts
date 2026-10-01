import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_KEY = 'mindpulse.rememberMe';
const EMAIL_KEY = 'mindpulse.rememberedEmail';

/** Called after a successful sign-in when the box was checked. */
export const saveRememberedLogin = async (email: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(REMEMBER_KEY, 'true');
    await AsyncStorage.setItem(EMAIL_KEY, email);
  } catch (e) {
    console.warn('Failed to save remembered login', e);
  }
};

/** Called after a sign-in when the box was unchecked, and after registering. */
export const clearRememberedLogin = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(REMEMBER_KEY, 'false');
    await AsyncStorage.removeItem(EMAIL_KEY);
  } catch (e) {
    console.warn('Failed to clear remembered login', e);
  }
};

/** True when the last sign-in opted into staying signed in. */
export const isRememberMeEnabled = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(REMEMBER_KEY)) === 'true';
  } catch {
    return false;
  }
};

/** Saved e-mail for prefilling the login form, or null when not remembered. */
export const loadRememberedEmail = async (): Promise<string | null> => {
  try {
    const [enabled, email] = await Promise.all([
      AsyncStorage.getItem(REMEMBER_KEY),
      AsyncStorage.getItem(EMAIL_KEY),
    ]);
    return enabled === 'true' && email ? email : null;
  } catch {
    return null;
  }
};
