import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'mindpulse.notificationPrefs';

interface NotificationPrefs {
  dailyReminders: boolean;
  reminderTime: string;
  analysisResults: boolean;
  wellnessRecommendations: boolean;
  appointmentReminders: boolean;
  consultationUpdates: boolean;
  systemAnnouncements: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  dailyReminders: true,
  reminderTime: '8:00 PM',
  analysisResults: true,
  wellnessRecommendations: true,
  appointmentReminders: true,
  consultationUpdates: true,
  systemAnnouncements: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ visible, onClose }) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const {
    dailyReminders, reminderTime, analysisResults, wellnessRecommendations,
    appointmentReminders, consultationUpdates, systemAnnouncements,
    soundEnabled, vibrationEnabled,
  } = prefs;

  // Load saved preferences each time the modal opens
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, [visible]);

  // Toast alert
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const setField = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const handleToggle = (key: keyof NotificationPrefs, val: boolean, label: string) => {
    setField(key, val);
    showToast(`${label} ${val ? 'enabled' : 'disabled'}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="notifications-outline" size={20} color="#5B6EF5" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Notifications</Text>
                <Text style={styles.headerSub}>Preferences are saved on this device</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Toast Alert */}
          {toastMsg && (
            <View style={styles.toast}>
              <Ionicons name="information-circle" size={18} color="#5B6EF5" />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* ── DAILY CHECK-IN REMINDERS ── */}
            <Text style={styles.sectionLabel}>ASSESSMENT REMINDERS</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Daily Stress Assessment</Text>
                  <Text style={styles.toggleSub}>Receive daily notification to check in your stress level</Text>
                </View>
                <Switch
                  value={dailyReminders}
                  onValueChange={v => handleToggle('dailyReminders', v, 'Daily assessment reminder')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>

              {dailyReminders && (
                <View style={styles.scheduleBox}>
                  <Text style={styles.scheduleLabel}>Reminder Schedule Time</Text>
                  <View style={styles.timeChips}>
                    {['7:00 AM', '12:00 PM', '6:00 PM', '8:00 PM', '10:00 PM'].map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.timeChip, reminderTime === t && styles.timeChipActive]}
                        onPress={() => {
                          setField('reminderTime', t);
                          showToast(`Reminder set for ${t}`);
                        }}
                      >
                        <Text style={[styles.timeChipText, reminderTime === t && styles.timeChipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── ACTIVITY & RESULTS ── */}
            <Text style={styles.sectionLabel}>REPORTS & INSIGHTS</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Analysis Results</Text>
                  <Text style={styles.toggleSub}>Notify when new stress assessment summaries are ready</Text>
                </View>
                <Switch
                  value={analysisResults}
                  onValueChange={v => handleToggle('analysisResults', v, 'Analysis results')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Health & Wellness Tips</Text>
                  <Text style={styles.toggleSub}>Receive personalized recommendations and MindPlant growth alerts</Text>
                </View>
                <Switch
                  value={wellnessRecommendations}
                  onValueChange={v => handleToggle('wellnessRecommendations', v, 'Wellness tips')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>
            </View>

            {/* ── CARE & APPOINTMENTS ── */}
            <Text style={styles.sectionLabel}>CARE & APPOINTMENTS</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Teleconsultation Reminders</Text>
                  <Text style={styles.toggleSub}>Remind 15 minutes before scheduled appointments</Text>
                </View>
                <Switch
                  value={appointmentReminders}
                  onValueChange={v => handleToggle('appointmentReminders', v, 'Appointment reminders')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Clinician Messages</Text>
                  <Text style={styles.toggleSub}>Alert when a clinician replies to your consultation message</Text>
                </View>
                <Switch
                  value={consultationUpdates}
                  onValueChange={v => handleToggle('consultationUpdates', v, 'Clinician messages')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>System Announcements</Text>
                  <Text style={styles.toggleSub}>Important updates regarding MindPulse service & features</Text>
                </View>
                <Switch
                  value={systemAnnouncements}
                  onValueChange={v => handleToggle('systemAnnouncements', v, 'System announcements')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>
            </View>

            {/* ── AUDIO & HAPTICS ── */}
            <Text style={styles.sectionLabel}>SOUND & VIBRATION</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Notification Sound</Text>
                  <Text style={styles.toggleSub}>Play gentle tone for reminders</Text>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={v => handleToggle('soundEnabled', v, 'Sound')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Haptic Vibration</Text>
                  <Text style={styles.toggleSub}>Vibrate device on incoming alerts</Text>
                </View>
                <Switch
                  value={vibrationEnabled}
                  onValueChange={v => handleToggle('vibrationEnabled', v, 'Vibration')}
                  trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                  thumbColor="#FFF"
                />
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FAF8F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEEDFE',
    borderColor: '#5B6EF5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 12, fontWeight: '700', color: '#5B6EF5' },

  scroll: { maxHeight: 520 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 10, marginBottom: 8 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleInfo: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  toggleSub: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  scheduleBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  scheduleLabel: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeChip: { backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  timeChipActive: { backgroundColor: '#8353E2', borderColor: '#8353E2' },
  timeChipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  timeChipTextActive: { color: '#FFF', fontWeight: '800' },
});
