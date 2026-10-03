import React from 'react';
import { StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface BackButtonProps {
  onPress: () => void;
  /** Optional style override for the button container */
  style?: object;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, style }) => (
  <TouchableOpacity
    accessibilityLabel="Go back"
    accessibilityRole="button"
    activeOpacity={0.8}
    onPress={onPress}
    // Wider touch target than the 44pt circle — the button sits near the top
    // edge, so extra slop keeps it easy to hit.
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    style={[styles.button, style]}
  >
    {/* Real icon: the old chevron was two rotated Views whose strokes crossed
        and overflowed their 14×14 box, rendering as a clipped "×". */}
    <Ionicons name="chevron-back" size={20} color={tone('#4A7DC7')} />
  </TouchableOpacity>
);

const makeStyles = () => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: toneBg('#FFFFFF'),
    borderRadius: 22,
    elevation: 6,
    height: 44,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    ...Platform.select({
      web: { boxShadow: '0px 3px 6px rgba(26,35,64,0.14)' },
      default: {
        shadowColor: '#1A2340',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 6,
      }
    }),
    top: 14,
    width: 44,
    zIndex: 10,
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });