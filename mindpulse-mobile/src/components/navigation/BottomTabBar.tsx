import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Colors } from '../../theme/colors';

import { Ionicons } from '@expo/vector-icons';

export type BottomNavTab = 'home' | 'analysis' | 'clinics' | 'profile';

interface BottomTabBarProps {
  activeTab: BottomNavTab;
  onNavigate?: (screen: BottomNavTab) => void;
  /** 'doctor' renders the doctor portal tabs (Home / Consults / Profile). */
  variant?: 'patient' | 'doctor';
}

const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = 'rgba(255,255,255,0.45)';

const PATIENT_TABS: { key: BottomNavTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'analysis', label: 'Analysis', icon: 'pulse-outline', activeIcon: 'pulse' },
  { key: 'clinics', label: 'Clinics', icon: 'medical-outline', activeIcon: 'medical' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

const DOCTOR_TABS: { key: BottomNavTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'clinics', label: 'Consults', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onNavigate, variant = 'patient' }) => {
  const tabs = variant === 'doctor' ? DOCTOR_TABS : PATIENT_TABS;

  return (
    <View style={styles.bottomNav}>
      {tabs.map(({ key, label, icon, activeIcon }) => {
        const active = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.tabItem}
            activeOpacity={0.75}
            onPress={() => onNavigate?.(key)}
          >
            <View style={[styles.iconPill, active && styles.iconPillActive]}>
              <Ionicons 
                name={active ? activeIcon : icon} 
                size={22} 
                color={active ? ACTIVE_COLOR : INACTIVE_COLOR} 
              />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: Colors.tabBarBg,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingBottom: 6,
    ...Platform.select({
      web: { boxShadow: '0px -2px 16px rgba(74,110,200,0.18)' },
      default: { shadowColor: '#3060C0', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.2, shadowRadius: 12 },
    }),
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  iconPill: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  tabLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10.5,
  },
});
