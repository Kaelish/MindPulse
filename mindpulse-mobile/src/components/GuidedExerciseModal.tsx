/**
 * Generic step player for the guided exercises in `guidedExercises.ts`.
 *
 * Same clock approach as BoxBreathingModal: the interval only accumulates
 * elapsed milliseconds, and every displayed value is *derived* from that clock,
 * so a pause is "stop the ticker" and the step label, countdown and progress bar
 * can never disagree. Display strings only push state when their key changes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import { exerciseById, ExerciseStep, GuidedExercise, totalSeconds } from '../services/guidedExercises';

const TICK_MS = 50;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Exercise ids to offer — normally the current band's exercise tips. */
  exerciseIds: string[];
  /** Open on this one when it exists; otherwise the first in `exerciseIds`. */
  initialId?: string;
}

interface Clock {
  starts: number[];
  totalMs: number;
}

const clockOf = (steps: ExerciseStep[]): Clock => {
  const starts: number[] = [];
  let acc = 0;
  for (const s of steps) {
    starts.push(acc);
    acc += s.seconds * 1000;
  }
  return { starts, totalMs: acc };
};

interface StepView {
  step: number;
  remain: number;
  overall: number;
}

const deriveAt = (steps: ExerciseStep[], clock: Clock, t: number): StepView => {
  if (steps.length === 0) return { step: 0, remain: 0, overall: 0 };
  let step = steps.length - 1;
  for (let i = 0; i < steps.length; i += 1) {
    if (t < clock.starts[i] + steps[i].seconds * 1000) {
      step = i;
      break;
    }
  }
  const into = t - clock.starts[step];
  const remain = Math.max(1, Math.ceil((steps[step].seconds * 1000 - into) / 1000));
  const overall = clock.totalMs > 0 ? Math.min(100, (t / clock.totalMs) * 100) : 100;
  return { step, remain, overall };
};

