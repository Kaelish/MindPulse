import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { registerThemeStyles } from '../../theme/theme';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

const PREPARATION_SECONDS = 5;
const COUNT_SECONDS = 15;

type TimerPhase = 'preparing' | 'counting';

export const HeartRateTimerScreen: React.FC<Props> = ({ onBack, onComplete }) => {
  const [phase, setPhase] = useState<TimerPhase>('preparing');
  const [secondsLeft, setSecondsLeft] = useState(PREPARATION_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => {
      if (secondsLeft > 1) {
        setSecondsLeft(secondsLeft - 1);
        return;
      }
      // Last second of this phase: transition instead of hitting 0.
      if (phase === 'preparing') {
        setPhase('counting');
        setSecondsLeft(COUNT_SECONDS);
      } else {
        setSecondsLeft(0);
        onComplete();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, phase, onComplete]);

  const isPreparing = phase === 'preparing';

  return (
    <StressAnalysisLayout activeModule="heartRate" activeSection="heartRate" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.instruction}>
          {isPreparing ? 'Get ready to count your heartbeats!' : 'Count every heartbeat you feel.'}
        </Text>
        <View style={[styles.timerCircle, isPreparing ? styles.preparingCircle : styles.countingCircle]}>
          <Text style={styles.timerValue}>{secondsLeft}</Text>
          <Text style={styles.timerUnit}>seconds</Text>
        </View>
        <Text style={[styles.phaseLabel, !isPreparing && styles.countingLabel]}>
          {isPreparing ? 'Preparation time' : 'Counting... feel your pulse'}
        </Text>
      </View>
      <View style={[styles.tip, !isPreparing && styles.countingTip]}>
        <Text style={styles.tipText}>
          {isPreparing ? 'Place two fingers on your pulse point and sit still.' : 'Keep counting. The timer will move to BPM entry when it reaches zero.'}
        </Text>
      </View>
    </StressAnalysisLayout>
  );
};

const makeStyles = () => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  instruction: {
    ...Typography.body1,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  timerCircle: {
    alignItems: 'center',
    borderRadius: 80,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  preparingCircle: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  countingCircle: {
    backgroundColor: Colors.ctaRed,
  },
  timerValue: {
    color: Colors.white,
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 64,
  },
  timerUnit: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  phaseLabel: {
    ...Typography.button,
    color: Colors.primary,
    textAlign: 'center',
  },
  countingLabel: {
    color: Colors.ctaRed,
  },
  tip: {
    backgroundColor: Colors.tipBg,
    borderColor: Colors.tipBorder,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  countingTip: {
    backgroundColor: Colors.ctaRedLight,
    borderColor: Colors.ctaRedLight,
  },
  tipText: {
    ...Typography.body2,
    color: Colors.tipText,
    textAlign: 'center',
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
