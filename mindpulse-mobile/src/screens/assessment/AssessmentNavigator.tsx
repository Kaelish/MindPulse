import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StressAssessmentHubScreen } from './StressAssessmentHubScreen';
import { StressSurveyScreen } from '../survey/StressSurveyScreen';
import { ToolSurveyScreen } from './ToolSurveyScreen';
import { AssessmentTool } from '../../services/assessmentTools';

import { FaceScanNavigator } from '../facescan/FaceScanNavigator';
import { HeartRateNavigator } from '../heartrate/HeartRateNavigator';
import { ReactionGameScreen, ReactionResult } from '../reaction/ReactionGameScreen';
import { loadAssessmentState, saveAssessmentState } from './StressAssessmentHubScreen';
import { AssessmentResultScreen } from './AssessmentResultScreen';
import { registerThemeStyles } from '../../theme/theme';

export const AssessmentNavigator = ({ onExit, onBookSession }: { onExit?: () => void; onBookSession?: () => void }) => {
  const [screen, setScreen] = useState<'hub' | 'survey' | 'toolSurvey' | 'faceScan' | 'heartRate' | 'reaction' | 'results'>('hub');
  const [activeTool, setActiveTool] = useState<AssessmentTool | null>(null);

  const handleFaceScanComplete = async (data: any) => {
    const state = await loadAssessmentState();
    state.faceScan = 'completed';
    if (state.heartRate === 'locked') state.heartRate = 'unlocked';
    // Demo scan result (data) is intentionally not persisted — it is excluded from scoring
    void data;
    await saveAssessmentState(state);
    setScreen('hub');
  };

  const handleFaceScanSkip = async () => {
    const state = await loadAssessmentState();
    if (state.faceScan !== 'completed') state.faceScan = 'skipped';
    if (state.heartRate === 'locked') state.heartRate = 'unlocked';
    await saveAssessmentState(state);
    setScreen('hub');
  };

  const handleHeartRateComplete = async (bpm: number) => {
    const state = await loadAssessmentState();
    state.heartRate = 'completed';
    state.heartRateBpm = bpm;
    if (state.reaction === 'locked') state.reaction = 'unlocked';
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
            onNavigate={(nextScreen: string, tool?: AssessmentTool) => {
              if (nextScreen === 'StressSurvey') {
                // The Multi-Modal tool travels with the built-in survey so its
                // saved answers can carry the real tool id + admin-managed title.
                setActiveTool(tool ?? null);
                setScreen('survey');
              }
              if (nextScreen === 'FaceScan') setScreen('faceScan');
              if (nextScreen === 'HeartRate') setScreen('heartRate');
              if (nextScreen === 'ReactionGame') setScreen('reaction');
              if (nextScreen === 'Results') setScreen('results');
              if (nextScreen === 'ToolSurvey' && tool) {
                setActiveTool(tool);
                setScreen('toolSurvey');
              }
            }}
          />
        );
      case 'survey':
        return (
          <StressSurveyScreen
            tool={activeTool ?? undefined}
            onBack={() => setScreen('hub')}
          />
        );
      case 'toolSurvey':
        return activeTool ? (
          <ToolSurveyScreen
            tool={activeTool}
            onBack={() => {
              setActiveTool(null);
              setScreen('hub');
            }}
            onComplete={() => {
              setActiveTool(null);
              setScreen('hub');
            }}
          />
        ) : null;
      case 'faceScan':
        return (
          <FaceScanNavigator
            onBack={() => setScreen('hub')}
            onFinishScan={handleFaceScanComplete}
            onSkip={handleFaceScanSkip}
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
            onBookSession={onBookSession}
          />
        );
      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderScreen()}</View>;
};

const makeStyles = () => StyleSheet.create({
  container: {
    flex: 1,
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
