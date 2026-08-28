/**
 * MindPulse Design System – Typography Scale
 */
export const Typography = {
  // Headings
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },

  // Body
  body1: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  body2: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },

  // Labels / Captions
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 16 },

  // Metric display
  metric: { fontSize: 56, fontWeight: '800' as const, letterSpacing: -2 },
  metricUnit: { fontSize: 22, fontWeight: '600' as const },

  // Button
  button: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0.3 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};
