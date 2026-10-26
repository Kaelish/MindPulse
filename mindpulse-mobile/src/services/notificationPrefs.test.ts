import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_PREFS_CHANGED_EVENT,
  NOTIFICATION_PREFS_STORAGE_KEY,
  isNotificationEnabled,
  loadNotificationPrefs,
  notificationCategory,
  saveNotificationPrefs,
} from './notificationPrefs';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('notificationCategory', () => {
  it.each([
    [{ type: 'appointment', title: 'Appointment' }, 'appointmentReminders'],
    [{ title: 'Your doctor requested a session' }, 'appointmentReminders'],
    [{ title: 'New clinician message' }, 'consultationUpdates'],
    [{ message: 'A breathing tip for your MindPlant' }, 'wellnessRecommendations'],
    [{ type: 'alert', title: 'High stress score' }, 'analysisResults'],
    [{ title: 'Scheduled maintenance' }, 'systemAnnouncements'],
  ])('maps %o to %s', (row, expected) => {
    expect(notificationCategory(row)).toBe(expected);
  });
});

describe('isNotificationEnabled', () => {
  it('uses the matching toggle', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, consultationUpdates: false };

    expect(isNotificationEnabled({ title: 'New clinician message' }, prefs)).toBe(false);
    expect(isNotificationEnabled({ title: 'Appointment reminder' }, prefs)).toBe(true);
  });

  it('defaults to every category enabled', () => {
    expect(DEFAULT_NOTIFICATION_PREFS).toMatchObject({
      dailyReminders: true,
      analysisResults: true,
      wellnessRecommendations: true,
      appointmentReminders: true,
      consultationUpdates: true,
      systemAnnouncements: true,
      soundEnabled: true,
      vibrationEnabled: true,
    });
  });
});

describe('notification preference persistence', () => {
  it('merges stored values over the defaults', async () => {
    await AsyncStorage.setItem(
      NOTIFICATION_PREFS_STORAGE_KEY,
      JSON.stringify({ analysisResults: false, reminderTime: '9:00 PM' }),
    );

    const prefs = await loadNotificationPrefs();

    expect(prefs.analysisResults).toBe(false);
    expect(prefs.reminderTime).toBe('9:00 PM');
    expect(prefs.dailyReminders).toBe(true);
  });

  it('returns the defaults when stored JSON is unreadable', async () => {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_STORAGE_KEY, '{not-json');

    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('saves and announces the change so open bells refresh immediately', async () => {
    const emit = jest.spyOn(DeviceEventEmitter, 'emit');
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, soundEnabled: false };

    await saveNotificationPrefs(prefs);

    expect(emit).toHaveBeenCalledWith(NOTIFICATION_PREFS_CHANGED_EVENT, prefs);
    expect(await loadNotificationPrefs()).toEqual(prefs);
  });
});
