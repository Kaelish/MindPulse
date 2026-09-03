import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface BackButtonProps {
  onPress: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress }) => (
  <TouchableOpacity
    accessibilityLabel="Go back"
    accessibilityRole="button"
    activeOpacity={0.8}
    onPress={onPress}
    style={styles.button}
  >
    <Text style={styles.arrow}>‹</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 4,
    height: 44,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    top: 12,
    width: 44,
    zIndex: 10,
  },
  arrow: {
    color: '#5B6EF5',
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 38,
    marginTop: -3,
  },
});