/**
 * StressAnalysisLayout
 * Shared chrome for every screen in the Stress Analysis flow:
 *   - Page header ("Stress Analysis" title + subtitle)
 *   - 4-step module chips  (Survey / Face Scan / Heart Rate / Reaction)
 *     — one list only. A second, non-navigating "Heart Rate / Reaction /
 *       Results" row used to sit underneath and duplicated it, so it is gone.
 *   - Bottom navigation tab bar
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Radius, Spacing, Typography } from '../theme/typography';
import { BackButton } from './navigation/BackButton';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import {
  AssessmentStepStatus,
  isDayComplete,
  loadAssessmentState,
} from '../screens/assessment/StressAssessmentHubScreen';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ModuleTab = 'survey' | 'faceScan' | 'heartRate' | 'reaction';

interface Props {
  activeModule: ModuleTab;
  children: React.ReactNode;
  /**
   * Extra "done" signal for the Heart Rate chip. The real source of truth is
   * the saved assessment state; this covers screens that render before the
   * navigator has persisted the step.
   */
  heartRateDone?: boolean;
  onBack?: () => void;
  subtitle?: string;
}

// ─── Module step tabs (top row of 4 chips) ────────────────────────────────────
interface ModuleChipProps {
  label: string;
  dotColor: string;
  chipBg?: string;
  active: boolean;
  completed?: boolean;
}
const ModuleChip: React.FC<ModuleChipProps> = ({
  label,
  dotColor,
  chipBg,
  active,
  completed,
}) => (
  <View
    style={[
      chip.base,
      active && { backgroundColor: chipBg ?? Colors.primaryLight },
    ]}>
    {completed ? (
      <Ionicons name="checkmark-circle" size={13} color={dotColor} />
    ) : (
      <View style={[chip.dot, { backgroundColor: dotColor }]} />
    )}
    <Text
      style={[
        chip.label,
        active && { color: dotColor, fontWeight: '600' },
      ]}
      numberOfLines={1}>
      {label}
    </Text>
  </View>
);

// ─── Bottom tab bar ───────────────────────────────────────────────────────────
interface BottomTabProps {
  icon: string;
  label: string;
  active?: boolean;
}
const BottomTab: React.FC<BottomTabProps> = ({ icon, label, active }) => (
  <View style={btab.item}>
    <Text style={[btab.icon, active && btab.iconActive]}>{icon}</Text>
    <Text style={[btab.label, active && btab.labelActive]}>{label}</Text>
  </View>
);

// ─── Main layout ──────────────────────────────────────────────────────────────
export const StressAnalysisLayout: React.FC<Props> = ({
  activeModule,
  children,
  heartRateDone,
  onBack,
  subtitle = 'Complete all steps then view your fused result',
}) => {
  const [stepStatus, setStepStatus] = useState<Record<ModuleTab, AssessmentStepStatus>>({
    survey: 'locked',
    faceScan: 'locked',
    heartRate: 'locked',
    reaction: 'locked',
  });

  useEffect(() => {
    let alive = true;
    loadAssessmentState()
      .then((s) => {
        if (!alive) return;
        const dayDone = isDayComplete(s);
        setStepStatus({
          survey: dayDone ? 'completed' : s.survey,
          faceScan: dayDone ? 'completed' : s.faceScan,
          heartRate: dayDone ? 'completed' : s.heartRate,
          reaction: dayDone ? 'completed' : s.reaction,
        });
      })
      .catch(() => {
        // Assessment state is a nicety — the chrome still renders without it.
      });
    return () => {
      alive = false;
    };
  }, []);

  const isDone = (step: ModuleTab): boolean =>
    stepStatus[step] === 'completed' || (step === 'heartRate' && !!heartRateDone);

  return (
    <SafeAreaView style={layout.safe} edges={['top', 'bottom']}>
      {onBack && <BackButton onPress={onBack} />}
      {/* ── Page header ── */}
      <View style={layout.header}>
        <View style={layout.titlePill}>
          <Text style={layout.title}>Stress Analysis</Text>
        </View>
        <Text style={layout.subtitle}>{subtitle}</Text>
      </View>

      {/* ── Module step tabs — the single step list ── */}
      <View style={layout.moduleTabs}>
        <ModuleChip
          label="Survey"
          dotColor={Colors.tabSurveyDot}
          chipBg="#EEEEFF"
          active={activeModule === 'survey'}
          completed={isDone('survey')}
        />
        <ModuleChip
          label="Face Scan"
          dotColor={Colors.tabFaceDot}
          chipBg={Colors.tabFaceBg}
          active={activeModule === 'faceScan'}
          completed={isDone('faceScan')}
        />
        <ModuleChip
          label="Heart Rate"
          dotColor={Colors.tabHeartDot}
          chipBg={Colors.tabHeartBg}
          active={activeModule === 'heartRate'}
          completed={isDone('heartRate')}
        />
        <ModuleChip
          label="Reaction"
          dotColor={Colors.tabReactionDot}
          active={activeModule === 'reaction'}
          completed={isDone('reaction')}
        />
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={layout.scroll}
        contentContainerStyle={layout.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeLayout = () => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  titlePill: {
    backgroundColor: toneBg('#EAF3FB'),
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: tone('#1A2340'),
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  moduleTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
});

let layout = makeLayout();
registerThemeStyles(() => { layout = makeLayout(); });

const makeChip = () => StyleSheet.create({
  base: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.divider,
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    flexShrink: 1,
  },
});

let chip = makeChip();
registerThemeStyles(() => { chip = makeChip(); });

const makeBtab = () => StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  icon: {
    fontSize: 20,
    color: Colors.tabBarInactive,
  },
  iconActive: {
    color: Colors.tabBarActive,
  },
  label: {
    fontSize: 10,
    color: Colors.tabBarInactive,
  },
  labelActive: {
    color: Colors.tabBarActive,
    fontWeight: '700',
  },
});

let btab = makeBtab();
registerThemeStyles(() => { btab = makeBtab(); });
