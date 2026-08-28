import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeartRateNavigator } from './src/screens/heartrate/HeartRateNavigator';
import { Colors } from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={Colors.white} />
      <View style={styles.root}>
        <HeartRateNavigator
          onExit={() => console.log('Exit')}
          onModuleComplete={(bpm) => console.log('BPM result:', bpm)}
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
