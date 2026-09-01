import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type BottomNavTab = 'home' | 'analysis' | 'clinics' | 'profile';

interface BottomTabBarProps {
  activeTab: BottomNavTab;
  onNavigate?: (screen: BottomNavTab) => void;
}

const HomeTabIcon = ({ active }: { active: boolean }) => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 18, color: '#FFFFFF', opacity: active ? 1 : 0.8 }}>⌂</Text>
  </View>
);

const AnalysisTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 18 }}>🧠</Text>
  </View>
);

const ClinicsTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 18 }}>🩺</Text>
  </View>
);

const ProfileTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 18 }}>👤</Text>
  </View>
);

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onNavigate }) => {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.8}
        onPress={() => onNavigate?.('home')}
      >
        <HomeTabIcon active={activeTab === 'home'} />
        <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.8}
        onPress={() => onNavigate?.('analysis')}
      >
        <AnalysisTabIcon />
        <Text style={[styles.tabLabel, activeTab === 'analysis' && styles.tabLabelActive]}>
          Analysis
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.8}
        onPress={() => onNavigate?.('clinics')}
      >
        <ClinicsTabIcon />
        <Text style={[styles.tabLabel, activeTab === 'clinics' && styles.tabLabelActive]}>
          Clinics
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.8}
        onPress={() => onNavigate?.('profile')}
      >
        <ProfileTabIcon />
        <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const iconStyles = StyleSheet.create({
  navWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#5B8DEF',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
