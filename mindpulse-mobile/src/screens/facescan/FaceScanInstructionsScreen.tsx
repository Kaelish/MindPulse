/**
 * FaceScanInstructionsScreen
 * Full-screen page with dark-navy camera preview box, "Start Face Scan" button,
 * and a 2-step modal bottom-sheet flow:
 *   Step 1 – Preparation Checklist
 *   Step 2 – Privacy Notice
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../../theme/theme';

interface Props {
  onBack?: () => void;
  onReady: () => void;
  /** Optional: continue the assessment without facial analysis. */
  onSkip?: () => void;
}

/* ─── Preparation Checklist Items (Step 1) ─── */
const CHECKLIST = [
  {
    iconName: 'sunny-outline' as const,
    iconColor: '#F59E0B',
    title: 'Good, even lighting',
    desc: 'Face a light source such as a window or lamp. Avoid strong backlighting or harsh shadows on your face.',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    iconName: 'body-outline' as const,
    iconColor: '#06B6D4',
    title: 'Calm & relaxed environment',
    desc: 'Find a quiet, peaceful spot. Sit comfortably and take 2–3 slow, deep breaths before scanning.',
    bg: '#ECFEFF',
    border: '#A5F3FC',
  },
  {
    iconName: 'camera-outline' as const,
    iconColor: '#3B82F6',
    title: 'Camera at eye level',
    desc: 'Hold or prop your device at eye level so your full face is centred in the frame. Don\'t tilt the phone.',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    iconName: 'happy-outline' as const,
    iconColor: '#10B981',
    title: 'Neutral, relaxed expression',
    desc: 'Relax your jaw and brow. Avoid forced smiling or frowning — let your natural resting expression show.',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  {
    iconName: 'glasses-outline' as const,
    iconColor: '#8B5CF6',
    title: 'Remove accessories if possible',
    desc: 'Glasses, face coverings, or hair over your face may reduce detection accuracy. Remove them if comfortable.',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  {
    iconName: 'eye-off-outline' as const,
    iconColor: '#EF4444',
    title: 'Clear background preferred',
    desc: 'A plain, uncluttered background helps the system focus on your facial features without interference.',
    bg: '#FEF2F2',
    border: '#FCA5A5',
  },
];

/* ─── Privacy Notice Items (Step 2) ─── */
const PRIVACY_ITEMS = [
  {
    iconName: 'lock-closed-outline' as const,
    iconColor: '#10B981',
    title: 'One photo, sent for analysis',
    desc: 'A single photo is captured and sent over the network to the MindPulse server to estimate your expression.',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  {
    iconName: 'eye-off-outline' as const,
    iconColor: '#8B5CF6',
    title: 'Not stored on the server',
    desc: 'The photo is processed for facial landmarks and emotion estimation, then discarded. No camera feed is recorded.',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  {
    iconName: 'shield-outline' as const,
    iconColor: '#F59E0B',
    title: 'Result feeds your score',
    desc: 'The emotion estimate contributes 20% of your final stress score. The photo itself is still never stored.',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
];

/* ─── Camera Preview ─── */
const CameraPreview = () => (
  <View style={styles.cameraPreview}>
    {/* Grid lines */}
    <View style={styles.gridRow}>
      {[0, 1, 2].map(i => (
        <View key={`v${i}`} style={[styles.gridCell]} />
      ))}
    </View>
    {/* Face oval outline */}
    <View style={styles.faceOval} />
    {/* Camera icon */}
    <View style={styles.cameraIconWrap}>
      <Ionicons name="camera-outline" size={28} color={tone('#FFF')} />
    </View>
    <Text style={styles.cameraHint}>Position your face in frame</Text>
  </View>
);

/* ─── Main Screen ─── */
export const FaceScanInstructionsScreen: React.FC<Props> = ({ onBack, onReady, onSkip }) => {
  const [sheetStep, setSheetStep] = useState<0 | 1 | 2>(0); // 0 = hidden, 1 = checklist, 2 = privacy

  const handleStartPress = () => setSheetStep(1);
  const handleNext = () => setSheetStep(2);
  const handleClose = () => setSheetStep(0);
  const handleContinue = () => {
    setSheetStep(0);
    onReady();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top bar */}
        {onBack && (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back to assessment steps">
              <Ionicons name="chevron-back" size={22} color={tone('#6B79F2')} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Face Emotion Analysis</Text>
          <Text style={styles.pageSubtitle}>Camera scan — your photo is analyzed by the MindPulse server</Text>
        </View>

        {/* Camera Preview Box */}
        <CameraPreview />

        {/* Start Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.startBtn} onPress={handleStartPress} activeOpacity={0.88}>
            <Ionicons name="camera-outline" size={22} color={tone('#FFF')} />
            <Text style={styles.startBtnText}>Start Face Scan</Text>
          </TouchableOpacity>

          {onSkip && (
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Skip Facial Analysis</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── Sheet Step 1: Preparation Checklist ── */}
      <Modal visible={sheetStep === 1} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={sheet.overlay}>
          <View style={sheet.container}>
            {/* Handle bar */}
            <View style={sheet.handle} />

            {/* Header */}
            <View style={sheet.header}>
              <View style={sheet.headerLeft}>
                <View style={[sheet.headerIconWrap, { backgroundColor: toneBg('#8353E2') }]}>
                  <Ionicons name="happy" size={20} color={tone('#FFF')} />
                </View>
                <View>
                  <Text style={sheet.headerTitle}>Preparation Checklist</Text>
                  <Text style={sheet.headerStep}>Step 1 of 2 — Before you scan</Text>
                </View>
              </View>

              <View style={sheet.headerRight}>
                {/* Stepper pill */}
                <View style={sheet.stepperPill}>
                  <View style={sheet.stepActivePill} />
                  <View style={sheet.stepDot} />
                </View>

                <Pressable onPress={handleClose} style={sheet.closeBtn}>
                  <Ionicons name="close" size={16} color={tone('#64748B')} />
                </Pressable>
              </View>
            </View>

            {/* Info Banner */}
            <View style={sheet.infoBanner}>
              <View style={sheet.infoYogaBadge}>
                <Text style={{ fontSize: 16 }}>🧘</Text>
              </View>
              <Text style={sheet.infoText}>
                To get the most accurate emotional analysis, please make sure you are in the{' '}
                <Text style={sheet.infoTextBold}>right environment and mental state</Text> before
                starting the scan.
              </Text>
            </View>

            <Text style={sheet.sectionLabel}>PREPARATION GUIDELINES</Text>

            <ScrollView style={sheet.scroll} showsVerticalScrollIndicator={false}>
              {CHECKLIST.map(item => (
                <View
                  key={item.title}
                  style={[sheet.checkCard, { backgroundColor: toneBg(item.bg), borderColor: toneBg(item.border)}]}
                >
                  <View style={sheet.cardIconBox}>
                    <Ionicons name={item.iconName} size={20} color={tone(item.iconColor)} />
                  </View>
                  <View style={sheet.checkCardText}>
                    <Text style={sheet.checkCardTitle}>{item.title}</Text>
                    <Text style={sheet.checkCardDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Actions */}
            <View style={sheet.actions}>
              <TouchableOpacity style={sheet.cancelBtn} onPress={handleClose}>
                <Text style={sheet.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sheet.primaryBtn, { backgroundColor: toneBg('#8353E2') }]} onPress={handleNext}>
                <Text style={sheet.primaryBtnText}>I'm Ready — Next ›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sheet Step 2: Privacy Notice ── */}
      <Modal visible={sheetStep === 2} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={sheet.overlay}>
          <View style={sheet.container}>
            {/* Handle bar */}
            <View style={sheet.handle} />

            {/* Header */}
            <View style={sheet.header}>
              <View style={sheet.headerLeft}>
                <View style={[sheet.headerIconWrap, { backgroundColor: toneBg('#0284C7') }]}>
                  <Ionicons name="shield-checkmark" size={20} color={tone('#FFF')} />
                </View>
                <View>
                  <Text style={sheet.headerTitle}>Privacy Notice</Text>
                  <Text style={sheet.headerStep}>Step 2 of 2 — Your data & privacy</Text>
                </View>
              </View>

              <View style={sheet.headerRight}>
                {/* Stepper pill */}
                <View style={sheet.stepperPill}>
                  <View style={sheet.stepDot} />
                  <View style={sheet.stepActivePill} />
                </View>

                <Pressable onPress={handleClose} style={sheet.closeBtn}>
                  <Ionicons name="close" size={16} color={tone('#64748B')} />
                </Pressable>
              </View>
            </View>

            <ScrollView style={sheet.scroll} showsVerticalScrollIndicator={false}>
              {/* Callout Privacy Banner */}
              <View style={sheet.privacyCallout}>
                <View style={sheet.privacyEyeCircle}>
                  <Ionicons name="eye-off" size={22} color={tone('#FFF')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sheet.privacyCalloutTitle}>No Images or Videos Stored</Text>
                  <Text style={sheet.privacyCalloutText}>
                    We would like to emphasize that{' '}
                    <Text style={{ fontWeight: '800' }}>no raw facial images or video recordings</Text>{' '}
                    will be stored in the system. Only the{' '}
                    <Text style={{ fontWeight: '800' }}>processed results and extracted features</Text>{' '}
                    necessary for stress assessment will be used.
                  </Text>
                </View>
              </View>

              {PRIVACY_ITEMS.map(item => (
                <View
                  key={item.title}
                  style={[sheet.checkCard, { backgroundColor: toneBg(item.bg), borderColor: toneBg(item.border)}]}
                >
                  <View style={sheet.cardIconBox}>
                    <Ionicons name={item.iconName} size={20} color={tone(item.iconColor)} />
                  </View>
                  <View style={sheet.checkCardText}>
                    <Text style={sheet.checkCardTitle}>{item.title}</Text>
                    <Text style={sheet.checkCardDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              <Text style={sheet.consentText}>
                By tapping{' '}
                <Text style={sheet.consentBold}>"I Understand & Continue"</Text>, you consent to the
                facial analysis process as described above.
              </Text>
            </ScrollView>

            {/* Actions */}
            <View style={sheet.actions}>
              <TouchableOpacity style={sheet.cancelBtn} onPress={handleClose}>
                <Text style={sheet.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sheet.primaryBtn, { backgroundColor: toneBg('#00A8E8') }]}
                onPress={handleContinue}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={tone('#FFF')} style={{ marginRight: 6 }} />
                <Text style={sheet.primaryBtnText}>I Understand & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ─── Page Styles ─── */
const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  safeArea: { flex: 1 },

  topBar: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, flexDirection: 'row' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: tone('#6B79F2'), fontSize: 16, fontWeight: '600', marginLeft: 2 },

  pageHeader: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  pageTitle: { color: Colors.textPrimary, ...Typography.h2, textAlign: 'center' },
  pageSubtitle: { color: Colors.textSecondary, ...Typography.body2, textAlign: 'center', marginTop: 4 },

  /* Camera Preview */
  cameraPreview: {
    marginHorizontal: Spacing.lg,
    height: 240,
    backgroundColor: toneBg('#0D1B3E'),
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  gridRow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  faceOval: {
    width: 120,
    height: 150,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    position: 'absolute',
  },
  cameraIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cameraHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },

  /* Footer */
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: toneBtn(Colors.btnPurple),
    ...Platform.select({
      web: { boxShadow: '0px 6px 20px rgba(158,133,249,0.4)' },
      default: { shadowColor: Colors.btnPurple, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
    }),
    elevation: 8,
  },
  startBtnText: { color: Colors.white, ...Typography.button, fontSize: 17 },
  skipBtn: {
    height: 46,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: toneBg('#DDE3EC'),
    backgroundColor: toneBg('#FFFFFF'),
  },
  skipBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });

/* ─── Bottom Sheet Styles ─── */
const makeSheet = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: toneBg(Colors.white),
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: toneBg('#CBD5E1'), borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: tone('#1E293B'), fontSize: 16, fontWeight: '800' },
  headerStep: { color: tone('#64748B'), fontSize: 11, marginTop: 2 },
  
  /* Stepper indicator pill */
  stepperPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: toneBg('#F1F5F9'), borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  stepActivePill: { width: 22, height: 6, borderRadius: 3, backgroundColor: toneBg('#8353E2') },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: toneBg('#CBD5E1') },

  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: toneBg('#F1F5F9'), alignItems: 'center', justifyContent: 'center' },

  /* Info Banner */
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: toneBg('#F3E8FF'),
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: toneBg('#E9D5FF'),
  },
  infoYogaBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: toneBg('#FEF3C7'), alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, color: tone('#5B21B6'), fontSize: 12.5, lineHeight: 18 },
  infoTextBold: { fontWeight: '800' },

  sectionLabel: { color: tone('#94A3B8'), fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 },

  scroll: { maxHeight: 420, marginBottom: 14 },
  checkCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: toneBg('#FFFFFF'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  checkCardText: { flex: 1 },
  checkCardTitle: { color: tone('#1E293B'), fontSize: 13, fontWeight: '800', marginBottom: 3 },
  checkCardDesc: { color: tone('#64748B'), fontSize: 11.5, lineHeight: 17 },

  /* Privacy Notice Callout */
  privacyCallout: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: toneBg('#E0F2FE'),
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: toneBg('#38BDF8'),
    padding: 14,
    marginBottom: 12,
  },
  privacyEyeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: toneBg('#0284C7'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCalloutTitle: { fontSize: 14, fontWeight: '800', color: tone('#0369A1'), marginBottom: 4 },
  privacyCalloutText: { fontSize: 11.5, color: tone('#0284C7'), lineHeight: 17 },

  consentText: { color: tone('#64748B'), fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10, marginBottom: 4, paddingHorizontal: 8 },
  consentBold: { color: tone('#0369A1'), fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  cancelBtn: { height: 48, flex: 1, borderRadius: 12, backgroundColor: toneBg('#F1F5F9'), alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: tone('#64748B'), fontWeight: '700', fontSize: 14 },
  primaryBtn: {
    height: 48,
    flex: 1.8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 4px 14px rgba(131,83,226,0.35)' },
      default: { shadowColor: '#8353E2', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    }),
    elevation: 4,
  },
  primaryBtnText: { color: tone('#FFFFFF'), fontWeight: '800', fontSize: 13.5 },
});

let sheet = makeSheet();
registerThemeStyles(() => { sheet = makeSheet(); });
