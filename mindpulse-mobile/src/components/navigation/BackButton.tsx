import React from 'react';
import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
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
    style={[styles.button, style]}
  >
    {/* Arrow drawn from Views — left-pointing chevron */}
    <View style={styles.arrowWrap}>
      <View style={styles.arrowTop} />
      <View style={styles.arrowBottom} />
    </View>
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
  arrowWrap: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowTop: {
    width: 10,
    height: 2.5,
    backgroundColor: toneBg('#4A7DC7'),
    borderRadius: 1.5,
    transform: [{ rotate: '-45deg' }, { translateY: 3.5 }],
  },
  arrowBottom: {
    width: 10,
    height: 2.5,
    backgroundColor: toneBg('#4A7DC7'),
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }, { translateY: -3.5 }],
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });