/**
 * The "Take a 5-minute no-screen pause" tool.
 *
 * Deliberately unlike the other three players:
 *
 *  - WALL-CLOCK, NOT AN ACCUMULATING CLOCK. `GuidedExerciseModal` does
 *    `elapsedRef.current += TICK_MS`, which is correct there because an
 *    exercise is a few minutes of a user watching the screen. A pause is the
 *    opposite: the OS will sleep the screen and suspend JS partway through,
 *    and adding 50ms per tick would stall the countdown so it never reaches
 *    zero. All timing maths lives in `pauseTimer.ts` and derives from
 *    `Date.now()`, which makes it testable without a renderer and makes
 *    suspension self-healing. The transition tests live with the rest of the
 *    suite.
 *
 *  - NOTHING TO READ. The exercise player shows step labels, pips, three
 *    stats and a percentage. This one shows a countdown, one sentence and a
 *    bar, because the tip is to stop looking at things. No stats row, on
 *    purpose.
 *
 *  - NO SOUND, NO HAPTICS, NO NEW DEPS. Completion is visual, exactly like
 *    `GuidedExerciseModal`. A buzz would need `android.permission.VIBRATE`
 *    (not declared in this project's app.json) and a chime would need a new
 *    licensed audio asset. Neither is worth a runtime failure at the one
 *    moment the user is waiting for.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import {
  PAUSE_SECONDS,
  PauseClock,
  pauseClockIdle,
  pauseIsDone,
  pauseMinutes,
  pauseRemainSec,
  pauseResume,
  pauseStart,
  pauseStop,
} from '../services/pauseTimer';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'idle' | 'running' | 'paused' | 'done';

const ACCENT = '#455A64';
const TICK_MS = 250;

const mmss = (totalSecondsLeft: number) => {
  const m = Math.floor(totalSecondsLeft / 60);
  const s = Math.max(0, totalSecondsLeft % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const KICKER: Record<Phase, string> = {
  idle: 'READY',
  running: 'PAUSE IN PROGRESS',
  paused: 'PAUSED',
  done: 'COMPLETE',
};

const BODY: Record<Phase, string> = {
  idle: `${pauseMinutes} minutes away from every screen. Put your phone down and look at something about twenty feet away — the countdown keeps correct time even if the screen sleeps.`,
  running: 'Nothing to read here. Set the phone face down and let your eyes rest.',
  paused: `Paused. Resume when you are ready to finish the full ${pauseMinutes} minutes.`,
  done: 'Minutes off every screen. Notice how your eyes and shoulders feel before you move on.',
};

export const PauseTimerModal: React.FC<Props> = ({ visible, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [remainSec, setRemainSec] = useState(PAUSE_SECONDS);

  // The clock lives in a ref, not state: a tick must read it without waiting
  // for a re-render. All maths is in `pauseTimer.ts` so it can be tested
  // without a renderer — see the suspension tests in the suite.
  const clockRef = useRef<PauseClock>(pauseClockIdle());
  const lastSecRef = useRef(PAUSE_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const finish = () => {
    stopTicker();
    clockRef.current = pauseStop(clockRef.current, Date.now());
    lastSecRef.current = 0;
    setRemainSec(0);
    setPhase('done');
  };

  const tick = () => {
    const now = Date.now();
    const sec = pauseRemainSec(clockRef.current, now);
    // Display state only moves when the visible second changes.
    if (sec !== lastSecRef.current) {
      lastSecRef.current = sec;
      setRemainSec(sec);
    }
    if (pauseIsDone(clockRef.current, now)) finish();
  };

  const startTicker = () => {
    stopTicker();
    timerRef.current = setInterval(tick, TICK_MS);
  };

  const reset = () => {
    stopTicker();
    clockRef.current = pauseClockIdle();
    lastSecRef.current = PAUSE_SECONDS;
    setRemainSec(PAUSE_SECONDS);
    setPhase('idle');
  };

  const start = () => {
    clockRef.current = pauseStart(clockRef.current, Date.now());
    lastSecRef.current = PAUSE_SECONDS;
    setRemainSec(PAUSE_SECONDS);
    setPhase('running');
    startTicker();
    tick();
  };

  const pause = () => {
    clockRef.current = pauseStop(clockRef.current, Date.now());
    stopTicker();
    setPhase('paused');
    tick();
  };

  const resume = () => {
    clockRef.current = pauseResume(clockRef.current, Date.now());
    setPhase('running');
    startTicker();
    tick();
  };

  // The ticker must never outlive the sheet.
  useEffect(() => stopTicker, []);
  useEffect(() => {
    if (!visible) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A stray backdrop tap mid-pause would throw the session away. Same rule as
  // GuidedExerciseModal: while running, leaving is an explicit choice.
  const requestClose = () => {
    if (clockRef.current.running) return;
    onClose();
  };

  const endEarly = () => {
    reset();
    onClose();
  };

  const accent = tone(ACCENT);
  const done = phase === 'done';
  const progress = ((PAUSE_SECONDS - remainSec) / PAUSE_SECONDS) * 100;

  const primary =
    phase === 'running'
      ? { icon: 'pause', text: 'Pause', onPress: pause }
      : phase === 'paused'
        ? { icon: 'play', text: 'Resume', onPress: resume }
        : done
          ? { icon: 'refresh', text: 'Do it again', onPress: reset }
          : { icon: 'play', text: `Start · ${pauseMinutes} min`, onPress: start };

  const secondaryLabel = done ? 'Done' : phase === 'idle' ? 'Close' : 'End early';
  const secondaryPress = done || phase === 'idle' ? onClose : endEarly;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel="Close pause timer"
        />
        <View style={styles.card}>
          <View style={[styles.head, { backgroundColor: accent }]}>
            <View style={styles.headIcon}>
              <Ionicons name="eye-off-outline" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>No-screen pause</Text>
              <Text style={styles.headSub}>
                {pauseMinutes} minutes away from every screen
              </Text>
            </View>
            <Pressable
              onPress={requestClose}
              style={styles.closeBtn}
              accessibilityLabel="Close pause timer"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.stage}>
            <Text style={styles.stageKicker}>{KICKER[phase]}</Text>
            <Text style={[styles.stageCount, done && { color: accent }]}>
              {done ? '✓' : mmss(remainSec)}
            </Text>
            <Text style={styles.stageText}>{BODY[phase]}</Text>
          </View>

          <View style={styles.track}>
            <View
              style={[styles.trackFill, { width: `${progress}%`, backgroundColor: accent }]}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, phase === 'running' && { backgroundColor: tone('#E08A00') }]}
              onPress={primary.onPress}
              activeOpacity={0.85}
            >
              <Ionicons name={primary.icon as any} size={17} color="#FFFFFF" />
              <Text style={styles.primaryText}>{primary.text}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={secondaryPress}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </TouchableOpacity>
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
    stage: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 },
    stageKicker: {
      fontSize: 10.5,
      fontWeight: '900',
      letterSpacing: 1.1,
      color: Colors.textHint,
    },
    stageCount: {
      fontSize: 58,
      fontWeight: '900',
      color: Colors.textPrimary,
      marginTop: 10,
      lineHeight: 66,
      fontVariant: ['tabular-nums'],
    },
    stageText: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 19,
      minHeight: 57,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: toneBg('#EDEFF7'),
      marginHorizontal: 16,
      marginTop: 12,
      overflow: 'hidden',
    },
    trackFill: { height: '100%', borderRadius: 3 },
    actions: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.full,
      backgroundColor: tone(ACCENT),
    },
    primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    secondaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: toneBg('#E2E4EC'),
    },
    secondaryText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
