import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { ReactionResult } from '../reaction/ReactionGameScreen';

interface Props {
  heartRate: number;
  reaction: ReactionResult;
  onBack: () => void;
  onDone: () => void;
}

const getLevel = (score: number) => {
  if (score >= 70) return { label: 'Low stress', color: Colors.badgeNormalText, bg: Colors.badgeNormalBg, message: 'Your signals suggest a calm and focused state.' };
  if (score >= 40) return { label: 'Moderate stress', color: Colors.badgeElevatedText, bg: Colors.badgeElevatedBg, message: 'Your signals suggest some cognitive or physical load.' };
  return { label: 'High stress', color: Colors.badgeHighText, bg: Colors.badgeHighBg, message: 'Your signals suggest elevated stress. Consider a short recovery break.' };
};

export const FinalStressScoreScreen: React.FC<Props> = ({ heartRate, reaction, onBack, onDone }) => {
  const heartRateScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(heartRate - 70) * 1.5)));
  const score = Math.round(heartRateScore * 0.4 + reaction.score * 0.6);
  const level = getLevel(score);

  return (
    <StressAnalysisLayout
      activeModule="reaction"
      activeSection="results"
      heartRateDone
      onBack={onBack}
      subtitle="Multi-modal stress assessment"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Final Stress Score</Text>
      </View>

      <View style={styles.scoreCard}>
        <View style={styles.scoreRing}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.outOf}>/100</Text>
        </View>
        <View style={[styles.levelPill, { backgroundColor: level.bg }]}>
          <Text style={[styles.levelText, { color: level.color }]}>{level.label}</Text>
        </View>
        <Text style={styles.message}>{level.message}</Text>
        <View style={styles.levelGuide}>
          <Text style={styles.guideLow}>● Low (0-30)</Text>
          <Text style={styles.guideModerate}>● Moderate (31-60)</Text>
          <Text style={styles.guideHigh}>● High (61-100)</Text>
        </View>
      </View>

      <View style={styles.signalCard}>
        <Text style={styles.cardTitle}>Multi-Modal Fusion ({score} / 20 / 20 / 20)</Text>
        <FusionSignal label="Survey (PSS + Physio)" value={50} color={Colors.tabSurveyDot} />
        <FusionSignal label="Facial Emotion" value={80} color={Colors.tabFaceDot} />
        <FusionSignal label="Heart Rate" value={Math.min(100, heartRateScore)} color={Colors.tabHeartDot} />
        <FusionSignal label="Reaction Time" value={Math.max(0, Math.min(100, reaction.score))} color={Colors.ctaRed} />
      </View>

      <View style={[styles.guidanceCard, { backgroundColor: level.bg }]}>
        <Text style={styles.guidanceIcon}>{score >= 70 ? '♧' : '⚠'}</Text>
        <Text style={[styles.guidanceTitle, { color: level.color }]}>{score >= 70 ? 'You seem relaxed today' : 'Your stress indicators are elevated'}</Text>
        <Text style={styles.guidanceText}>{score >= 70 ? 'Maintain healthy routines — good sleep, regular physical activity, and social connection keep stress low.' : 'Try relaxing or practicing breathing techniques. Consider reaching out to a mental health professional if stress persists.'}</Text>
        <Text style={styles.guidanceItem}>✓ Keep up your sleep schedule</Text>
        <Text style={styles.guidanceItem}>✓ Stay hydrated and eat well</Text>
        <Text style={styles.guidanceItem}>✓ Continue positive activities</Text>
      </View>

      <View style={styles.clinicCard}><Text style={styles.clinicTitle}>⌾ Find Nearby Psych Clinics</Text><Text style={styles.clinicSubtitle}>Suggested based on your stress level</Text><Clinic name="MindFresh Psychological Clinic" distance="0.3 km" /><Clinic name="University Wellness Center" distance="0.8 km" /><Clinic name="Mindbridge Psych Clinic" distance="1.2 km" /></View>

      <View style={styles.emergencyCard}><Text style={styles.cardTitle}>Emergency Mental Health Hotlines</Text><Hotline name="National Crisis Hotline" number="988 · 24/7 free and confidential" color="#F0444F" /><Hotline name="In Touch Crisis Line" number="0917-558-4673 · 24/7 support" color="#F59E0B" /><Hotline name="NCMH Crisis Hotline" number="1553 · Free hotline" color="#22A6DF" /><Hotline name="Crisis Text Line" number="Text HOME to 741741" color="#22A6DF" /></View>

      <View style={styles.actionRow}><TouchableOpacity style={styles.saveButton} onPress={onDone} accessibilityRole="button"><Text style={styles.doneText}>Save Result</Text></TouchableOpacity><TouchableOpacity style={styles.helpButton} onPress={onDone} accessibilityRole="button"><Text style={styles.doneText}>Get Help  →</Text></TouchableOpacity></View>
    </StressAnalysisLayout>
  );
};

