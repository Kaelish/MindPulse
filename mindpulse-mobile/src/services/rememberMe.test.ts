import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearRememberedLogin,
  isRememberMeEnabled,
  loadRememberedEmail,
  saveRememberedLogin,
} from './rememberMe';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('remembered login', () => {
  it('saves both the opt-in flag and the e-mail', async () => {
    await saveRememberedLogin('student@example.com');

    expect(await isRememberMeEnabled()).toBe(true);
    expect(await loadRememberedEmail()).toBe('student@example.com');
  });

  it('clears the flag and removes the e-mail', async () => {
    await saveRememberedLogin('student@example.com');

    await clearRememberedLogin();

    expect(await isRememberMeEnabled()).toBe(false);
    expect(await loadRememberedEmail()).toBeNull();
    expect(await AsyncStorage.getItem('mindpulse.rememberedEmail')).toBeNull();
  });

  it('does not return an e-mail when the opt-in flag is off', async () => {
    await AsyncStorage.setItem('mindpulse.rememberedEmail', 'student@example.com');
    await AsyncStorage.setItem('mindpulse.rememberMe', 'false');

    expect(await loadRememberedEmail()).toBeNull();
  });

  it('falls back safely when storage throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage locked'));

    await expect(isRememberMeEnabled()).resolves.toBe(false);
  });
});
