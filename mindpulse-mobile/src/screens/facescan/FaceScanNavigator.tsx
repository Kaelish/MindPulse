import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FaceScanInstructionsScreen } from './FaceScanInstructionsScreen';
import { FaceScanCameraScreen } from './FaceScanCameraScreen';
import { FaceScanResultScreen } from './FaceScanResultScreen';

export type FaceScanStep = 'instructions' | 'camera' | 'result';

interface Props {
  onBack: () => void;
  onFinishScan: (sessionData: { expression: string, score: number }) => void;
}

export const FaceScanNavigator: React.FC<Props> = ({ onBack, onFinishScan }) => {
  const [step, setStep] = useState<FaceScanStep>('instructions');
  
  // Results
  const [expression, setExpression] = useState('neutral');
  const [score, setScore] = useState(0);

  const handleScanComplete = (detectedExpression: string, detectedScore: number) => {
    setExpression(detectedExpression);
    setScore(detectedScore);
    setStep('result');
  };

  const renderStep = () => {
    switch (step) {
      case 'instructions':
        return (
          <FaceScanInstructionsScreen
            onBack={onBack}
            onReady={() => setStep('camera')}
          />
        );
      case 'camera':
        return (
          <FaceScanCameraScreen
            onBack={() => setStep('instructions')}
            onComplete={handleScanComplete}
          />
        );
      case 'result':
        return (
          <FaceScanResultScreen
            expression={expression}
            score={score}
            onRetry={() => setStep('instructions')}
            onFinish={() => onFinishScan({ expression, score })}
          />
        );
    }
  };

  return <View style={styles.container}>{renderStep()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
  },
});
