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
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Assessment complete</Text>
        <Text style={styles.title}>Final Stress Score</Text>
        <Text style={styles.subtitle}>Your heart rate and reaction time are combined below.</Text>
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
      </View>

      <View style={styles.signalCard}>
        <Text style={styles.cardTitle}>Assessment signals</Text>
        <Signal label="Heart rate" value={`${heartRate} bpm`} detail="40% of final score" color={Colors.tabHeartDot} />
        <Signal label="Reaction time" value={`${reaction.average} ms`} detail="60% of final score" color={Colors.primary} />
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteIcon}>♥</Text>
        <View style={styles.noteCopy}>
          <Text style={styles.noteTitle}>A score is a guide, not a diagnosis</Text>
          <Text style={styles.noteText}>Repeat the assessment when you are rested and discuss persistent concerns with a clinician.</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.doneButton} onPress={onDone} accessibilityRole="button" accessibilityLabel="Finish assessment">
        <Text style={styles.doneText}>Finish Assessment</Text>
      </TouchableOpacity>
    </StressAnalysisLayout>
  );
};

const Signal: React.FC<{ label: string; value: string; detail: string; color: string }> = ({ label, value, detail, color }) => (
  <View style={styles.signalRow}>
    <View style={[styles.signalDot, { backgroundColor: color }]} />
    <View style={styles.signalCopy}><Text style={styles.signalLabel}>{label}</Text><Text style={styles.signalDetail}>{detail}</Text></View>
    <Text style={styles.signalValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: Spacing.xs },
  eyebrow: { ...Typography.label, color: Colors.textSecondary, textTransform: 'uppercase' },
  title: { ...Typography.h1, color: Colors.textPrimary },
  subtitle: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  scoreCard: { backgroundColor: Colors.resultCardBg, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  scoreRing: { width: 168, height: 168, borderRadius: 84, borderWidth: 12, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  score: { fontSize: 58, fontWeight: '800', lineHeight: 62, color: Colors.textPrimary },
  outOf: { ...Typography.caption, color: Colors.textSecondary, marginTop: -2 },
  levelPill: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  levelText: { ...Typography.label },
  message: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', maxWidth: 270 },
  signalCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  cardTitle: { ...Typography.h3, color: Colors.textPrimary },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  signalDot: { width: 10, height: 10, borderRadius: 5 },
  signalCopy: { flex: 1 },
  signalLabel: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '600' },
  signalDetail: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  signalValue: { ...Typography.label, color: Colors.textPrimary },
  noteCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.tipBg, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.tipBorder },
  noteIcon: { fontSize: 20, color: Colors.ctaRed },
  noteCopy: { flex: 1, gap: Spacing.xs },
  noteTitle: { ...Typography.label, color: Colors.tipText },
  noteText: { ...Typography.caption, color: Colors.tipText },
  doneButton: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: 'center', paddingVertical: 16 },
  doneText: { ...Typography.button, color: Colors.white },
});
