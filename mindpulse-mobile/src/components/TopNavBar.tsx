/**
 * TopNavBar – Reusable top navigation bar for Stress Analysis flow
 * Shows back arrow, screen title, and optional step progress indicator
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';

interface Props {
  title: string;
  onBack: () => void;
  currentStep?: number;
  totalSteps?: number;
}

const BackArrowIcon = () => (
  <View style={styles.arrowContainer}>
    {/* Left-pointing chevron drawn with borders */}
    <View style={styles.arrowChevron} />
  </View>
);

const StepDots = ({ current, total }: { current: number; total: number }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i + 1 === current && styles.dotActive,
          i + 1 < current && styles.dotCompleted,
        ]}
      />
    ))}
  </View>
);

export const TopNavBar: React.FC<Props> = ({
  title,
  onBack,
  currentStep,
  totalSteps,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <BackArrowIcon />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Right spacer to centre title */}
        <View style={styles.spacer} />
      </View>

      {/* Step progress */}
      {currentStep !== undefined && totalSteps !== undefined && (
        <View style={styles.progressSection}>
          <View style={styles.progressTrackRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i < currentStep ? styles.progressSegmentFilled : null,
                  i < totalSteps - 1 ? { marginRight: 4 } : null,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            Step {currentStep} of {totalSteps}
          </Text>
        </View>
      )}
    </View>
  );
};

const BACK_BTN_SIZE = 38;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    elevation: 2,
    ...Platform.select({
      web: { boxShadow: `${0}px ${2 }px ${4}px rgba(0,0,0,${0.04})` },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2  } }
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: BACK_BTN_SIZE,
  },
  backBtn: {
    width: BACK_BTN_SIZE,
    height: BACK_BTN_SIZE,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowChevron: {
    width: 9,
    height: 9,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: Colors.primary,
    transform: [{ rotate: '45deg' }, { translateX: 2 }],
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    ...Typography.h3,
  },
  spacer: {
    width: BACK_BTN_SIZE,
  },
  progressSection: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  progressTrackRow: {
    flexDirection: 'row',
    width: '100%',
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  progressSegmentFilled: {
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 18,
  },
  dotCompleted: {
    backgroundColor: Colors.nextBg,
  },
});
