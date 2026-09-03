/**
 * HeartRateNavigator
 * State-based navigator for the 3-screen Heart Rate Analysis journey.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { HeartRateInstructionsScreen } from './HeartRateInstructionsScreen';
import { HeartRateEntryScreen } from './HeartRateEntryScreen';
import { HeartRateTimerScreen } from './HeartRateTimerScreen';
import { HeartRateResultScreen } from './HeartRateResultScreen';
import { BottomTabBar, BottomNavTab } from '../../components/navigation/BottomTabBar';

type Screen = 'instructions' | 'timer' | 'entry' | 'result';

interface Props {
  onExit?: () => void;
  onNavigateTab?: (tab: BottomNavTab) => void;
  onModuleComplete?: (bpm: number) => void;
}

export const HeartRateNavigator: React.FC<Props> = ({
  onExit,
  onNavigateTab,
  onModuleComplete,
}) => {
  const [screen, setScreen] = useState<Screen>('instructions');
  const [bpmResult, setBpmResult] = useState(0);
  const [beatsResult, setBeatsResult] = useState(0);

  const handleCalculate = (bpm: number, beats: number) => {
    setBpmResult(bpm);
    setBeatsResult(beats);
    setScreen('result');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'instructions':
        return (
          <HeartRateInstructionsScreen
            onBack={() => onExit?.()}
            onReady={() => setScreen('timer')}
          />
        );

      case 'timer':
        return (
          <HeartRateTimerScreen
            onBack={() => setScreen('instructions')}
            onComplete={() => setScreen('entry')}
          />
        );

      case 'entry':
        return (
          <HeartRateEntryScreen
            onBack={() => setScreen('instructions')}
            onCalculate={handleCalculate}
          />
        );

      case 'result':
        return (
          <HeartRateResultScreen
            bpm={bpmResult}
            beats={beatsResult}
            onBack={() => setScreen('entry')}
            onRedo={() => setScreen('entry')}
            onNext={() => onModuleComplete?.(bpmResult)}
          />
        );
    }
  };

  return <View style={styles.container}>{renderScreen()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  content: {
    flex: 1,
  },
});
