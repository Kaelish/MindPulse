/**
 * Screen 1 – Heart Rate Measurement Instructions
 * Matches reference design: instruction card with emoji rows, yellow tip box,
 * terracotta "Start 15-Second Timer" button.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { registerThemeStyles } from '../../theme/theme';

interface Props {
  onBack: () => void;
  onReady: () => void;
}

// ─── Single instruction row ────────────────────────────────────────────────────
interface InstructionRowProps {
  emoji: string;
  text: string;
}
const InstructionRow: React.FC<InstructionRowProps> = ({ emoji, text }) => (
  <View style={row.wrapper}>
    <Text style={row.emoji}>{emoji}</Text>
    <Text style={row.text}>{text}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export const HeartRateInstructionsScreen: React.FC<Props> = ({ onBack, onReady }) => {
  return (
    <StressAnalysisLayout activeModule="heartRate" activeSection="heartRate">

      {/* ── Instruction card ── */}
      <View style={screen.card}>
        <Text style={screen.cardTitle}>How to Measure Your Heart Rate</Text>

        <InstructionRow
          emoji="🤞"
          text="Place 2 fingers on your neck (carotid) or wrist (radial) pulse point."
        />
        <InstructionRow
          emoji="⏱"
          text="Press the button below to start a 15-second countdown timer."
        />
        <InstructionRow
          emoji="❤️"
          text="Count every beat you feel during those 15 seconds."
        />
        <InstructionRow
          emoji="📊"
          text="Enter the number of beats — the system will calculate your BPM."
        />
      </View>

      {/* ── Tip box ── */}
      <View style={screen.tipBox}>
        <Text style={screen.tipText}>
          <Text style={screen.tipLabel}>💡 Tip: </Text>
          <Text style={screen.tipHighlight}>
            Find your pulse point first before pressing Start.{' '}
          </Text>
          Sit still and breathe normally.
        </Text>
      </View>

      {/* ── CTA button ── */}
      <TouchableOpacity
        onPress={onReady}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Start 15-Second Timer"
        style={screen.ctaBtn}>
        <Text style={screen.ctaHeart}>♥</Text>
        <Text style={screen.ctaLabel}>Start 15-Second Timer</Text>
      </TouchableOpacity>

    </StressAnalysisLayout>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeScreen = () => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: `${0}px ${2 }px ${6}px rgba(0,0,0,${0.04})` },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2  } }
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  tipBox: {
    backgroundColor: Colors.tipBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.tipBorder,
    padding: Spacing.md,
  },
  tipText: {
    fontSize: 13,
    color: Colors.tipText,
    lineHeight: 20,
  },
  tipLabel: {
    fontWeight: '700',
  },
  tipHighlight: {
    color: Colors.tipHighlight,
    fontWeight: '600',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ctaRed,
    borderRadius: Radius.full,
    paddingVertical: 16,
    gap: 10,
    marginTop: Spacing.sm,
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: `${0}px ${4 }px ${8}px rgba(0,0,0,${0.3})` },
      default: { shadowColor: Colors.ctaRed, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4  } }
    }),
  },
  ctaHeart: {
    fontSize: 18,
    color: Colors.white,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
});

let screen = makeScreen();
registerThemeStyles(() => { screen = makeScreen(); });

const makeRow = () => StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
    width: 30,
    textAlign: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});

let row = makeRow();
registerThemeStyles(() => { row = makeRow(); });