const FusionSignal: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => <View style={styles.fusionRow}><View style={styles.fusionLabel}><Text style={styles.signalLabel}>{label}</Text><Text style={styles.fusionValue}>{value}</Text></View><View style={styles.fusionTrack}><View style={[styles.fusionFill, { width: `${value}%`, backgroundColor: color }]} /></View></View>;
const Clinic: React.FC<{ name: string; distance: string }> = ({ name, distance }) => <View style={styles.clinicRow}><Text style={styles.clinicPin}>⌾</Text><View style={styles.clinicCopy}><Text style={styles.clinicName}>{name}</Text><Text style={styles.clinicDistance}>{distance} · Mental health support</Text></View><TouchableOpacity style={styles.callButton}><Text style={styles.callText}>Call</Text></TouchableOpacity></View>;
const Hotline: React.FC<{ name: string; number: string; color: string }> = ({ name, number, color }) => <View style={styles.hotlineRow}><View style={[styles.hotlineIcon, { backgroundColor: color }]}><Text style={styles.hotlineIconText}>☎</Text></View><View><Text style={styles.hotlineName}>{name}</Text><Text style={styles.hotlineNumber}>{number}</Text></View></View>;

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: Spacing.xs },
  title: { ...Typography.h1, color: Colors.textPrimary },
  scoreCard: { backgroundColor: Colors.resultCardBg, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  scoreRing: { width: 126, height: 126, borderRadius: 63, borderWidth: 9, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  score: { fontSize: 48, fontWeight: '800', lineHeight: 54, color: Colors.textPrimary },
  outOf: { ...Typography.caption, color: Colors.textSecondary },
  levelPill: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  levelText: { ...Typography.label },
  message: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', maxWidth: 270 },
  levelGuide: { alignSelf: 'stretch', gap: 4 },
  guideLow: { ...Typography.caption, color: Colors.badgeNormalText },
  guideModerate: { ...Typography.caption, color: Colors.badgeElevatedText },
  guideHigh: { ...Typography.caption, color: Colors.badgeHighText },
  signalCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  cardTitle: { ...Typography.h3, color: Colors.textPrimary, fontSize: 15 },
  fusionRow: { gap: 4 },
  fusionLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  signalLabel: { ...Typography.caption, color: Colors.textPrimary },
  fusionValue: { ...Typography.caption, color: Colors.textSecondary },
  fusionTrack: { height: 7, borderRadius: 5, backgroundColor: Colors.divider, overflow: 'hidden' },
  fusionFill: { height: '100%', borderRadius: 5 },
  guidanceCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  guidanceIcon: { fontSize: 22 },
  guidanceTitle: { ...Typography.h3 },
  guidanceText: { ...Typography.body2, color: Colors.textSecondary },
  guidanceItem: { ...Typography.caption, color: Colors.textSecondary },
  clinicCard: { backgroundColor: Colors.badgeHighBg, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  clinicTitle: { ...Typography.h3, color: Colors.badgeHighText, fontSize: 15 },
  clinicSubtitle: { ...Typography.caption, color: Colors.badgeHighText },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm },
  clinicPin: { fontSize: 20, color: Colors.badgeHighText },
  clinicCopy: { flex: 1 },
  clinicName: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  clinicDistance: { ...Typography.caption, color: Colors.textSecondary },
  callButton: { backgroundColor: Colors.badgeHighText, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  callText: { ...Typography.caption, color: Colors.white, fontWeight: '700' },
  emergencyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  hotlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hotlineIcon: { width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  hotlineIconText: { color: Colors.white, fontSize: 12 },
  hotlineName: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  hotlineNumber: { ...Typography.caption, color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  saveButton: { flex: 1, backgroundColor: Colors.badgeNormalText, borderRadius: Radius.lg, alignItems: 'center', paddingVertical: 14 },
  helpButton: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.lg, alignItems: 'center', paddingVertical: 14 },
  doneText: { ...Typography.button, color: Colors.white, fontSize: 13 },
});
