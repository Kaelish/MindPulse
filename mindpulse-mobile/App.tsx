import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HealthSetupScreen } from './src/screens/onboarding/HealthSetupScreen';
import { PatientDashboardScreen } from './src/screens/patient/PatientDashboardScreen';
import { VideoCallScreen } from './src/screens/calls/VideoCallScreen';
import { Colors } from './src/theme/colors';

type Screen = 'splash' | 'healthSetup' | 'dashboard' | 'call';

function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  useEffect(() => {
    const timer = setTimeout(() => setScreen('healthSetup'), 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.root}>
        {screen === 'splash' ? (
          <View style={styles.splash}>
            <View style={styles.logoMark}>
              <View style={styles.logoPulse} />
            </View>
            <RNText style={styles.logoText}>MindPulse</RNText>
            <RNText style={styles.tagline}>Your personal stress companion</RNText>
          </View>
        ) : screen === 'healthSetup' ? (
          <HealthSetupScreen onContinue={() => setScreen('dashboard')} />
        ) : screen === 'dashboard' ? (
          <PatientDashboardScreen onStartVideoCall={() => setScreen('call')} />
        ) : (
          <VideoCallScreen
            doctorId="doctor-123"
            patientId="patient-456"
            onEndCall={() => setScreen('dashboard')}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEFFF2',
  },
  logoMark: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDBCA9',
    marginBottom: 14,
  },
  logoPulse: {
    width: 48,
    height: 22,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: Colors.white,
    transform: [{ rotate: '-12deg' }],
  },
  logoText: {
    color: '#DDBCA9',
    fontSize: 20,
    fontWeight: '500',
  },
  tagline: {
    marginTop: 190,
    color: '#7A7A7A',
    fontSize: 13,
  },
});

export default App;
