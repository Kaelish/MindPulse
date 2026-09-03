import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReactionNavigator } from './src/screens/reaction/ReactionNavigator';
import { Colors } from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={Colors.white} />
      <View style={styles.root}>
        <ReactionNavigator
          onBack={() => console.log('Back')}
          onModuleComplete={(result) =>
            console.log('Reaction complete', JSON.stringify(result, null, 2))
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
