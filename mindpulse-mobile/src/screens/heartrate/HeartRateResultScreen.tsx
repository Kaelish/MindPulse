/**
 * Screen 3 – Heart Rate Result
 * Matches reference design:
 *  - Lavender result card: large heart icon, BPM label, rounded status pill
 *  - Summary info card: "beats in 15 seconds → BPM (×4)"
 *  - Two-button row: pink "Redo" + green "Next: Reaction Game"
 *  - Heart Rate tab shows green ✓ badge
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';

export type BPMStatus = 'normal' | 'elevated' | 'high';

interface StatusConfig {
  label: string;
  interpretation: string;
  pillBg: string;
  pillText: string;
}

const getStatus = (bpm: number): BPMStatus => {
  if (bpm <= 80) return 'normal';
  if (bpm <= 95) return 'elevated';
  return 'high';
};

const STATUS_MAP: Record<BPMStatus, StatusConfig> = {
  normal: {
    label: 'Normal',
    interpretation: 'Your heart rate is within the normal resting range.',
    pillBg: Colors.badgeNormalBg,
    pillText: Colors.badgeNormalText,
  },
  elevated: {
    label: 'Slightly Elevated',
    interpretation: 'Your heart rate is mildly above the resting range.',
    pillBg: Colors.badgeElevatedBg,
    pillText: Colors.badgeElevatedText,
  },
  high: {
    label: 'Possible Stress',
    interpretation:
      'Your heart rate suggests elevated stress. Breathe slowly before continuing.',
    pillBg: Colors.badgeHighBg,
    pillText: Colors.badgeHighText,
  },
};

// ─── Animated BPM count-up (subtle, matches the "number just appeared" feel) ──
interface BPMDisplayProps {
  bpm: number;
}
const BPMDisplay: React.FC<BPMDisplayProps> = ({ bpm }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(anim, { toValue: bpm, duration: 800, useNativeDriver: Platform.OS !== 'web' }).start();
    return () => anim.removeListener(id);
  }, [bpm]);

  return <Text style={card.bpmValue}>{shown}</Text>;
};

// ─── Screen ───────────────────────────────────────────────────────────────────
interface Props {
  bpm: number;
  beats: number;          // raw beat count the user entered
  onBack: () => void;
  onRedo: () => void;
  onNext: () => void;
}

export const HeartRateResultScreen: React.FC<Props> = ({
  bpm,
  beats,
  onBack,
  onRedo,
  onNext,
}) => {
  const status = getStatus(bpm);
  const config = STATUS_MAP[status];

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 500,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  return (
    <StressAnalysisLayout
      activeModule="heartRate"
      activeSection="heartRate"
      heartRateDone
      onBack={onBack}>

      {/* ── Result card ── */}
      <Animated.View style={[card.wrapper, { opacity: fadeIn }]}>
        {/* Top row: heart icon  +  BPM label */}
        <View style={card.topRow}>
          <Text style={card.heartIcon}>♥</Text>
          <Text style={card.bpmLabel}>BPM</Text>
        </View>

        {/* Large BPM number */}
        <BPMDisplay bpm={bpm} />

        {/* Status pill */}
        <View style={[card.pill, { backgroundColor: config.pillBg }]}>
          <Text style={[card.pillText, { color: config.pillText }]}>
            {config.label}
          </Text>
        </View>

        {/* Interpretation line */}
        <Text style={card.interpretation}>{config.interpretation}</Text>
      </Animated.View>

      {/* ── Summary info card ── */}
      <View style={summary.card}>
        <Text style={summary.text}>
          Your heart rate input:{' '}
          <Text style={summary.bold}>{beats} beats in 15 seconds</Text>
          {' → '}
          <Text style={summary.bold}>{bpm} BPM (× 4)</Text>
        </Text>
      </View>

      {/* ── Action row: Redo + Next ── */}
      <View style={actions.row}>
        <TouchableOpacity
          onPress={onRedo}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Redo heart rate measurement"
          style={actions.redoBtn}>
          <Text style={actions.redoIcon}>↺</Text>
          <Text style={actions.redoLabel}>Redo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Next: Reaction Game"
          style={actions.nextBtn}>
          <Text style={actions.nextLabel}>Next: Reaction Game</Text>
        </TouchableOpacity>
      </View>

    </StressAnalysisLayout>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.resultCardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 10,
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: `${0}px ${3 }px ${8}px rgba(0,0,0,${0.04})` },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3  } }
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  heartIcon: {
    fontSize: 48,
    color: Colors.resultHeartGrey,
  },
  bpmLabel: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.resultBpmGrey,
    letterSpacing: 2,
  },
  bpmValue: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 72,
  },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: 32,
    paddingVertical: 8,
    marginTop: 4,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  interpretation: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
});

const summary = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: `${0}px ${2 }px ${6}px rgba(0,0,0,${0.04})` },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2  } }
    }),
  },
  text: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});

const actions = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  redoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.redoBg,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.redoBorder,
  },
  redoIcon: {
    fontSize: 16,
    color: Colors.redoText,
    fontWeight: '700',
  },
  redoLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.redoText,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: Colors.nextBg,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: `${0}px ${4 }px ${8}px rgba(0,0,0,${0.3})` },
      default: { shadowColor: Colors.nextBg, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4  } }
    }),
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.nextText,
  },
});
