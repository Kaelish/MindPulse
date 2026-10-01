import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NotificationPrefs,
  loadNotificationPrefs,
  saveNotificationPrefs,
} from '../../services/notificationPrefs';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface DoctorNotificationsSettingsProps {
  visible: boolean;
  onClose: () => void;
}

type ToggleKey = 'appointmentReminders' | 'consultationUpdates' | 'analysisResults' | 'systemAnnouncements';

interface ToggleSection {
  label: string;
  rows: { key: ToggleKey; title: string; sub: string }[];
}

/**
 * Doctor notification settings. Every switch here really gates the feed: the
 * preferences are stored on the device and applied by `services/notifications`
 * when the bell list and unread badge are built, so turning a category off
 * hides those rows everywhere it is rendered.
 */
const SECTIONS: ToggleSection[] = [
  {
    label: 'APPOINTMENTS & PAYMENTS',
    rows: [
      {
        key: 'appointmentReminders',
        title: 'Appointment requests & payments',
        sub: 'New booking requests, reschedules and payment confirmations',
      },
    ],
  },
  {
    label: 'MESSAGES',
    rows: [
      {
        key: 'consultationUpdates',
        title: 'Messages from students',
        sub: 'New chat messages and consultation updates',
      },
    ],
  },
  {
    label: 'ASSESSMENT ALERTS',
    rows: [
      {
        key: 'analysisResults',
        title: 'Assessment & stress alerts',
        sub: 'High-risk scores and assessment results worth reviewing',
      },
    ],
  },
  {
    label: 'GENERAL',
    rows: [
      {
        key: 'systemAnnouncements',
        title: 'System announcements',
        sub: 'MindPulse service notices and feature updates',
      },
    ],
  },
];

export const DoctorNotificationsSettings: React.FC<DoctorNotificationsSettingsProps> = ({ visible, onClose }) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Reload saved preferences each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    loadNotificationPrefs()
      .then((saved) => setPrefs(saved))
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const handleToggle = (key: ToggleKey, value: boolean, label: string) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void saveNotificationPrefs(next);
    setToastMsg(`${label} ${value ? 'enabled' : 'disabled'}.`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="notifications-outline" size={20} color={tone('#5B6EF5')} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Notification settings</Text>
                <Text style={styles.headerSub}>Choose what appears in your bell</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close notification settings">
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {toastMsg && (
            <View style={styles.toast} role="status">
              <Ionicons name="information-circle" size={18} color={tone('#5B6EF5')} />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {SECTIONS.map((section) => (
              <View key={section.label}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.card}>
                  {section.rows.map((row) => (
                    <View key={row.key} style={styles.toggleRow}>
                      <View style={styles.toggleInfo}>
                        <Text style={styles.toggleTitle}>{row.title}</Text>
                        <Text style={styles.toggleSub}>{row.sub}</Text>
                      </View>
                      <Switch
                        value={prefs[row.key]}
                        onValueChange={(value) => handleToggle(row.key, value, row.title)}
                        trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                        thumbColor="#FFF"
                        accessibilityLabel={row.title}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.noteText}>
                Switched-off categories are hidden from your notifications list and unread badge. Saved on this device.
              </Text>
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.btnBlue,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 12, fontWeight: '700', color: Colors.btnBlue, flex: 1 },

  scroll: { maxHeight: 520 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleInfo: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  toggleSub: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: Colors.pageBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginTop: 14,
  },
  noteText: { flex: 1, fontSize: 11.5, color: Colors.textSecondary, lineHeight: 16 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
