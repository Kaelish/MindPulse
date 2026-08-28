import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PatientDashboardScreen } from './src/screens/patient/PatientDashboardScreen';
import { VideoCallScreen } from './src/screens/calls/VideoCallScreen';
import { Colors } from './src/theme/colors';

type Screen = 'dashboard' | 'call';

function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.root}>
        {screen === 'dashboard' ? (
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
});

export default App;
