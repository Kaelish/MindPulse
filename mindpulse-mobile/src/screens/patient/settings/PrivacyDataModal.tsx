import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { supabase } from '../../../supabase/client';
import { fetchDashboardData, StressSessionItem } from '../../../services/dashboard';
import { registerThemeStyles, tone, toneBg } from '../../../theme/theme';

interface PrivacyDataModalProps {
  visible: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
  onAccountDeleted?: () => void;
}

export const PrivacyDataModal: React.FC<PrivacyDataModalProps> = ({
  visible,
  onClose,
  onDataChanged,
  onAccountDeleted,
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDataJson, setExportDataJson] = useState('');
  const [exporting, setExporting] = useState(false);

  // Toast alert
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await fetchDashboardData();
      const exportPayload = {
        exportDate: new Date().toISOString(),
        appName: 'MindPulse AI Companion',
        version: '1.0.0',
        userProfile: {
          name: data.userName,
          email: data.userEmail,
        },
        metrics: data.metrics,
        recentSessions: data.recentSessions,
        dataPolicies: {
          facialImagesStored: false,
          biometricLandmarksRetained: false,
          processingLocation: 'On-device local runtime',
        },
      };

      setExportDataJson(JSON.stringify(exportPayload, null, 2));
      setShowExportModal(true);
    } catch (e: any) {
      Alert.alert('Export Error', 'Could not compile session data for export.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteHistory = () => {
    Alert.alert(
      'Delete Assessment History',
      'Are you sure you want to delete all past stress assessment session records? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete History',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Your session has expired. Please sign in again.');
              const { error } = await supabase
                .from('stress_sessions')
                .delete()
                .eq('user_id', user.id);
              if (error) throw new Error(error.message);
              showToast('Assessment history deleted.');
              onDataChanged?.();
            } catch (e: any) {
              Alert.alert('Delete Failed', e?.message || 'Could not delete your history.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Deleting your MindPulse account will permanently erase your profile, MindPlant progress, and health records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_my_account');
              if (error) throw new Error(error.message);
              // The auth row is gone; clear this device's session as well.
              await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              onAccountDeleted?.();
            } catch (e: any) {
              Alert.alert('Deletion Failed', e?.message || 'Could not delete your account.');
            }
          },
        },
      ]
    );
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
                <Ionicons name="shield-outline" size={20} color={tone('#5B6EF5')} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Privacy & Data</Text>
                <Text style={styles.headerSub}>Data protection, permissions & privacy control</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={tone('#64748B')} />
            </Pressable>
          </View>

          {/* Toast Alert */}
          {toastMsg && (
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color={tone('#27AE60')} />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* ── APP PERMISSIONS ── */}
            <Text style={styles.sectionLabel}>APP PERMISSIONS</Text>
            <View style={styles.card}>
              <View style={styles.permRow}>
                <View style={styles.permIconBox}>
                  <Ionicons name="camera-outline" size={18} color={tone('#5B6EF5')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Camera Access</Text>
                  <Text style={styles.permSub}>Required for real-time facial expression analysis</Text>
                </View>
                <View style={styles.badgeGranted}>
                  <Text style={styles.badgeTextGranted}>Granted (Local)</Text>
                </View>
              </View>

              <View style={styles.permRow}>
                <View style={styles.permIconBox}>
                  <Ionicons name="notifications-outline" size={18} color={tone('#5B6EF5')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Notifications Access</Text>
                  <Text style={styles.permSub}>Required for daily check-in reminders</Text>
                </View>
                <View style={styles.badgeGranted}>
                  <Text style={styles.badgeTextGranted}>Enabled</Text>
                </View>
              </View>
            </View>

            {/* ── FACIAL ANALYSIS SAFEGUARDS (HIGHLIGHTED) ── */}
            <Text style={styles.sectionLabel}>FACIAL ANALYSIS DATA SAFEGUARDS</Text>
            <View style={styles.facialCalloutCard}>
              <View style={styles.facialCalloutHeader}>
                <View style={styles.facialIconCircle}>
                  <Ionicons name="eye-off" size={20} color={tone('#FFF')} />
                </View>
                <Text style={styles.facialCalloutTitle}>Strict Facial Data Guarantee</Text>
              </View>
              <Text style={styles.facialCalloutDesc}>
                MindPulse handles facial analysis data with strict privacy safeguards designed for your mental health:
              </Text>

              <View style={styles.safeguardItem}>
                <Ionicons name="hardware-chip-outline" size={16} color={tone('#0369A1')} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sgTitle}>On-Device Local Processing</Text>
                  <Text style={styles.sgDesc}>Facial expression features are extracted directly on your device CPU/GPU and never uploaded to cloud servers.</Text>
                </View>
              </View>

              <View style={styles.safeguardItem}>
                <Ionicons name="videocam-off-outline" size={16} color={tone('#0369A1')} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sgTitle}>No Video or Photo Storage</Text>
                  <Text style={styles.sgDesc}>No raw camera feeds, photos, or video recordings are saved to device storage or external databases.</Text>
                </View>
              </View>

              <View style={styles.safeguardItem}>
                <Ionicons name="trash-bin-outline" size={16} color={tone('#0369A1')} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sgTitle}>Zero Biometric Retention</Text>
                  <Text style={styles.sgDesc}>Facial landmark mesh coordinates are discarded immediately after emotion classification is completed.</Text>
                </View>
              </View>
            </View>

            {/* ── COLLECTED DATA TYPES ── */}
            <Text style={styles.sectionLabel}>COLLECTED DATA & PURPOSE</Text>
            <View style={styles.card}>
              <View style={styles.dataTypeRow}>
                <Text style={styles.dtTitle}>Personal Credentials</Text>
                <Text style={styles.dtDesc}>Name, email, and year level used strictly for account authentication and personalization.</Text>
              </View>
              <View style={styles.dataTypeRow}>
                <Text style={styles.dtTitle}>Stress Questionnaire Data</Text>
                <Text style={styles.dtDesc}>Psychometric survey responses used to evaluate self-reported stress severity.</Text>
              </View>
              <View style={styles.dataTypeRow}>
                <Text style={styles.dtTitle}>Cognitive & Physiological Data</Text>
                <Text style={styles.dtDesc}>Reaction-time latency (ms) and manual heart rate (bpm) stored as numerical records in session history.</Text>
              </View>
              <View style={styles.dataTypeRow}>
                <Text style={styles.dtTitle}>Stress Session Output</Text>
                <Text style={styles.dtDesc}>Aggregated numerical stress scores (0–100) and timestamps stored securely in Supabase cloud database.</Text>
              </View>
            </View>

            {/* ── DATA MANAGEMENT ACTIONS ── */}
            <Text style={styles.sectionLabel}>YOUR DATA RIGHTS & CONTROLS</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} disabled={exporting}>
                <Ionicons name="download-outline" size={18} color={tone('#5B6EF5')} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionBtnTitle}>Download / Export My Data</Text>
                  <Text style={styles.actionBtnSub}>Generate a JSON backup of all your stress session records</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={tone('#CBD5E1')} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteHistory}>
                <Ionicons name="refresh-outline" size={18} color={tone('#E08A00')} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionBtnTitle, { color: tone('#E08A00') }]}>Delete Assessment History</Text>
                  <Text style={styles.actionBtnSub}>Wipe all past session records while preserving your account</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={tone('#CBD5E1')} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteAccount}>
                <Ionicons name="trash-outline" size={18} color={tone('#E05C5C')} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionBtnTitle, { color: tone('#E05C5C') }]}>Delete Account</Text>
                  <Text style={styles.actionBtnSub}>Permanently delete account, MindPlant, and all associated data</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={tone('#CBD5E1')} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>

      {/* ── JSON EXPORT MODAL SHEET ── */}
      <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheetContainer, { maxHeight: '85%' }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Exported Data Backup (JSON)</Text>
              <Pressable onPress={() => setShowExportModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={tone('#64748B')} />
              </Pressable>
            </View>

            {/* Bounded height: flex:1 collapses to zero in this auto-height
                sheet, which made the exported JSON invisible. */}
            <ScrollView
              style={{
                maxHeight: 380,
                backgroundColor: toneBg('#0F172A'),
                borderRadius: 12,
                marginVertical: 10,
              }}
              contentContainerStyle={{ padding: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, color: tone('#38BDF8') }}>
                {exportDataJson}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: toneBg('#5B6EF5'), marginTop: 8 }]}
              onPress={() => {
                setShowExportModal(false);
                showToast('Data exported successfully!');
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={tone('#FFF')} />
              <Text style={{ color: tone('#FFF'), fontWeight: '800', fontSize: 13 }}>Done / Close Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: toneBg('#FAF8F3'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: { width: 36, height: 4, backgroundColor: toneBg('#CBD5E1'), borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: toneBg('#EEEDFE'), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: toneBg('#E2E8F0'), alignItems: 'center', justifyContent: 'center' },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: toneBg('#D6F5E3'),
    borderColor: toneBg('#27AE60'),
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 12, fontWeight: '700', color: tone('#1E7E43') },

  scroll: { maxHeight: 540 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 10, marginBottom: 8 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },

  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: toneBg('#EEEDFE'), alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  permSub: { fontSize: 11, color: Colors.textSecondary },
  badgeGranted: { backgroundColor: toneBg('#D6F5E3'), borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTextGranted: { fontSize: 10, fontWeight: '700', color: tone('#27AE60') },

  /* Facial Callout */
  facialCalloutCard: {
    backgroundColor: toneBg('#E0F2FE'),
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: toneBg('#38BDF8'),
    padding: 14,
    gap: 10,
  },
  facialCalloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  facialIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: toneBg('#0284C7'), alignItems: 'center', justifyContent: 'center' },
  facialCalloutTitle: { fontSize: 14, fontWeight: '800', color: tone('#0369A1') },
  facialCalloutDesc: { fontSize: 11.5, color: tone('#0284C7'), lineHeight: 17 },

  safeguardItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: toneBg('#F6FBFF'), borderRadius: 10, padding: 10 },
  sgTitle: { fontSize: 12, fontWeight: '800', color: tone('#0369A1') },
  sgDesc: { fontSize: 11, color: tone('#334155'), lineHeight: 16, marginTop: 1 },

  dataTypeRow: { gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dtTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  dtDesc: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  actionBtnTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  actionBtnSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