const mmss = (totalSecondsLeft: number) => {
  const m = Math.floor(totalSecondsLeft / 60);
  const s = Math.max(0, totalSecondsLeft % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const initialIndexOf = (list: GuidedExercise[], initialId?: string): number => {
  if (!initialId) return 0;
  const i = list.findIndex((e) => e.id === initialId);
  return i >= 0 ? i : 0;
};

export const GuidedExerciseModal: React.FC<Props> = ({
  visible,
  onClose,
  exerciseIds,
  initialId,
}) => {
  const list = useMemo(
    () => exerciseIds.map((id) => exerciseById(id)).filter((e): e is GuidedExercise => !!e),
    [exerciseIds],
  );

  const [idx, setIdx] = useState(() => initialIndexOf(list, initialId));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [view, setView] = useState<StepView>({ step: 0, remain: 0, overall: 0 });

  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastKeyRef = useRef('');

  const exercise = list[idx] ?? list[0];
  const steps = exercise?.steps ?? [];
  const clock = useMemo(() => clockOf(steps), [steps]);

  const stopTicker = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTo = (nextIdx: number) => {
    stopTicker();
    setRunning(false);
    setDone(false);
    elapsedRef.current = 0;
    lastKeyRef.current = '';
    setIdx(nextIdx);
    const nextSteps = list[nextIdx]?.steps ?? [];
    setView({ step: 0, remain: nextSteps.length ? nextSteps[0].seconds : 0, overall: 0 });
  };

  const push = (activeSteps: ExerciseStep[], activeClock: Clock, t: number) => {
    const d = deriveAt(activeSteps, activeClock, t);
    const key = `${d.step}|${d.remain}|${Math.round(d.overall)}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setView(d);
  };

  const start = () => {
    if (done || steps.length === 0) return;
    stopTicker();
    setRunning(true);
    // Capture the active exercise so a later switch can never tick stale steps.
    const activeSteps = steps;
    const activeClock = clock;
    timerRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= activeClock.totalMs) {
        elapsedRef.current = activeClock.totalMs;
        stopTicker();
        setRunning(false);
        setDone(true);
        lastKeyRef.current = '';
        setView({ step: Math.max(0, activeSteps.length - 1), remain: 1, overall: 100 });
        return;
      }
      push(activeSteps, activeClock, elapsedRef.current);
    }, TICK_MS);
  };

  const pause = () => {
    stopTicker();
    setRunning(false);
  };

  const skip = () => {
    if (done || steps.length === 0) return;
    // Read the clock rather than `view`, so two fast taps can't land on the
    // same step while React is still batching the previous setState.
    const current = deriveAt(steps, clock, elapsedRef.current).step;
    if (current >= steps.length - 1) {
      // Already on the last step: "Next" means finish.
      stopTicker();
      setRunning(false);
      setDone(true);
      elapsedRef.current = clock.totalMs;
      lastKeyRef.current = '';
      setView({ step: steps.length - 1, remain: 1, overall: 100 });
      return;
    }
    elapsedRef.current = clock.starts[current + 1];
    lastKeyRef.current = '';
    push(steps, clock, elapsedRef.current);
  };

  // The ticker must never outlive the screen or the modal.
  useEffect(() => stopTicker, []);
  useEffect(() => {
    resetTo(visible ? initialIndexOf(list, initialId) : 0);
    // Only re-arm when the sheet opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A stray backdrop tap mid-exercise would throw the progress away.
  const requestClose = () => {
    if (running) return;
    onClose();
  };

  if (!exercise) return null;

  const step = steps[Math.min(view.step, Math.max(0, steps.length - 1))];
  const accent = tone(exercise.color);
  const totalMin = Math.max(1, Math.round(totalSeconds(exercise) / 60));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel="Close guided exercise"
        />
        <View style={styles.card}>
          <View style={[styles.head, { backgroundColor: accent }]}>
            <View style={styles.headIcon}>
              <Ionicons name={exercise.icon as any} size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>{exercise.title}</Text>
              <Text style={styles.headSub}>{exercise.subtitle}</Text>
            </View>
            <Pressable
              onPress={requestClose}
              style={styles.closeBtn}
              accessibilityLabel="Close guided exercise"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {list.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {list.map((ex, i) => {
                const on = i === idx;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }]}
                    onPress={() => resetTo(i)}
                    activeOpacity={0.8}
                    disabled={running}
                  >
                    <Ionicons
                      name={ex.icon as any}
                      size={13}
                      color={on ? '#FFFFFF' : tone(Colors.textSecondary)}
                    />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{ex.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.stage}>
            <Text style={styles.stageKicker}>
              {done ? 'COMPLETE' : `STEP ${view.step + 1} OF ${steps.length}`}
            </Text>
            <Text style={[styles.stageLabel, { color: accent }]}>
              {done ? 'Well done' : step?.label ?? ''}
            </Text>
            <Text style={styles.stageCount}>{done ? '✓' : `${view.remain}`}</Text>
            <Text style={styles.stageText}>
              {done ? `You finished ${exercise.title.toLowerCase()}.` : step?.text ?? ''}
            </Text>
          </View>

          <View style={styles.pips}>
            {steps.map((s, i) => (
              <View
                key={`${s.label}-${i}`}
                style={[
                  styles.pip,
                  { backgroundColor: toneBg('#E0E0E0') },
                  (!done && i === view.step && { backgroundColor: accent }),
                  (done && { backgroundColor: accent }),
                ]}
              />
            ))}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{steps.length}</Text>
              <Text style={styles.statLabel}>steps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>~{totalMin} min</Text>
              <Text style={styles.statLabel}>total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{Math.round(view.overall)}%</Text>
              <Text style={styles.statLabel}>done</Text>
            </View>
          </View>

          <View style={styles.track}>
            <View
              style={[styles.trackFill, { width: `${view.overall}%`, backgroundColor: accent }]}
            />
          </View>

          <View style={styles.actions}>
            {!done ? (
              <TouchableOpacity
                style={[styles.primaryBtn, running && { backgroundColor: tone('#E08A00') }]}
                onPress={running ? pause : start}
                activeOpacity={0.85}
              >
                <Ionicons name={running ? 'pause' : 'play'} size={17} color="#FFFFFF" />
                <Text style={styles.primaryText}>
                  {running
                    ? 'Pause'
                    : elapsedRef.current > 0
                      ? 'Resume'
                      : `Start · ${totalMin} min`}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: accent }]}
                onPress={() => resetTo(idx)}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={17} color="#FFFFFF" />
                <Text style={styles.primaryText}>Do it again</Text>
              </TouchableOpacity>
            )}

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, (done || steps.length < 2) && styles.btnOff]}
                onPress={skip}
                disabled={done || steps.length < 2}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryText}>Next step</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => resetTo(idx)} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={15} color={tone('#666')} />
                <Text style={styles.secondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.secondaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: Colors.surface,
      borderRadius: 24,
      paddingBottom: 16,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
    headSub: { fontSize: 11, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chips: {
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: toneBg('#E2E4EC'),
      backgroundColor: toneBg('#F7F8FC'),
    },
    chipText: { fontSize: 12, fontWeight: '700', color: tone(Colors.textSecondary) },
    chipTextOn: { color: '#FFFFFF' },
    stage: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 4 },
    stageKicker: {
      fontSize: 10.5,
      fontWeight: '900',
      letterSpacing: 1.1,
      color: Colors.textHint,
    },
    stageLabel: { fontSize: 21, fontWeight: '900', marginTop: 8, textAlign: 'center' },
    stageCount: {
      fontSize: 46,
      fontWeight: '900',
      color: Colors.textPrimary,
      marginTop: 2,
      lineHeight: 54,
    },
    stageText: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 19,
    },
    pips: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
      marginTop: 12,
      paddingHorizontal: 20,
      flexWrap: 'wrap',
    },
    pip: { width: 14, height: 5, borderRadius: 3 },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      marginTop: 14,
      marginHorizontal: 16,
      paddingVertical: 10,
      borderRadius: Radius.lg,
      backgroundColor: toneBg('#F7F8FC'),
    },
    stat: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 15, fontWeight: '900', color: Colors.textPrimary },
    statLabel: { fontSize: 10.5, color: Colors.textHint, marginTop: 2 },
    statDivider: { width: 1, height: 24, backgroundColor: toneBg('#E6E8F0') },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: toneBg('#EDEFF7'),
      marginHorizontal: 16,
      marginTop: 12,
      overflow: 'hidden',
    },
    trackFill: { height: '100%', borderRadius: 3 },
    actions: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.full,
      backgroundColor: tone('#6B79F2'),
    },
    primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    secondaryRow: { flexDirection: 'row', gap: 8 },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: toneBg('#E2E4EC'),
    },
    btnOff: { opacity: 0.4 },
    secondaryText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
