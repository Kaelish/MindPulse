/**
 * ReactionNavigator
 * Thin wrapper — keeps the navigator pattern consistent with HeartRateNavigator.
 */
import React from 'react';
import { ReactionGameScreen } from './ReactionGameScreen';

interface ReactionResult {
  attemptCount: number;
  averageReactionMs: number;
  fastestReactionMs: number;
  slowestReactionMs: number;
  mistakeCount: number;
  reactionScore: number;
  stressInterpretation: 'Low' | 'Moderate' | 'High';
}

interface Props {
  onBack?: () => void;
  onModuleComplete?: (result: ReactionResult) => void;
}

export const ReactionNavigator: React.FC<Props> = ({
  onBack,
  onModuleComplete,
}) => {
  return (
    <ReactionGameScreen
      onBack={onBack}
      onComplete={onModuleComplete}
    />
  );
};
