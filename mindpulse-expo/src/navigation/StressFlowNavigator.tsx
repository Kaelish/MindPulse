/**
 * StressFlowNavigator
 * ─────────────────────────────────────────────────────────────────────────────
 * Root navigator for the entire Stress Analysis module.
 * Owns which screen is visible and passes navigation callbacks down to each
 * screen so the secondary tab row (Heart Rate / Reaction / Results) actually
 * switches screens.
 *
 * Screens
 *   'heartRate'  →  HeartRateNavigator  (Instructions → Entry → Result)
 *   'reaction'   →  ReactionGameScreen  (Instructions → Game → Results)
 *   'results'    →  placeholder (Final Fusion Score — future)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeartRateNavigator } from '../screens/heartrate/HeartRateNavigator';
import { ReactionGameScreen } from '../screens/reaction/ReactionGameScreen';
import { Colors } from '../theme/colors';
import { Radius, Spacing, Typography } from '../theme/typography';

export type FlowScreen = 'heartRate' | 'reaction' | 'results';

interface Props {
  onFlowComplete?: () => void;
}

export const StressFlowNavigator: React.FC<Props> = ({ onFlowComplete }) => {
  const [activeScreen, setActiveScreen] = useState<FlowScreen>('heartRate');
  const [heartRateDone, setHeartRateDone] = useState(false);
  const [reactionDone, setReactionDone] = useState(false);

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabs: {
    key: FlowScreen;
    icon: string;
    label: string;
    done: boolean;
  }[] = [
    { key: 'heartRate', icon: '♥', label: 'Heart Rate', done: heartRateDone },
    { key: 'reaction', icon: '⚡', label: 'Reaction', done: reactionDone },
    { key: 'results', icon: '◎', label: 'Results', done: false },
  ];

  // ── Render active screen ───────────────────────────────────────────────────
  const renderScreen = () => {
    switch (activeScreen) {
      case 'heartRate':
        return (
          <HeartRateNavigator
            onExit={() => {}}
            onModuleComplete={(bpm) => {
              console.log('HR done, BPM:', bpm);
              setHeartRateDone(true);
              setActiveScreen('reaction');
            }}
          />
        );

      case 'reaction':
        return (
          <ReactionGameScreen
            onBack={() => setActiveScreen('heartRate')}
            onComplete={(result) => {
              console.log('Reaction done:', result);
              setReactionDone(true);
              setActiveScreen('results');
            }}
          />
        );

      case 'results':
        return <ResultsPlaceholder onRetry={() => setActiveScreen('heartRate')} />;
    }
  };

  // Each child screen renders its own StressAnalysisLayout chrome EXCEPT
  // the HeartRate screens which already have their own layout.
  // We inject tab navigation via the layout's onPress callbacks.
  // The cleanest approach: pass a `onTabPress` prop down through context,
  // but since we don't have context wired yet, we overlay a transparent tab
  // bar on top of the existing layout's sec-tab area so taps are captured.
  //
  // Actually the simplest fix: extend StressAnalysisLayout to accept
  // onTabPress and call it. We do that inline here using a wrapper approach —
  // the child renders its own layout, and we add a thin INVISIBLE touchable
  // strip that sits on top of the tab row region at the top.
  //
  // Cleanest real fix: pass navigation handler into layout via a global
  // navigation context. We implement that below.

  return (
    <TabNavigationContext.Provider
      value={{
        activeSection: activeScreen,
        heartRateDone,
        reactionDone,
        onTabPress: (tab) => {
          // Only allow navigating to completed or current sections
          if (tab === 'results' && !heartRateDone && !reactionDone) return;
          setActiveScreen(tab);
        },
      }}>
      {renderScreen()}
    </TabNavigationContext.Provider>
  );
};

// ─── Results Placeholder ──────────────────────────────────────────────────────
const ResultsPlaceholder: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <SafeAreaView style={ph.safe} edges={['top', 'bottom']}>
    <View style={ph.center}>
      <Text style={ph.emoji}>📊</Text>
      <Text style={ph.title}>Final Results</Text>
      <Text style={ph.subtitle}>
        Multi-modal stress fusion score coming soon.
      </Text>
      <TouchableOpacity onPress={onRetry} style={ph.btn}>
        <Text style={ph.btnText}>↺  Restart Analysis</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const ph = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.pageBg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emoji: { fontSize: 64 },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...Typography.body1,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
  },
  btnText: { ...Typography.button, color: Colors.white },
});

// ─── Tab Navigation Context ───────────────────────────────────────────────────
// Used by StressAnalysisLayout to call back up when a tab is pressed.
interface TabNavContextValue {
  activeSection: FlowScreen;
  heartRateDone: boolean;
  reactionDone: boolean;
  onTabPress: (tab: FlowScreen) => void;
}

export const TabNavigationContext =
  React.createContext<TabNavContextValue>({
    activeSection: 'heartRate',
    heartRateDone: false,
    reactionDone: false,
    onTabPress: () => {},
  });
