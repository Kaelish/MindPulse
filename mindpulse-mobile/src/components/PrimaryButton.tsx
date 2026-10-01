/**
 * PrimaryButton – Full-width accessible CTA button
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { registerThemeStyles } from '../theme/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const PrimaryButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
}) => {
  const bgColor =
    variant === 'accent' ? Colors.nextBg : Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.btn,
        { backgroundColor: bgColor },
        (disabled || loading) && styles.btnDisabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <View style={styles.inner}>
          <Text style={styles.label}>{label}</Text>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const makeStyles = () => StyleSheet.create({
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: `${0}px ${4 }px ${8}px rgba(0,0,0,${0.25})` },
      default: { shadowColor: Colors.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4  } }
    }),
  },
  btnDisabled: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.button,
    color: Colors.white,
  },
  iconWrap: {
    marginLeft: 4,
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
