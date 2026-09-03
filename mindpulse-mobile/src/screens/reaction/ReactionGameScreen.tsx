import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';

type Phase = 'instructions' | 'waiting' | 'go' | 'results';

export interface ReactionResult {
  average: number;
  fastest: number;
  slowest: number;
  score: number;
}

interface Props {
  onBack: () => void;
  onComplete?: (result: ReactionResult) => void;
}

const rounds = 3;

export const ReactionGameScreen: React.FC<Props> = ({ onBack, onComplete }) => {
  const [phase, setPhase] = useState<Phase>('instructions');
  const [round, setRound] = useState(1);
  const [attempts, setAttempts] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const startRound = () => {
    setPhase('waiting');
    timer.current = setTimeout(() => {
      startedAt.current = performance.now();
      setPhase('go');
    }, 1500 + Math.random() * 1800);
  };

  const handleTap = () => {
    if (phase === 'waiting') {
      setMistakes(value => value + 1);
      return;
    }
    if (phase !== 'go') return;

    const nextAttempts = [...attempts, Math.round(performance.now() - startedAt.current)];
    setAttempts(nextAttempts);
    if (nextAttempts.length === rounds) {
      setPhase('results');
      const average = Math.round(nextAttempts.reduce((sum, value) => sum + value, 0) / rounds);
      const score = Math.max(0, Math.min(100, Math.round(((600 - average) / 400) * 100) - mistakes * 5));
      onComplete?.({
        average,
        fastest: Math.min(...nextAttempts),
        slowest: Math.max(...nextAttempts),
        score,
      });
      return;
    }
    setRound(value => value + 1);
    setPhase('waiting');
    timer.current = setTimeout(() => {
      startedAt.current = performance.now();
      setPhase('go');
    }, 1000 + Math.random() * 1800);
  };

  const reset = () => {
    setAttempts([]);
    setMistakes(0);
    setRound(1);
    setPhase('instructions');
  };

  return (
    <StressAnalysisLayout
      activeModule="reaction"
      activeSection="reaction"
      heartRateDone
      onBack={onBack}
    >
      {phase === 'instructions' && (
        <View style={styles.card}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={styles.title}>Reaction Time Test</Text>
          <Text style={styles.body}>
            Tap the panel as soon as it turns green. Complete three rounds to measure your reaction speed.
          </Text>
          <View style={styles.tip}>
            <Text style={styles.tipText}>Wait for the green signal. Tapping early counts as a mistake.</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={startRound} accessibilityRole="button">
            <Text style={styles.primaryText}>Start Round 1</Text>
          </TouchableOpacity>
        </View>
      )}

      {(phase === 'waiting' || phase === 'go') && (
        <View style={styles.gameArea}>
          <View style={styles.roundRow}>
            <Text style={styles.roundText}>Round {round} of {rounds}</Text>
            <Text style={styles.mistakeText}>{mistakes} mistake{mistakes === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.trigger, phase === 'go' ? styles.triggerGo : styles.triggerWaiting]}
            onPress={handleTap}
            accessibilityRole="button"
            accessibilityLabel={phase === 'go' ? 'Tap now' : 'Wait for green'}
          >
            <Text style={styles.triggerIcon}>{phase === 'go' ? '🟢' : '🟡'}</Text>
            <Text style={styles.triggerTitle}>{phase === 'go' ? 'TAP NOW!' : 'Wait...'}</Text>
            <Text style={styles.triggerSubtitle}>{phase === 'go' ? 'Tap as fast as you can' : 'Do not tap yet'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'results' && (
        <View style={styles.card}>
          <Text style={styles.emoji}>✓</Text>
          <Text style={styles.title}>Reaction Test Complete</Text>
          <Text style={styles.resultValue}>{Math.round(attempts.reduce((sum, value) => sum + value, 0) / attempts.length)}<Text style={styles.resultUnit}> ms</Text></Text>
          <Text style={styles.resultLabel}>Average reaction time</Text>
          <View style={styles.metrics}>
            <Metric label="Fastest" value={`${Math.min(...attempts)} ms`} />
            <Metric label="Slowest" value={`${Math.max(...attempts)} ms`} />
            <Metric label="Mistakes" value={`${mistakes}`} />
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={reset} accessibilityRole="button">
            <Text style={styles.secondaryText}>Retry Test</Text>
          </TouchableOpacity>
        </View>
      )}
    </StressAnalysisLayout>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emoji: { fontSize: 32, textAlign: 'center' },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  body: { ...Typography.body1, color: Colors.textSecondary, lineHeight: 22, textAlign: 'center' },
  tip: { backgroundColor: Colors.tipBg, borderRadius: Radius.md, padding: Spacing.md },
  tipText: { ...Typography.body2, color: Colors.tipText, textAlign: 'center' },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  primaryText: { ...Typography.button, color: Colors.white },
  secondaryButton: { backgroundColor: Colors.redoBg, borderColor: Colors.redoBorder, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700', color: Colors.redoText },
  gameArea: { gap: Spacing.md },
  roundRow: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  roundText: { ...Typography.label, color: Colors.textPrimary },
  mistakeText: { ...Typography.caption, color: Colors.badgeHighText },
  trigger: { height: 240, borderRadius: Radius.xl, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  triggerWaiting: { backgroundColor: Colors.badgeElevatedBg, borderColor: Colors.badgeElevatedText },
  triggerGo: { backgroundColor: Colors.badgeNormalBg, borderColor: Colors.badgeNormalText },
  triggerIcon: { fontSize: 44 },
  triggerTitle: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary },
  triggerSubtitle: { ...Typography.body2, color: Colors.textSecondary },
  resultValue: { fontSize: 64, fontWeight: '800', color: Colors.primary, textAlign: 'center' },
  resultUnit: { fontSize: 20 },
  resultLabel: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: Spacing.sm },
  metric: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  metricValue: { fontWeight: '800', color: Colors.textPrimary },
  metricLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
});
