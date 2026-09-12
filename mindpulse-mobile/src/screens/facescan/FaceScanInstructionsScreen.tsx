/**
 * FaceScanInstructionsScreen
 * Matches the mockup: full-screen cream page with dark-navy camera preview box,
 * "Start Face Scan" button, and a two-step bottom-sheet flow:
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
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';

interface Props {
  onBack?: () => void;
  onReady: () => void;
}

/* ─── Preparation Checklist Items ─── */
const CHECKLIST = [
  {
    icon: '💡',
    title: 'Good, even lighting',
    desc: 'Face a light source such as a window or lamp. Avoid strong backlighting or harsh shadows on your face.',
    bg: '#FEF9E7',
    border: '#F9E4A0',
  },
  {
    icon: '🧘',
    title: 'Calm & relaxed environment',
    desc: 'Find a quiet, peaceful spot. Sit comfortably and take 2–3 slow, deep breaths before scanning.',
    bg: '#EBF5FB',
    border: '#AED6F1',
  },
  {
    icon: '📷',
    title: 'Camera at eye level',
    desc: 'Hold or prop your device at eye level so your full face is centred in the frame. Don\'t tilt the phone.',
    bg: '#F4ECF7',
    border: '#C39BD3',
  },
  {
    icon: '😌',
    title: 'Neutral, relaxed expression',
    desc: 'Relax your jaw and brow. Avoid forced smiling or frowning — let your natural resting expression show.',
    bg: '#EAFAF1',
    border: '#A9DFBF',
  },
  {
    icon: '🕶️',
    title: 'Remove accessories if possible',
    desc: 'Glasses, hats or coverings over your face may reduce detection accuracy. Remove them if comfortable.',
    bg: '#FDEBD0',
    border: '#F0B27A',
  },
  {
    icon: '🖼️',
    title: 'Clear background preferred',
    desc: 'A plain, uncluttered background helps the system focus on your facial features without interference.',
    bg: '#FDEDEC',
    border: '#F1948A',
  },
];

/* ─── Privacy Notice Items ─── */
const PRIVACY_ITEMS = [
  {
    icon: '🚫',
    title: 'No Images or Videos Stored',
    desc: 'We would like to emphasise that no raw facial images or video recordings will be stored in the system. Only the processed results and extracted features necessary for stress assessment will be used.',
    bg: '#EBF5FB',
    border: '#AED6F1',
  },
  {
    icon: '📱',
    title: 'On-device processing only',
    desc: 'All facial feature extraction is processed locally and never transmitted to external servers.',
    bg: '#EAFAF1',
    border: '#A9DFBF',
  },
  {
    icon: '🔒',
    title: 'No biometric data retained',
    desc: 'Your face geometry and landmark data are discarded immediately after emotion classification.',
    bg: '#F4ECF7',
    border: '#C39BD3',
  },
  {
    icon: '📊',
    title: 'Results only, not recordings',
    desc: 'Only your emotion label and confidence score are saved as part of your stress assessment record.',
    bg: '#FEF9E7',
    border: '#F9E4A0',
  },
];

/* ─── Camera Preview Placeholder ─── */
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
      <Text style={styles.cameraIconText}>📷</Text>
    </View>
    <Text style={styles.cameraHint}>Position your face in frame</Text>
  </View>
);

