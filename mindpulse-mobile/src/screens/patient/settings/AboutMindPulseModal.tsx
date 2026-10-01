import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { registerThemeStyles, tone, toneBg } from '../../../theme/theme';

interface AboutMindPulseModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AboutMindPulseModal: React.FC<AboutMindPulseModalProps> = ({ visible, onClose }) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [problemCategory, setProblemCategory] = useState('Camera / Scan Issue');
  const [problemDesc, setProblemDesc] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Legal modal
  const [legalModalTitle, setLegalModalTitle] = useState<string | null>(null);

  // Toast alert
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSendReport = () => {
    if (!problemDesc.trim()) {
      Alert.alert('Validation Error', 'Please describe the issue before submitting.');
      return;
    }

    setSubmittingReport(true);
    setTimeout(() => {
      setSubmittingReport(false);
      setShowReportModal(false);
      setProblemDesc('');
      showToast('Problem report submitted to KOSE Labs support team.');
    }, 1000);
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
                <Ionicons name="information-circle-outline" size={20} color={tone('#5B6EF5')} />
              </View>
              <View>
                <Text style={styles.headerTitle}>About MindPulse</Text>
                <Text style={styles.headerSub}>Application details, mission & capstone credits</Text>
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
            {/* ── BRAND HERO ── */}
            <View style={styles.heroSection}>
              <View style={styles.logoBadge}>
                <Ionicons name="pulse" size={36} color={tone('#8353E2')} />
              </View>
              <Text style={styles.brandTitle}>MindPulse</Text>
              <Text style={styles.brandTagline}>AI-Based Emotional Stress Detection System Using Facial Analysis</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>Version 1.0.0 (Build 2026.1)</Text>
              </View>
            </View>

            {/* ── MEDICAL & ACADEMIC DISCLAIMER (CRITICAL) ── */}
            <View style={styles.disclaimerCard}>
              <View style={styles.disclaimerHeader}>
                <Ionicons name="warning-outline" size={20} color={tone('#E08A00')} />
                <Text style={styles.disclaimerTitle}>Medical & Research Disclaimer</Text>
              </View>
              <Text style={styles.disclaimerText}>
                MindPulse is an educational and research tool developed for academic capstone demonstration.{'\n\n'}
                It is <Text style={{ fontWeight: '800' }}>not a certified medical device</Text> and is not intended to replace professional medical advice, clinical diagnosis, psychological therapy, or prescriptions. If you are experiencing severe distress or crisis, please contact student counseling services or call 988 immediately.
              </Text>
            </View>

            {/* ── HOW IT WORKS ── */}
            <Text style={styles.sectionLabel}>HOW MINDPULSE WORKS</Text>
            <View style={styles.card}>
              <Text style={styles.cardDesc}>
                MindPulse combines four non-invasive modalities to provide a comprehensive, multi-dimensional stress evaluation for university students:
              </Text>

              <View style={styles.modalityItem}>
                <View style={[styles.modIconBox, { backgroundColor: toneBg('#EEEDFE') }]}>
                  <Ionicons name="happy-outline" size={16} color={tone('#5B6EF5')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modTitle}>1. Facial Expression Analysis</Text>
                  <Text style={styles.modSub}>Analyzes subtle facial muscle micro-expressions locally on-device to classify emotional affect.</Text>
                </View>
              </View>

              <View style={styles.modalityItem}>
                <View style={[styles.modIconBox, { backgroundColor: toneBg('#FFD6D6') }]}>
                  <Ionicons name="heart-outline" size={16} color={tone('#E05C5C')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modTitle}>2. Photoplethysmography (rPPG)</Text>
                  <Text style={styles.modSub}>Estimates heart rate variability and BPM from optical color changes in skin capillaries.</Text>
                </View>
              </View>

              <View style={styles.modalityItem}>
                <View style={[styles.modIconBox, { backgroundColor: toneBg('#E6F7F5') }]}>
                  <Ionicons name="flash-outline" size={16} color={tone('#2C7A7B')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modTitle}>3. Cognitive Reaction-Time Test</Text>
                  <Text style={styles.modSub}>Measures tap latency to evaluate cognitive processing speed under mental fatigue.</Text>
                </View>
              </View>

              <View style={styles.modalityItem}>
                <View style={[styles.modIconBox, { backgroundColor: toneBg('#FFF3CD') }]}>
                  <Ionicons name="document-text-outline" size={16} color={tone('#E08A00')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modTitle}>4. Psychometric Survey</Text>
                  <Text style={styles.modSub}>Validates subjective emotional state using standardized wellness questionnaire scoring.</Text>
                </View>
              </View>
            </View>

            {/* ── KEY FEATURES ── */}
            <Text style={styles.sectionLabel}>KEY FEATURES</Text>
            <View style={styles.card}>
              <View style={styles.featRow}>
                <Ionicons name="leaf-outline" size={16} color={tone('#27AE60')} />
                <Text style={styles.featText}>Interactive MindPlant wellness habit visualizer</Text>
              </View>
              <View style={styles.featRow}>
                <Ionicons name="videocam-outline" size={16} color={tone('#5B6EF5')} />
                <Text style={styles.featText}>Student telehealth consultation booking & video call portal</Text>
              </View>
              <View style={styles.featRow}>
                <Ionicons name="trending-up-outline" size={16} color={tone('#8353E2')} />
                <Text style={styles.featText}>Longitudinal stress score trend charts & historical tracking</Text>
              </View>
            </View>

            {/* ── ACKNOWLEDGMENTS & TEAM ── */}
            <Text style={styles.sectionLabel}>DEVELOPMENT TEAM & CREDITS</Text>
            <View style={styles.card}>
              <View style={styles.teamHeader}>
                <View style={styles.teamIconBox}>
                  <Ionicons name="code-slash-outline" size={18} color={tone('#8353E2')} />
                </View>
                <View>
                  <Text style={styles.teamName}>KOSE Labs</Text>
                  <Text style={styles.teamSub}>4th Year Computer Engineering / Computer Science Capstone Project</Text>
                </View>
              </View>
              <Text style={styles.teamDesc}>
                Built with React Native, Expo, Supabase Auth & Storage, and OpenCV/TensorFlow Light Vision runtime.
              </Text>
            </View>

            {/* ── LEGAL & SUPPORT LINKS ── */}
            <Text style={styles.sectionLabel}>SUPPORT & LEGAL</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.linkRow} onPress={() => setLegalModalTitle('Privacy Policy')}>
                <Ionicons name="document-text-outline" size={16} color={tone('#5B6EF5')} />
                <Text style={styles.linkText}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={16} color={tone('#CBD5E1')} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkRow} onPress={() => setLegalModalTitle('Terms of Use')}>
                <Ionicons name="shield-checkmark-outline" size={16} color={tone('#5B6EF5')} />
                <Text style={styles.linkText}>Terms of Use</Text>
                <Ionicons name="chevron-forward" size={16} color={tone('#CBD5E1')} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkRow} onPress={() => setShowReportModal(true)}>
                <Ionicons name="bug-outline" size={16} color={tone('#E05C5C')} />
                <Text style={[styles.linkText, { color: tone('#E05C5C') }]}>Report a Problem / Send Feedback</Text>
                <Ionicons name="chevron-forward" size={16} color={tone('#CBD5E1')} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>

      {/* ── REPORT PROBLEM MODAL ── */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheetContainer, { maxHeight: '80%' }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Report a Problem</Text>
              <Pressable onPress={() => setShowReportModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={tone('#64748B')} />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1, gap: 12 }}>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {['Camera / Scan Issue', 'Heart Rate Error', 'UI Alignment', 'Other Feedback'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, problemCategory === cat && styles.catChipActive]}
                    onPress={() => setProblemCategory(cat)}
                  >
                    <Text style={[styles.catChipText, problemCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 8 }}>Description</Text>
              <TextInput
                style={styles.textArea}
                value={problemDesc}
                onChangeText={setProblemDesc}
                multiline
                numberOfLines={4}
                placeholder="Describe what went wrong or suggest an improvement..."
                placeholderTextColor={Colors.textHint}
              />

              <TouchableOpacity style={styles.submitReportBtn} onPress={handleSendReport} disabled={submittingReport}>
                <Ionicons name="send-outline" size={16} color={tone('#FFF')} />
                <Text style={{ color: tone('#FFF'), fontWeight: '800', fontSize: 13 }}>Submit Report</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── LEGAL TERMS VIEWER MODAL ── */}
      <Modal visible={!!legalModalTitle} transparent animationType="fade" onRequestClose={() => setLegalModalTitle(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheetContainer, { maxHeight: '80%' }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{legalModalTitle}</Text>
              <Pressable onPress={() => setLegalModalTitle(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={tone('#64748B')} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 12, backgroundColor: Colors.surface, borderRadius: 12 }}>
              <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 18 }}>
                {legalModalTitle === 'Privacy Policy' ? (
                  `MindPulse Privacy Policy (v1.0.0)\n\n1. Information We Collect: We collect name, student email, survey answers, heart rate estimation, and reaction time scores.\n\n2. Facial Analysis Guarantee: All facial feature extraction is performed strictly on-device. No images, videos, or raw biometric landmarks are stored or transmitted.\n\n3. Educational Capstone Purpose: Data collected is used solely to calculate stress scores and render progress visualizations within the application.`
                ) : (
                  `MindPulse Terms of Use (v1.0.0)\n\n1. Acceptable Use: MindPulse is intended for student wellness self-monitoring and research evaluation.\n\n2. Medical Disclaimer: Users acknowledge that MindPulse does not provide clinical diagnosis, emergency crisis care, or medical prescriptions.\n\n3. User Conduct: Accounts must be created using legitimate student information.`
                )}
              </Text>
            </ScrollView>

            <TouchableOpacity style={[styles.submitReportBtn, { marginTop: 12 }]} onPress={() => setLegalModalTitle(null)}>
              <Text style={{ color: tone('#FFF'), fontWeight: '800', fontSize: 13 }}>Close Document</Text>
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

  /* Hero */
  heroSection: { alignItems: 'center', marginVertical: 14, gap: 4 },
  logoBadge: { width: 64, height: 64, borderRadius: 22, backgroundColor: toneBg('#F0E8FB'), alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  brandTitle: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  brandTagline: { fontSize: 11.5, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  versionBadge: { backgroundColor: toneBg('#EEEDFE'), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  versionText: { fontSize: 11, fontWeight: '700', color: tone('#5B6EF5') },

  /* Disclaimer */
  disclaimerCard: { backgroundColor: toneBg('#FFF3CD'), borderRadius: 16, borderWidth: 1, borderColor: toneBg('#FFE8B3'), padding: 14, gap: 8, marginVertical: 6 },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disclaimerTitle: { fontSize: 13, fontWeight: '800', color: tone('#B08B28') },
  disclaimerText: { fontSize: 11, color: tone('#8A6D1B'), lineHeight: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardDesc: { fontSize: 11.5, color: Colors.textSecondary, lineHeight: 17, marginBottom: 4 },

  modalityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modIconBox: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  modSub: { fontSize: 11, color: Colors.textSecondary, lineHeight: 15, marginTop: 1 },

  featRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featText: { fontSize: 12, color: Colors.textPrimary, flex: 1 },

  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: toneBg('#F0E8FB'), alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  teamSub: { fontSize: 11, color: Colors.textSecondary },
  teamDesc: { fontSize: 11, color: Colors.textHint, lineHeight: 16 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  linkText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 },

  catChip: { backgroundColor: Colors.pageBg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  catChipActive: { backgroundColor: toneBg('#5B6EF5'), borderColor: toneBg('#5B6EF5') },
  catChipText: { fontSize: 11, color: Colors.textSecondary },
  catChipTextActive: { color: tone('#FFF'), fontWeight: '700' },

  textArea: { backgroundColor: Colors.pageBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, fontSize: 13, color: Colors.textPrimary, textAlignVertical: 'top', height: 100 },

  submitReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: toneBg('#5B6EF5'), borderRadius: 12, paddingVertical: 12, marginTop: 8 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
