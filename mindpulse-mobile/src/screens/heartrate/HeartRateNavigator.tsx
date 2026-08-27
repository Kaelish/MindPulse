/**
 * HeartRateNavigator
 * State-based navigator for the 3-screen Heart Rate Analysis journey.
 */
import React, { useState } from 'react';
import { HeartRateInstructionsScreen } from './HeartRateInstructionsScreen';
import { HeartRateEntryScreen } from './HeartRateEntryScreen';
import { HeartRateResultScreen } from './HeartRateResultScreen';

type Screen = 'instructions' | 'entry' | 'result';

interface Props {
  onExit?: () => void;
  onModuleComplete?: (bpm: number) => void;
}

export const HeartRateNavigator: React.FC<Props> = ({
  onExit,
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

  switch (screen) {
    case 'instructions':
      return (
        <HeartRateInstructionsScreen
          onBack={() => onExit?.()}
          onReady={() => setScreen('entry')}
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
          onRedo={() => setScreen('entry')}
          onNext={() => onModuleComplete?.(bpmResult)}
        />
      );
  }
};
