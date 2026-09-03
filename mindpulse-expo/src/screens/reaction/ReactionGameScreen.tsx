/**
 * ReactionGameScreen
 * ─────────────────────────────────────────────────────────────────────────────
 * Cognitive stress measurement via 3-round reaction time mini-game.
 *
 * State machine:
 *   'instructions'  →  user reads how-to card
 *   'countdown'     →  random wait interval (1.5s – 4.0s) BEFORE green signal
 *   'go'            →  bright green "TAP NOW!" — starts high-res timer
 *   'early'         →  user tapped too early (false start)
 *   'recorded'      →  valid tap captured, show brief flash before next round
 *   'results'       →  all 3 rounds complete, show metric cards + stress badge
 *
 * Data model  (REACTION_TEST_RESULT):
 *   attempt_count        3
 *   average_reaction_ms  mean of valid attempts
 *   fastest_reaction_ms  min of valid attempts
 *   slowest_reaction_ms  max of valid attempts
 *   mistake_count        cumulative false starts
 *   reaction_score       0-100 derived score
 *   stress_interpretation  'Low' | 'Moderate' | 'High'
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';

// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 4000;

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase =
  | 'instructions'
  | 'countdown'
  | 'go'
  | 'early'
  | 'recorded'
  | 'results';

type StressLevel = 'Low' | 'Moderate' | 'High';

interface ReactionResult {
  attemptCount: number;
  averageReactionMs: number;
  fastestReactionMs: number;
  slowestReactionMs: number;
  mistakeCount: number;
  reactionScore: number;
  stressInterpretation: StressLevel;
}

interface GameState {
  phase: Phase;
  round: number;            // 1-based current round
  attempts: number[];       // valid reaction times (ms)
  mistakeCount: number;
  lastReactionMs: number | null;
}

type Action =
  | { type: 'START_COUNTDOWN' }
  | { type: 'SHOW_GO' }
  | { type: 'RECORD_TAP'; ms: number }
  | { type: 'EARLY_TAP' }
  | { type: 'CONTINUE_AFTER_EARLY' }
  | { type: 'NEXT_ROUND' }
  | { type: 'FINISH' }
  | { type: 'RESET' };

const initialState: GameState = {
  phase: 'instructions',
  round: 1,
  attempts: [],
  mistakeCount: 0,
  lastReactionMs: null,
};

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_COUNTDOWN':
      return { ...state, phase: 'countdown' };
    case 'SHOW_GO':
      return { ...state, phase: 'go' };
    case 'EARLY_TAP':
      return {
        ...state,
        phase: 'early',
        mistakeCount: state.mistakeCount + 1,
      };
    case 'CONTINUE_AFTER_EARLY':
      return { ...state, phase: 'countdown' };
    case 'RECORD_TAP': {
      const newAttempts = [...state.attempts, action.ms];
      const isLastRound = state.round >= TOTAL_ROUNDS;
      return {
        ...state,
        phase: isLastRound ? 'results' : 'recorded',
        attempts: newAttempts,
        lastReactionMs: action.ms,
        round: isLastRound ? state.round : state.round + 1,
      };
    }
    case 'NEXT_ROUND':
      return { ...state, phase: 'countdown' };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────
/** Map average reaction ms + mistakes → 0-100 score + stress level */
function computeResult(
  attempts: number[],
  mistakeCount: number,
): ReactionResult {
  const avg = attempts.reduce((s, v) => s + v, 0) / attempts.length;
  const fastest = Math.min(...attempts);
  const slowest = Math.max(...attempts);

  // Base score: fast < 200ms = 100, slow > 600ms = 0, linear in between
  const baseScore = Math.max(0, Math.min(100, ((600 - avg) / 400) * 100));
  // Penalty: 5 pts per mistake
  const reactionScore = Math.max(0, Math.round(baseScore - mistakeCount * 5));

  let stressInterpretation: StressLevel;
  if (reactionScore >= 70) stressInterpretation = 'Low';
  else if (reactionScore >= 40) stressInterpretation = 'Moderate';
  else stressInterpretation = 'High';

  return {
    attemptCount: TOTAL_ROUNDS,
    averageReactionMs: Math.round(avg),
    fastestReactionMs: Math.round(fastest),
    slowestReactionMs: Math.round(slowest),
    mistakeCount,
    reactionScore,
    stressInterpretation,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Round pips — e.g. ● ● ○ */
const RoundPips: React.FC<{ current: number; total: number }> = ({
  current,
  total,
}) => (
  <View style={pip.row}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          pip.dot,
          i < current - 1 && pip.done,
          i === current - 1 && pip.active,
        ]}
      />
    ))}
  </View>
);

