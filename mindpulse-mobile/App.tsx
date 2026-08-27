/**
 * MindPulse – App Entry Point
 * Mounts the Heart Rate Analysis module for development/preview.
 */

import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeartRateNavigator } from './src/screens/heartrate/HeartRateNavigator';
import { Colors } from './src/theme/colors';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.root}>
        <HeartRateNavigator
          onExit={() => console.log('Exit heart rate module')}
          onModuleComplete={bpm =>
            console.log(`Heart rate module complete – BPM: ${bpm}`)
          }
        />
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