/* ─── Main Screen ─── */
export const FaceScanInstructionsScreen: React.FC<Props> = ({ onBack, onReady }) => {
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
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Face Emotion Analysis</Text>
          <Text style={styles.pageSubtitle}>Real-time face emotion detection</Text>
        </View>

        {/* Camera Preview Box */}
        <CameraPreview />

        {/* Start Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.startBtn} onPress={handleStartPress} activeOpacity={0.88}>
            <Text style={styles.startBtnIcon}>📷</Text>
            <Text style={styles.startBtnText}>Start Face Scan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Tab Bar */}
      <BottomTabBar activeTab="analysis" />

      {/* ── Sheet Step 1: Preparation Checklist ── */}
      <Modal visible={sheetStep === 1} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={sheet.overlay}>
          <View style={sheet.container}>
            {/* Handle bar */}
            <View style={sheet.handle} />

            {/* Header */}
            <View style={sheet.header}>
              <View style={sheet.headerLeft}>
                <View style={sheet.headerIconWrap}>
                  <Text style={sheet.headerIcon}>📋</Text>
                </View>
                <View>
                  <Text style={sheet.headerTitle}>Preparation Checklist</Text>
                  <Text style={sheet.headerStep}>Step 1 of 2 — Before you scan</Text>
                </View>
              </View>
              <Pressable onPress={handleClose} style={sheet.closeBtn}>
                <Text style={sheet.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Step dots */}
            <View style={sheet.dots}>
              <View style={[sheet.dot, sheet.dotActive]} />
              <View style={sheet.dot} />
            </View>

            {/* Info Banner */}
            <View style={sheet.infoBanner}>
              <Text style={sheet.infoText}>
                To get the most accurate emotional analysis, please make sure you are in the{' '}
                <Text style={sheet.infoTextBold}>right environment and mental state</Text> before
                starting the scan.
              </Text>
            </View>

            <Text style={sheet.sectionLabel}>PREPARATION GUIDELINES</Text>

            <ScrollView style={sheet.scroll} showsVerticalScrollIndicator={false}>
              {CHECKLIST.map(item => (
                <View key={item.title} style={[sheet.checkCard, { backgroundColor: item.bg, borderColor: item.border }]}>
                  <Text style={sheet.checkCardIcon}>{item.icon}</Text>
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
              <TouchableOpacity style={sheet.primaryBtn} onPress={handleNext}>
                <Text style={sheet.primaryBtnText}>I'm Ready — Next  ›</Text>
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
                <View style={[sheet.headerIconWrap, { backgroundColor: '#EBF5FB' }]}>
                  <Text style={sheet.headerIcon}>🔒</Text>
                </View>
                <View>
                  <Text style={sheet.headerTitle}>Privacy Notice</Text>
                  <Text style={sheet.headerStep}>Step 2 of 2 — Your data & privacy</Text>
                </View>
              </View>
              <Pressable onPress={handleClose} style={sheet.closeBtn}>
                <Text style={sheet.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Step dots */}
            <View style={sheet.dots}>
              <View style={sheet.dot} />
              <View style={[sheet.dot, sheet.dotActive]} />
            </View>

            <ScrollView style={sheet.scroll} showsVerticalScrollIndicator={false}>
              {PRIVACY_ITEMS.map(item => (
                <View key={item.title} style={[sheet.checkCard, { backgroundColor: item.bg, borderColor: item.border }]}>
                  <Text style={sheet.checkCardIcon}>{item.icon}</Text>
                  <View style={sheet.checkCardText}>
                    <Text style={sheet.checkCardTitle}>{item.title}</Text>
                    <Text style={sheet.checkCardDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              <Text style={sheet.consentText}>
                By tapping{' '}
                <Text style={sheet.consentBold}>"I Understand & Continue"</Text>, you consent to the
                facial analysis policies as described above.
              </Text>
            </ScrollView>

            {/* Actions */}
            <View style={sheet.actions}>
              <TouchableOpacity style={sheet.cancelBtn} onPress={handleClose}>
                <Text style={sheet.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sheet.primaryBtn, { backgroundColor: Colors.btnBlue }]} onPress={handleContinue}>
                <Text style={sheet.primaryBtnText}>✓  I Understand & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ─── Page Styles ─── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  safeArea: { flex: 1 },

  pageHeader: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  pageTitle: { color: Colors.textPrimary, ...Typography.h2, textAlign: 'center' },
  pageSubtitle: { color: Colors.textSecondary, ...Typography.body2, textAlign: 'center', marginTop: 4 },

  /* Camera Preview */
  cameraPreview: {
    marginHorizontal: Spacing.lg,
    height: 240,
    backgroundColor: '#0D1B3E',
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
  cameraIconText: { fontSize: 28 },
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
    backgroundColor: Colors.btnPurple,
    ...Platform.select({
      web: { boxShadow: '0px 6px 20px rgba(158,133,249,0.4)' },
      default: { shadowColor: Colors.btnPurple, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
    }),
    elevation: 8,
  },
  startBtnIcon: { fontSize: 22 },
  startBtnText: { color: Colors.white, ...Typography.button, fontSize: 17 },
});

/* ─── Bottom Sheet Styles ─── */
const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  handle: { width: 40, height: 4, backgroundColor: '#DDE1EA', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0E8FB', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 20 },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  headerStep: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.divider, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },

  dots: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot: { width: 20, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
  dotActive: { backgroundColor: Colors.btnPurple },

  infoBanner: { backgroundColor: '#FEF9E7', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F9E4A0' },
  infoText: { color: '#7D5A00', fontSize: 13, lineHeight: 20 },
  infoTextBold: { fontWeight: '800' },

  sectionLabel: { color: '#A0B0C8', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 },

  scroll: { flex: 1, marginBottom: 16 },
  checkCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  checkCardIcon: { fontSize: 20, marginTop: 2 },
  checkCardText: { flex: 1 },
  checkCardTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  checkCardDesc: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },

  consentText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12, marginBottom: 4, paddingHorizontal: 8 },
  consentBold: { color: Colors.textPrimary, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { height: 52, flex: 0.85, borderRadius: Radius.md, backgroundColor: Colors.divider, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 15 },
  primaryBtn: {
    height: 52,
    flex: 1.5,
    borderRadius: Radius.md,
    backgroundColor: Colors.btnPurpleDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 4px 14px rgba(117,92,214,0.4)' },
      default: { shadowColor: Colors.btnPurpleDark, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    }),
    elevation: 6,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
});