/** Animated pulse ring shown during "go" state */
const PulseRing: React.FC<{ color: string }> = ({ color }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.25,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: Radius.xl,
          borderWidth: 3,
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
      pointerEvents="none"
    />
  );
};

/** Metric card used in the results grid */
interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  bgColor: string;
  valueColor: string;
}
const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon,
  bgColor,
  valueColor,
}) => (
  <View style={[metric.card, { backgroundColor: bgColor }]}>
    <Text style={metric.icon}>{icon}</Text>
    <Text style={[metric.value, { color: valueColor }]}>{value}</Text>
    {unit ? <Text style={[metric.unit, { color: valueColor }]}>{unit}</Text> : null}
    <Text style={metric.label}>{label}</Text>
  </View>
);

/** Cognitive stress badge */
const StressBadge: React.FC<{ level: StressLevel; score: number }> = ({
  level,
  score,
}) => {
  const cfg = {
    Low: {
      bg: Colors.cogLowBg,
      text: Colors.cogLowText,
      icon: '😌',
      desc: 'Your reaction speed indicates low cognitive stress. Your mind is sharp and focused.',
    },
    Moderate: {
      bg: Colors.cogModerateBg,
      text: Colors.cogModerateText,
      icon: '😐',
      desc: 'Moderate reaction time suggests some cognitive load. Consider a short break.',
    },
    High: {
      bg: Colors.cogHighBg,
      text: Colors.cogHighText,
      icon: '😟',
      desc: 'Slower reactions suggest high cognitive stress. Your nervous system may be fatigued.',
    },
  }[level];

  return (
    <View style={[badge.wrapper, { backgroundColor: cfg.bg }]}>
      <View style={badge.topRow}>
        <Text style={badge.icon}>{cfg.icon}</Text>
        <View style={badge.textWrap}>
          <Text style={badge.title}>Cognitive Stress Level</Text>
          <View style={[badge.pill, { backgroundColor: cfg.text }]}>
            <Text style={badge.pillText}>{level} Cognitive Stress</Text>
          </View>
        </View>
        <View style={[badge.scoreBubble, { borderColor: cfg.text }]}>
          <Text style={[badge.scoreNum, { color: cfg.text }]}>{score}</Text>
          <Text style={[badge.scoreDen, { color: cfg.text }]}>/100</Text>
        </View>
      </View>
      <Text style={[badge.desc, { color: cfg.text }]}>{cfg.desc}</Text>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void;
  onComplete?: (result: ReactionResult) => void;
}

export const ReactionGameScreen: React.FC<Props> = ({ onBack, onComplete }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const goTimestamp = useRef<number>(0);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (waitTimer.current) clearTimeout(waitTimer.current);
      if (recordedTimer.current) clearTimeout(recordedTimer.current);
    };
  }, []);

  // Drive countdown → go transition
  useEffect(() => {
    if (state.phase === 'countdown') {
      const delay =
        MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
      waitTimer.current = setTimeout(() => {
        goTimestamp.current = performance.now();
        dispatch({ type: 'SHOW_GO' });
      }, delay);
      return () => {
        if (waitTimer.current) clearTimeout(waitTimer.current);
      };
    }
  }, [state.phase, state.round]);

  // After recording a valid tap, wait briefly then auto-advance
  useEffect(() => {
    if (state.phase === 'recorded') {
      recordedTimer.current = setTimeout(() => {
        dispatch({ type: 'NEXT_ROUND' });
      }, 1200);
      return () => {
        if (recordedTimer.current) clearTimeout(recordedTimer.current);
      };
    }
  }, [state.phase]);

  // Fire onComplete callback when reaching results
  useEffect(() => {
    if (state.phase === 'results') {
      const result = computeResult(state.attempts, state.mistakeCount);
      onComplete?.(result);
    }
  }, [state.phase]);

  // ── Tap handler on trigger box ────────────────────────────────────────────
  const handleTriggerPress = useCallback(() => {
    switch (state.phase) {
      case 'go': {
        const ms = performance.now() - goTimestamp.current;
        dispatch({ type: 'RECORD_TAP', ms: Math.round(ms) });
        break;
      }
      case 'countdown':
        dispatch({ type: 'EARLY_TAP' });
        break;
      case 'early':
        dispatch({ type: 'CONTINUE_AFTER_EARLY' });
        break;
      case 'recorded':
        // ignore extra taps during flash
        break;
      default:
        break;
    }
  }, [state.phase]);

  // ── Computed result (memoised when in results phase) ─────────────────────
  const result =
    state.phase === 'results'
      ? computeResult(state.attempts, state.mistakeCount)
      : null;

  // ── Trigger box config ────────────────────────────────────────────────────
  const triggerConfig = {
    instructions: {
      bg: Colors.triggerIdle,
      border: Colors.border,
      text: 'Get Ready',
      subtext: 'Press start to begin',
      textColor: Colors.textSecondary,
    },
    countdown: {
      bg: Colors.triggerWaitBg,
      border: Colors.triggerWait,
      text: 'Wait...',
      subtext: 'Do NOT tap yet!',
      textColor: Colors.triggerWait,
    },
    go: {
      bg: Colors.triggerGoBg,
      border: Colors.triggerGo,
      text: 'TAP NOW!',
      subtext: '',
      textColor: Colors.triggerGo,
    },
    early: {
      bg: Colors.triggerEarlyBg,
      border: Colors.triggerEarly,
      text: 'Too Early!',
      subtext: 'Penalty added. Tap to retry.',
      textColor: Colors.triggerEarly,
    },
    recorded: {
      bg: Colors.triggerGoBg,
      border: Colors.triggerGo,
      text: `${state.lastReactionMs} ms`,
      subtext: '✓ Recorded!',
      textColor: Colors.triggerGo,
    },
    results: {
      bg: Colors.triggerIdle,
      border: Colors.border,
      text: 'Done!',
      subtext: '',
      textColor: Colors.textSecondary,
    },
  }[state.phase];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <StressAnalysisLayout
      activeModule="reaction"
      activeSection="reaction"
      heartRateDone
      reactionDone={state.phase === 'results'}>

      {/* ── Round tracker ── */}
      {state.phase !== 'instructions' && state.phase !== 'results' && (
        <View style={s.roundRow}>
          <Text style={s.roundLabel}>
            Round {Math.min(state.round, TOTAL_ROUNDS)} of {TOTAL_ROUNDS}
          </Text>
          <RoundPips current={state.round} total={TOTAL_ROUNDS} />
          {state.mistakeCount > 0 && (
            <View style={s.mistakeBadge}>
              <Text style={s.mistakeText}>
                {state.mistakeCount} ⚠ mistake{state.mistakeCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Instructions card ── */}
      {state.phase === 'instructions' && (
        <View style={s.instructionCard}>
          <View style={s.instructionHeader}>
            <Text style={s.instructionEmoji}>⚡</Text>
            <Text style={s.instructionTitle}>How it works</Text>
          </View>

          <View style={s.instructionRow}>
            <View style={s.instructionBullet}>
              <Text style={s.bulletNum}>1</Text>
            </View>
            <Text style={s.instructionText}>
              Press <Text style={s.bold}>Start Round 1</Text> below. A wait
              screen will appear — don't tap yet.
            </Text>
          </View>

          <View style={s.instructionRow}>
            <View style={s.instructionBullet}>
              <Text style={s.bulletNum}>2</Text>
            </View>
            <Text style={s.instructionText}>
              The moment the box turns{' '}
              <Text style={[s.bold, { color: Colors.triggerGo }]}>
                bright green
              </Text>{' '}
              and shows <Text style={s.bold}>"TAP NOW!"</Text> — tap it as
              fast as you can.
            </Text>
          </View>

          <View style={s.instructionRow}>
            <View style={s.instructionBullet}>
              <Text style={s.bulletNum}>3</Text>
            </View>
            <Text style={s.instructionText}>
              Tapping too early counts as a{' '}
              <Text style={[s.bold, { color: Colors.triggerEarly }]}>
                mistake
              </Text>{' '}
              and deducts from your score. Complete{' '}
              <Text style={s.bold}>{TOTAL_ROUNDS} rounds</Text> for your
              result.
            </Text>
          </View>

          <View style={s.tipRow}>
            <Text style={s.tipIcon}>💡</Text>
            <Text style={s.tipText}>
              Sit upright, rest your thumb near the box, and breathe normally
              for the most accurate reading.
            </Text>
          </View>
        </View>
      )}

      {/* ── Trigger box (active during game phases) ── */}
      {state.phase !== 'instructions' && state.phase !== 'results' && (
        <TouchableOpacity
          onPress={handleTriggerPress}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={
            state.phase === 'go' ? 'Tap now!' : 'Wait for green'
          }
          style={[
            s.triggerBox,
            {
              backgroundColor: triggerConfig.bg,
              borderColor: triggerConfig.border,
            },
          ]}>
          {/* Pulse ring on GO state */}
          {state.phase === 'go' && (
            <PulseRing color={Colors.triggerGo} />
          )}

          {/* Icon */}
          <Text style={s.triggerIcon}>
            {state.phase === 'go'
              ? '🟢'
              : state.phase === 'early'
              ? '🔴'
              : state.phase === 'recorded'
              ? '✅'
              : '🟡'}
          </Text>

          <Text
            style={[
              s.triggerMainText,
              { color: triggerConfig.textColor },
            ]}>
            {triggerConfig.text}
          </Text>

          {triggerConfig.subtext ? (
            <Text
              style={[
                s.triggerSubText,
                { color: triggerConfig.textColor },
              ]}>
              {triggerConfig.subtext}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}

      {/* ── Start button (instructions phase only) ── */}
      {state.phase === 'instructions' && (
        <TouchableOpacity
          onPress={() => dispatch({ type: 'START_COUNTDOWN' })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start Round 1"
          style={s.startBtn}>
          <Text style={s.startBtnIcon}>⚡</Text>
          <Text style={s.startBtnLabel}>Start Round 1</Text>
        </TouchableOpacity>
      )}

      {/* ═══════════════════════════════════════════════════════════
           RESULTS PHASE
         ═══════════════════════════════════════════════════════════ */}
      {state.phase === 'results' && result && (
        <>
          {/* ── Header ── */}
          <View style={s.resultsHeader}>
            <Text style={s.resultsTitle}>Reaction Test Complete</Text>
            <Text style={s.resultsSubtitle}>
              {TOTAL_ROUNDS} rounds completed
              {result.mistakeCount > 0
                ? ` · ${result.mistakeCount} mistake${result.mistakeCount > 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>

          {/* ── Average hero card ── */}
          <View style={s.heroCard}>
            <Text style={s.heroLabel}>Average Reaction Time</Text>
            <View style={s.heroValueRow}>
              <Text style={s.heroValue}>{result.averageReactionMs}</Text>
              <Text style={s.heroUnit}>ms</Text>
            </View>
            {/* Mini pulse bar visualiser */}
            <View style={s.barRow}>
              {state.attempts.map((ms, i) => {
                const h = Math.max(8, Math.min(40, ((600 - ms) / 400) * 40));
                return (
                  <View
                    key={i}
                    style={[
                      s.bar,
                      {
                        height: h,
                        backgroundColor:
                          ms === result.fastestReactionMs
                            ? Colors.triggerGo
                            : ms === result.slowestReactionMs
                            ? Colors.triggerEarly
                            : Colors.primary,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Text style={s.barCaption}>
              Round attempts (green = fastest, red = slowest)
            </Text>
          </View>

          {/* ── Metric grid ── */}
          <View style={s.metricGrid}>
            <MetricCard
              icon="⚡"
              label="Fastest"
              value={`${result.fastestReactionMs}`}
              unit="ms"
              bgColor={Colors.reactionCardFastBg}
              valueColor={Colors.triggerGo}
            />
            <MetricCard
              icon="🐢"
              label="Slowest"
              value={`${result.slowestReactionMs}`}
              unit="ms"
              bgColor={Colors.reactionCardSlowBg}
              valueColor={Colors.triggerWait}
            />
            <MetricCard
              icon="🔄"
              label="Rounds"
              value={`${result.attemptCount}`}
              bgColor={Colors.reactionCardAvgBg}
              valueColor={Colors.primary}
            />
            <MetricCard
              icon="⚠️"
              label="Mistakes"
              value={`${result.mistakeCount}`}
              bgColor={
                result.mistakeCount > 0
                  ? Colors.reactionCardMistakeBg
                  : Colors.reactionCardFastBg
              }
              valueColor={
                result.mistakeCount > 0
                  ? Colors.triggerEarly
                  : Colors.triggerGo
              }
            />
          </View>

          {/* ── Cognitive stress badge ── */}
          <StressBadge
            level={result.stressInterpretation}
            score={result.reactionScore}
          />

          {/* ── Action buttons ── */}
          <View style={s.actionRow}>
            <TouchableOpacity
              onPress={() => dispatch({ type: 'RESET' })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Retry test"
              style={s.retryBtn}>
              <Text style={s.retryIcon}>↺</Text>
              <Text style={s.retryLabel}>Retry Test</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onComplete?.(result)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="View overall results"
              style={s.nextBtn}>
              <Text style={s.nextLabel}>Next: Final Results</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </StressAnalysisLayout>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Round row ──────────────────────────────────────────────────────────────
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roundLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  mistakeBadge: {
    backgroundColor: Colors.triggerEarlyBg,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  mistakeText: {
    ...Typography.caption,
    color: Colors.triggerEarly,
    fontWeight: '700',
  },

  // ── Instructions card ──────────────────────────────────────────────────────
  instructionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  instructionEmoji: {
    fontSize: 22,
  },
  instructionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  instructionBullet: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  bulletNum: {
    ...Typography.label,
    color: Colors.white,
    fontSize: 13,
  },
  instructionText: {
    flex: 1,
    ...Typography.body1,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  tipRow: {
    flexDirection: 'row',
    backgroundColor: Colors.tipBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.tipBorder,
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
  },
  tipIcon: {
    fontSize: 15,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    ...Typography.body2,
    color: Colors.tipText,
    lineHeight: 20,
  },

  // ── Trigger box ────────────────────────────────────────────────────────────
  triggerBox: {
    height: 200,
    borderRadius: Radius.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  triggerIcon: {
    fontSize: 44,
  },
  triggerMainText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  triggerSubText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.85,
  },

  // ── Start button ───────────────────────────────────────────────────────────
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    gap: 10,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  startBtnIcon: {
    fontSize: 18,
    color: Colors.white,
  },
  startBtnLabel: {
    ...Typography.button,
    color: Colors.white,
  },

  // ── Results: header ────────────────────────────────────────────────────────
  resultsHeader: {
    alignItems: 'center',
    gap: 4,
  },
  resultsTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  resultsSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Results: hero card ─────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.reactionCardAvgBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  heroValue: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -2,
    lineHeight: 72,
  },
  heroUnit: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 10,
    opacity: 0.8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 44,
    marginTop: 4,
  },
  bar: {
    width: 18,
    borderRadius: 4,
    minHeight: 8,
  },
  barCaption: {
    ...Typography.caption,
    color: Colors.textHint,
    textAlign: 'center',
  },

  // ── Results: metric grid ───────────────────────────────────────────────────
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  // ── Results: action row ────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.redoBg,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.redoBorder,
  },
  retryIcon: {
    fontSize: 16,
    color: Colors.redoText,
    fontWeight: '700',
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.redoText,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: Colors.nextBg,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: Colors.nextBg,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.nextText,
  },
});

// ── Pip styles ────────────────────────────────────────────────────────────────
const pip = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  active: {
    backgroundColor: Colors.primary,
    width: 22,
    borderRadius: 5,
  },
  done: {
    backgroundColor: Colors.nextBg,
  },
});

// ── Metric card styles ────────────────────────────────────────────────────────
const metric = StyleSheet.create({
  card: {
    width: '47.5%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon: {
    fontSize: 22,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
    opacity: 0.7,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});

// ── Badge styles ──────────────────────────────────────────────────────────────
const badge = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 32,
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 5,
  },
  title: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  scoreBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 2,
    flexShrink: 0,
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  scoreDen: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  desc: {
    ...Typography.body2,
    lineHeight: 20,
  },
});
