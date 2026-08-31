import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HealthSetupScreen } from './src/screens/onboarding/HealthSetupScreen';
import {
  DashboardTab,
  PatientDashboardScreen,
} from './src/screens/patient/PatientDashboardScreen';
import { PatientProfileScreen } from './src/screens/patient/PatientProfileScreen';
import { HeartRateNavigator } from './src/screens/heartrate/HeartRateNavigator';
import { AppointmentBookingScreen } from './src/screens/appointments/AppointmentBookingScreen';
import { VideoCallScreen } from './src/screens/calls/VideoCallScreen';
import { saveNewStressSession } from './src/services/dashboard';
import { Colors } from './src/theme/colors';

type ScreenMode = 'splash' | 'dashboard' | 'profile' | 'analysis' | 'clinics' | 'healthSetup' | 'call';

function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('splash');
  const [currentTab, setCurrentTab] = useState<DashboardTab>('home');

  useEffect(() => {
    const timer = setTimeout(() => {
      setScreenMode('dashboard');
      setCurrentTab('home');
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  const handleTabNavigate = (tab: DashboardTab) => {
    setCurrentTab(tab);
    if (tab === 'analysis') {
      setScreenMode('analysis');
    } else if (tab === 'clinics') {
      setScreenMode('clinics');
    } else if (tab === 'profile') {
      setScreenMode('profile');
    } else {
      setScreenMode('dashboard');
    }
  };

  const handleAnalysisComplete = async (bpm: number) => {
    const score = Math.min(100, Math.max(20, Math.round(bpm * 0.85)));
    await saveNewStressSession(
      score,
      `Completed HR Camera assessment (${bpm} bpm)`,
      bpm,
    );
    setCurrentTab('profile');
    setScreenMode('profile');
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8ED" />
      <View style={styles.root}>
        {screenMode === 'splash' ? (
          <View style={styles.splash}>
            <View style={styles.logoMark}>
              <View style={styles.logoPulse} />
            </View>
            <RNText style={styles.logoText}>MindPulse</RNText>
            <RNText style={styles.tagline}>Your personal stress companion</RNText>
          </View>
        ) : screenMode === 'dashboard' ? (
          <PatientDashboardScreen
            activeTab={currentTab}
            onNavigate={handleTabNavigate}
            onStartVideoCall={() => setScreenMode('call')}
            onRunSurvey={() => {
              setCurrentTab('profile');
              setScreenMode('profile');
            }}
            onRunFaceScan={() => {
              setCurrentTab('analysis');
              setScreenMode('analysis');
            }}
            onRunDailyCheck={() => {
              setCurrentTab('analysis');
              setScreenMode('analysis');
            }}
          />
        ) : screenMode === 'profile' ? (
          <PatientProfileScreen
            onNavigateHome={() => {
              setCurrentTab('home');
              setScreenMode('dashboard');
            }}
            onNavigateTab={handleTabNavigate}
            onSignOut={() => {
              setCurrentTab('home');
              setScreenMode('dashboard');
            }}
            onOpenHealthSetup={() => {
              setScreenMode('healthSetup');
            }}
          />
        ) : screenMode === 'analysis' ? (
          <HeartRateNavigator
            onExit={() => {
              setCurrentTab('profile');
              setScreenMode('profile');
            }}
            onModuleComplete={handleAnalysisComplete}
          />
        ) : screenMode === 'clinics' ? (
          <View style={styles.subScreenWrap}>
            <AppointmentBookingScreen
              onNavigateTab={handleTabNavigate}
              onStartVideoCall={() => setScreenMode('call')}
            />
          </View>
        ) : screenMode === 'healthSetup' ? (
          <HealthSetupScreen
            onContinue={() => {
              setCurrentTab('profile');
              setScreenMode('profile');
            }}
          />
        ) : (
          <VideoCallScreen
            doctorId="doctor-123"
            patientId="patient-456"
            onEndCall={() => {
              setCurrentTab('home');
              setScreenMode('dashboard');
            }}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  subScreenWrap: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8ED',
  },
  logoMark: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B9EF7',
    marginBottom: 14,
  },
  logoPulse: {
    width: 48,
    height: 22,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-12deg' }],
  },
  logoText: {
    color: '#5B9EF7',
    fontSize: 22,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 180,
    color: '#64748B',
    fontSize: 13,
  },
});

export default App;
