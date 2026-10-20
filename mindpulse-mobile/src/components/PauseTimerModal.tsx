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
 *  - THE SCREEN GOES BLACK. (Adviser feedback: the tip should be enforced by
 *    the screen, not just written on it.) The ready card counts 3-2-1, then
 *    the whole sheet turns black for the remaining minutes with only an
 *    ultra-dim countdown in the middle — nothing worth looking at, and no
 *    readable copy while running at all. Tapping anywhere reveals the
 *    controls (auto-hiding again after REVEAL_IDLE_MS of no touch, or on a
 *    second tap); the Android back button reveals them too instead of
 *    closing, so a running pause can still only be left deliberately. At
 *    zero the sheet brightens back to the ✓ COMPLETE card, so glancing back
 *    gives a clear answer.
 *
 *  - NOTHING TO READ while running. The exercise player shows step labels,
 *    pips, three stats and a percentage; this one shows a bare countdown,
 *    because the tip is to stop looking at things. No stats row, on purpose.
 *
 *  - NO SOUND, NO HAPTICS, NO NEW DEPS. Completion is visual, exactly like
 *    `GuidedExerciseModal`. A buzz would need `android.permission.VIBRATE`
 *    (not declared in this project's app.json) and a chime would need a new
 *    licensed audio asset. Neither is worth a runtime failure at the one
 *    moment the user is waiting for.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

/** `leadin` = the 3-2-1 "put your phone down" card shown before the screen blacks out. */
type Phase = 'idle' | 'leadin' | 'running' | 'paused' | 'done';

const ACCENT = '#455A64';
const TICK_MS = 250;
/** Seconds of lead-in before the screen turns black. */
const LEAD_IN_SECONDS = 3;
/** Revealed controls re-hide after this long without a touch. */
const REVEAL_IDLE_MS = 4000;
/** Pure black — the point of the feature is that there is nothing to read. */
const BLACK = '#000000';

const mmss = (totalSecondsLeft: number) => {
  const m = Math.floor(totalSecondsLeft / 60);
  const s = Math.max(0, totalSecondsLeft % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const KICKER: Record<Phase, string> = {
  idle: 'READY',
  leadin: 'GET READY',
  running: 'PAUSE IN PROGRESS',
  paused: 'PAUSED',
  done: 'COMPLETE',
};

const BODY: Record<Phase, string> = {
  idle: `${pauseMinutes} minutes away from every screen. Put your phone down and look at something about twenty feet away — the countdown keeps correct time even if the screen sleeps.`,
  leadin: `The screen turns black in a moment. Set the phone down now and keep your eyes off it for all ${pauseMinutes} minutes.`,
  running: 'Nothing to read here. Set the phone face down and let your eyes rest.',
  paused: `Paused. Resume when you are ready to finish the full ${pauseMinutes} minutes.`,
  done: 'Minutes off every screen. Notice how your eyes and shoulders feel before you move on.',
};

export const PauseTimerModal: React.FC<Props> = ({ visible, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [remainSec, setRemainSec] = useState(PAUSE_SECONDS);
  /** Lead-in counter (3 → 1) shown big on the ready card. */
  const [leadInSec, setLeadInSec] = useState(LEAD_IN_SECONDS);
  /** True while the sheet must be black: only the running phase, never paused/done. */
  const [dark, setDark] = useState(false);
  /** True while the controls are temporarily shown on top of the black screen. */
  const [revealed, setRevealed] = useState(false);

  // The clock lives in a ref, not state: a tick must read it without waiting
  // for a re-render. All maths is in `pauseTimer.ts` so it can be tested
  // without a renderer — see the suspension tests in the suite.
  const clockRef = useRef<PauseClock>(pauseClockIdle());
  const lastSecRef = useRef(PAUSE_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTicker = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearRevealTimer = () => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  /** Show the controls on top of the black screen, then re-black automatically. */
  const reveal = () => {
    setRevealed(true);
    clearRevealTimer();
    revealTimerRef.current = setTimeout(() => setRevealed(false), REVEAL_IDLE_MS);
  };

  const hideReveal = () => {
    clearRevealTimer();
    setRevealed(false);
  };

  /** Push the auto-hide deadline out — called whenever the user touches the card. */
  const pokeReveal = () => {
    if (revealTimerRef.current) reveal();
  };

  const finish = () => {
    stopTicker();
    hideReveal();
    clockRef.current = pauseStop(clockRef.current, Date.now());
    lastSecRef.current = 0;
    setRemainSec(0);
    setDark(false);
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
    hideReveal();
    clockRef.current = pauseClockIdle();
    lastSecRef.current = PAUSE_SECONDS;
    setRemainSec(PAUSE_SECONDS);
    setLeadInSec(LEAD_IN_SECONDS);
    setDark(false);
    setPhase('idle');
  };

  /** Enter the lead-in: the ready card counts down, then the screen blacks out. */
  const start = () => {
    setLeadInSec(LEAD_IN_SECONDS);
    setPhase('leadin');
  };

  /** The wall clock starts here — at the end of the lead-in, never during it. */
  const beginRun = () => {
    clockRef.current = pauseStart(clockRef.current, Date.now());
    lastSecRef.current = PAUSE_SECONDS;
    setRemainSec(PAUSE_SECONDS);
    setPhase('running');
    setDark(true);
    hideReveal();
    startTicker();
    tick();
  };

  const pause = () => {
    clockRef.current = pauseStop(clockRef.current, Date.now());
    stopTicker();
    hideReveal();
    setDark(false);
    setPhase('paused');
    tick();
  };

  const resume = () => {
    clockRef.current = pauseResume(clockRef.current, Date.now());
    setPhase('running');
    // Straight back to black: they have already read the button, and the
    // whole point is not to keep staring at the countdown.
    setDark(true);
    hideReveal();
    startTicker();
    tick();
  };

  // 3-2-1, then black. An effect (not a nested setState) so the lead-in
  // cannot outlive a reset or a close mid-count.
  useEffect(() => {
    if (phase !== 'leadin') return;
    if (leadInSec <= 0) {
      beginRun();
      return;
    }
    const timer = setTimeout(() => setLeadInSec((value) => value - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, leadInSec]);

  // The ticker and the reveal timer must never outlive the sheet.
  useEffect(() => {
    return () => {
      stopTicker();
      clearRevealTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // Black screen: one tap brings the controls up, the next tap (or 4s of
  // nothing) puts them away again. Never closes from here.
  const onDarkTap = () => {
    if (revealed) hideReveal();
    else reveal();
  };

  const onBackdropPress = () => {
    if (dark) onDarkTap();
    else requestClose();
  };

  // Android back / Escape: while black, reveal the controls instead of
  // dismissing, so "leaving" stays an explicit choice through End early.
  const onHardwareClose = () => {
    if (dark) onDarkTap();
    else requestClose();
  };

  const accent = tone(ACCENT);
  const done = phase === 'done';
  const progress = ((PAUSE_SECONDS - remainSec) / PAUSE_SECONDS) * 100;

  const primary =
    phase === 'running'
      ? { icon: 'pause', text: 'Pause', onPress: pause }
      : phase === 'paused'
        ? { icon: 'play', text: 'Resume', onPress: resume }
        : phase === 'leadin'
          ? { icon: 'play', text: 'Start now', onPress: beginRun }
          : done
            ? { icon: 'refresh', text: 'Do it again', onPress: reset }
            : { icon: 'play', text: `Start · ${pauseMinutes} min`, onPress: start };

  const secondaryLabel = done ? 'Done' : phase === 'idle' ? 'Close' : 'End early';
  const secondaryPress = done || phase === 'idle' ? onClose : endEarly;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onHardwareClose}>
      <View style={[styles.backdrop, dark && styles.backdropDark]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onBackdropPress}
          accessibilityLabel={
            dark ? (revealed ? 'Hide pause controls' : 'Show pause controls') : 'Close pause timer'
          }
        />
        <View style={styles.card} onTouchStart={dark ? pokeReveal : undefined}>
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
              onPress={onBackdropPress}
              style={styles.closeBtn}
              accessibilityLabel={dark ? 'Return to the black screen' : 'Close pause timer'}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.stage}>
            <Text style={styles.stageKicker}>{KICKER[phase]}</Text>
            <Text style={[styles.stageCount, done && { color: accent }]}>
              {done ? '✓' : phase === 'leadin' ? Math.max(1, leadInSec) : mmss(remainSec)}
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

        {/* The black screen itself. Rendered after the card so it covers it,
            and it is a Pressable rather than pointerEvents="none": it must
            SWALLOW every tap, otherwise a blind finger would fall through to
            the invisible End early / Pause buttons underneath. */}
        {dark && !revealed && (
          <Pressable
            style={styles.blackStage}
            onPress={reveal}
            accessibilityLabel={`No-screen pause running, ${mmss(remainSec)} remaining. Tap to show the controls.`}
          >
            <Text style={styles.blackCount}>{mmss(remainSec)}</Text>
          </Pressable>
        )}
      </View>

      {/* Hide the system status bar while black — otherwise its clock and
          battery sit on a coloured strip above the darkened sheet. RN keeps
          these values on a stack, so unmounting restores the app's own. */}
      {dark && <StatusBar hidden backgroundColor={BLACK} barStyle="light-content" />}
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
    /** During the pause the dim backdrop becomes pure black — no ambient glow. */
    backdropDark: {
      backgroundColor: BLACK,
    },
    /** Full-bleed black plate drawn over the card while the pause runs. */
    blackStage: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: BLACK,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** Ultra-dim on purpose: readable if you deliberately look, not inviting. */
    blackCount: {
      color: 'rgba(255, 255, 255, 0.09)',
      fontSize: 62,
      fontWeight: '900',
      lineHeight: 70,
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
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
