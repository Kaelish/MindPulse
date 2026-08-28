/**
 * MindPulse shared design tokens
 * Source of truth for spacing, color, radius, and typography.
 */

export const BrandColors = {
  primary: '#4A90D9',
  primaryDark: '#2E6BB3',
  primarySoft: '#EAF3FB',
  secondary: '#7C4DCC',
  secondarySoft: '#F0E8FB',
  accent: '#C95C3A',
  accentSoft: '#FCEAE4',
  success: '#27AE60',
  successSoft: '#D6F5E3',
  warning: '#E08A00',
  warningSoft: '#FFF3CD',
  danger: '#E05C5C',
  dangerSoft: '#FFD6D6',
};

export const NeutralColors = {
  white: '#FFFFFF',
  pageBg: '#FAF8F4',
  surface: '#FFFFFF',
  border: '#E8EAF0',
  divider: '#F0F2F6',
  textPrimary: '#1A2340',
  textSecondary: '#6B7A99',
  textHint: '#B0B8C8',
  textOnDark: '#FFFFFF',
};

export const SemanticColors = {
  heartRate: '#E05C5C',
  faceScan: '#4A90D9',
  survey: '#5B6EF5',
  reaction: '#9B9B9B',
  call: '#4A90D9',
  mood: '#7C4DCC',
  note: '#F5C15E',
};

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const AppRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const AppTypography = {
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  button: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0.3 },
};

export const Shadows = {
  small: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  medium: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
};
