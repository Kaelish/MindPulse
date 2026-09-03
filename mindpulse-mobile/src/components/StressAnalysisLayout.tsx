/**
 * StressAnalysisLayout
 * Shared chrome for every screen in the Stress Analysis flow:
 *   - Page header ("Stress Analysis" title + subtitle)
 *   - 4-step module tab chips  (Survey / Face Scan / Heart Rate / Reaction)
 *   - Secondary section tabs   (Heart Rate / Reaction / Results)
 *   - Bottom navigation tab bar
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Radius, Spacing, Typography } from '../theme/typography';
import { BackButton } from './navigation/BackButton';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ModuleTab = 'survey' | 'faceScan' | 'heartRate' | 'reaction';
export type SectionTab = 'heartRate' | 'reaction' | 'results';

interface Props {
  activeModule: ModuleTab;
  activeSection: SectionTab;
  children: React.ReactNode;
  /** Whether the Heart Rate tab shows a ✓ completion badge */
  heartRateDone?: boolean;
  onBack?: () => void;
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
    <View style={[chip.dot, { backgroundColor: dotColor }]} />
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

// ─── Secondary section tabs ───────────────────────────────────────────────────
interface SecTabProps {
  label: string;
  icon: string;
  active: boolean;
  badge?: string; // e.g. "✓" overlay
  onPress?: () => void;
}
const SecTab: React.FC<SecTabProps> = ({ label, icon, active, badge, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="tab"
    style={[secTab.base, active && secTab.active]}>
    <Text style={[secTab.icon, active && secTab.iconActive]}>{icon}</Text>
    <Text style={[secTab.label, active && secTab.labelActive]}>
      {label}
    </Text>
    {badge ? (
      <View style={secTab.badge}>
        <Text style={secTab.badgeText}>{badge}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
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
  activeSection,
  children,
  heartRateDone,
  onBack,
}) => {
  return (
    <SafeAreaView style={layout.safe} edges={['top', 'bottom']}>
      {onBack && <BackButton onPress={onBack} />}
      {/* ── Page header ── */}
      <View style={layout.header}>
        <Text style={layout.title}>Stress Analysis</Text>
        <Text style={layout.subtitle}>
          Complete all steps then view your fused result
        </Text>
      </View>

      {/* ── Module step tabs ── */}
      <View style={layout.moduleTabs}>
        <ModuleChip
          label="Survey"
          dotColor={Colors.tabSurveyDot}
          chipBg="#EEEEFF"
          active={activeModule === 'survey'}
        />
        <ModuleChip
          label="Face Scan"
          dotColor={Colors.tabFaceDot}
          chipBg={Colors.tabFaceBg}
          active={activeModule === 'faceScan'}
        />
        <ModuleChip
          label="Heart Rate"
          dotColor={Colors.tabHeartDot}
          chipBg={Colors.tabHeartBg}
          active={activeModule === 'heartRate'}
        />
        <ModuleChip
          label="Reaction"
          dotColor={Colors.tabReactionDot}
          active={activeModule === 'reaction'}
        />
      </View>

      {/* ── Secondary section tabs ── */}
      <View style={layout.secTabs}>
        <SecTab
          label="Heart Rate"
          icon="♥"
          active={activeSection === 'heartRate'}
          badge={heartRateDone ? '✓' : undefined}
        />
        <SecTab
          label="Reaction"
          icon="⚡"
          active={activeSection === 'reaction'}
        />
        <SecTab
          label="Results"
          icon="◎"
          active={activeSection === 'results'}
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
const layout = StyleSheet.create({
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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  moduleTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  secTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 8,
    marginBottom: Spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: Colors.tabBarBg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});

const chip = StyleSheet.create({
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

const secTab = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.divider,
    position: 'relative',
  },
  active: {
    backgroundColor: Colors.tabHeartBg,
  },
  icon: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  iconActive: {
    color: Colors.ctaRed,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.ctaRed,
    fontWeight: '700',
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.nextBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  badgeText: {
    fontSize: 8,
    color: Colors.white,
    fontWeight: '800',
  },
});

const btab = StyleSheet.create({
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
