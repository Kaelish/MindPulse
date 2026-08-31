import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type BottomNavTab = 'dashboard' | 'analysis' | 'clinics' | 'profile';

interface BottomTabBarProps {
  activeTab: BottomNavTab;
  onNavigate?: (screen: BottomNavTab) => void;
}

const HomeTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 16 }}>🏠</Text>
  </View>
);

const AnalysisTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 16 }}>📊</Text>
  </View>
);

const ClinicsTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 16 }}>🏥</Text>
  </View>
);

const ProfileTabIcon = () => (
  <View style={iconStyles.navWrap}>
    <Text style={{ fontSize: 16 }}>👤</Text>
  </View>
);

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onNavigate }) => {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.8}
        onPress={() => onNavigate?.('dashboard')}
      >
        <HomeTabIcon />
        <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>
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
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#27AE60',
    fontWeight: '700',
  },
});
