import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StressAssessmentHubScreen } from './StressAssessmentHubScreen';
import { StressSurveyScreen } from '../survey/StressSurveyScreen';

import { FaceScanNavigator } from '../facescan/FaceScanNavigator';
import { HeartRateNavigator } from '../heartrate/HeartRateNavigator';
import { ReactionGameScreen, ReactionResult } from '../reaction/ReactionGameScreen';
import { loadAssessmentState, saveAssessmentState } from './StressAssessmentHubScreen';
import { AssessmentResultScreen } from './AssessmentResultScreen';

export const AssessmentNavigator = ({ onExit }: { onExit?: () => void }) => {
  const [screen, setScreen] = useState<'hub' | 'survey' | 'faceScan' | 'heartRate' | 'reaction' | 'results'>('hub');

  const handleFaceScanComplete = async (data: any) => {
    const state = await loadAssessmentState();
    state.faceScan = 'completed';
    state.heartRate = 'unlocked';
    // Demo scan result (data) is intentionally not persisted — it is excluded from scoring
    void data;
    await saveAssessmentState(state);
    setScreen('hub');
  };

  const handleHeartRateComplete = async (bpm: number) => {
    const state = await loadAssessmentState();
    state.heartRate = 'completed';
    state.heartRateBpm = bpm;
    state.reaction = 'unlocked';
    await saveAssessmentState(state);
    setScreen('hub');
  };

  const handleReactionComplete = async (result: ReactionResult) => {
    const state = await loadAssessmentState();
    state.reaction = 'completed';
    state.reactionTimeMs = result.average;
    await saveAssessmentState(state);
    setScreen('results');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'hub':
        return (
          <StressAssessmentHubScreen
            onNavigate={(nextScreen: string) => {
              if (nextScreen === 'StressSurvey') setScreen('survey');
              if (nextScreen === 'FaceScan') setScreen('faceScan');
              if (nextScreen === 'HeartRate') setScreen('heartRate');
              if (nextScreen === 'ReactionGame') setScreen('reaction');
              if (nextScreen === 'Results') setScreen('results');
            }}
          />
        );
      case 'survey':
        return (
          <StressSurveyScreen
            onBack={() => setScreen('hub')}
          />
        );
      case 'faceScan':
        return (
          <FaceScanNavigator
            onBack={() => setScreen('hub')}
            onFinishScan={handleFaceScanComplete}
          />
        );
      case 'heartRate':
        return (
          <HeartRateNavigator
            onExit={() => setScreen('hub')}
            onModuleComplete={handleHeartRateComplete}
          />
        );
      case 'reaction':
        return (
          <ReactionGameScreen
            onBack={() => setScreen('hub')}
            onComplete={handleReactionComplete}
          />
        );
      case 'results':
        return (
          <AssessmentResultScreen
            onBack={() => setScreen('hub')}
          />
        );
      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderScreen()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
