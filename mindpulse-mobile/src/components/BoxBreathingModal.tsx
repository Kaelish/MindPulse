/**
 * Guided box breathing — 4s in, 4s hold, 4s out, 4s hold, for 5 minutes.
 *
 * The circle's scale is driven straight off the elapsed clock with an
 * `Animated.Value`, so the animation and the phase labels can never drift apart
 * and a pause is just "stop the ticker". Display strings only re-render when
 * their value actually changes (at most once a second).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import { useTranslation } from '../i18n/language';

const TICK_MS = 50;
const PHASE_MS = 4000;
const SESSION_SECONDS = 5 * 60;
const SESSION_MS = SESSION_SECONDS * 1000;
const CYCLE_MS = PHASE_MS * 4;
const MIN_SCALE = 0.6;
const TOTAL_CYCLES = Math.floor(SESSION_MS / CYCLE_MS);

/** Circle scale only — the labels/hints are localized per render (`views.breathe`). */
const PHASES = [
  { from: MIN_SCALE, to: 1 },
  { from: 1, to: 1 },
  { from: 1, to: MIN_SCALE },
  { from: MIN_SCALE, to: MIN_SCALE },
];

const smoothstep = (p: number) => p * p * (3 - 2 * p);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const mmss = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.max(0, totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const BoxBreathingModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const copy = t.results.tools;
  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastKeyRef = useRef('');

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [ui, setUi] = useState({ phase: 0, phaseLeft: 4, cycle: 1, remainSec: SESSION_SECONDS });

  const stopTicker = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    stopTicker();
    setRunning(false);
    setDone(false);
    elapsedRef.current = 0;
    lastKeyRef.current = '';
    scale.setValue(MIN_SCALE);
    setUi({ phase: 0, phaseLeft: 4, cycle: 1, remainSec: SESSION_SECONDS });
  };

  /** Push the clock-derived circle scale + display strings, only when they change. */
  const pushUi = (t: number) => {
    const cycleT = t % CYCLE_MS;
    const phase = Math.min(PHASES.length - 1, Math.floor(cycleT / PHASE_MS));
    const phaseT = cycleT - phase * PHASE_MS;
    const ph = PHASES[phase];
    scale.setValue(lerp(ph.from, ph.to, smoothstep(phaseT / PHASE_MS)));

    const phaseLeft = Math.max(1, Math.ceil((PHASE_MS - phaseT) / 1000));
    const cycle = Math.floor(t / CYCLE_MS) + 1;
    const remainSec = Math.max(0, Math.ceil((SESSION_MS - t) / 1000));
    const key = `${phase}|${phaseLeft}|${cycle}|${remainSec}`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      setUi({ phase, phaseLeft, cycle, remainSec });
    }
  };

  const start = () => {
    if (done) return;
    setRunning(true);
    stopTicker();
    timerRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS;
      if (elapsedRef.current >= SESSION_MS) {
        elapsedRef.current = SESSION_MS;
        stopTicker();
        setRunning(false);
        setDone(true);
        lastKeyRef.current = '';
        scale.setValue(MIN_SCALE);
        setUi({ phase: 0, phaseLeft: 4, cycle: TOTAL_CYCLES, remainSec: 0 });
        return;
      }
      pushUi(elapsedRef.current);
    }, TICK_MS);
  };

  const pause = () => {
    stopTicker();
    setRunning(false);
  };

  // The ticker must never outlive the screen or the modal.
  useEffect(() => stopTicker, []);
  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  // A stray backdrop tap mid-session would throw the progress away.
  const requestClose = () => {
    if (running) return;
    onClose();
  };

  const progress = ((SESSION_SECONDS - ui.remainSec) / SESSION_SECONDS) * 100;
  const breathe = copy.views.breathe;
  const phaseCopy = [breathe.phaseIn, breathe.phaseHold1, breathe.phaseOut, breathe.phaseHold2];
  const phase = phaseCopy[ui.phase];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel={copy.player.closeBreath}
        />
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="leaf-outline" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>{copy.breathe.label}</Text>
              <Text style={styles.headSub}>{breathe.headSub}</Text>
            </View>
            <Pressable
              onPress={requestClose}
              style={styles.closeBtn}
              accessibilityLabel={copy.player.closeBreath}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.stage}>
            <View style={styles.ring}>
              <Animated.View style={[styles.blob, { transform: [{ scale }] }]} />
              <View style={styles.blobContent}>
                <Text style={styles.phaseLabel}>
                  {done ? copy.player.wellDone : phase.label}
                </Text>
                <Text style={styles.phaseCount}>
                  {done ? breathe.doneCount : `${ui.phaseLeft}`}
                </Text>
              </View>
            </View>
            <Text style={styles.hint}>{done ? breathe.doneBody : phase.hint}</Text>
          </View>

          <View style={styles.pips}>
            {PHASES.map((_p, i) => (
              <View
                key={`phase-${i}`}
                style={[styles.pip, !done && i === ui.phase && styles.pipActive]}
              />
            ))}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{ui.cycle}</Text>
              <Text style={styles.statLabel}>{breathe.statCycle}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{mmss(ui.remainSec)}</Text>
              <Text style={styles.statLabel}>{breathe.statLeft}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>4s</Text>
              <Text style={styles.statLabel}>{breathe.statPerPhase}</Text>
            </View>
          </View>

          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.actions}>
            {!done ? (
              <TouchableOpacity
                style={[styles.primaryBtn, running && styles.primaryBtnRunning]}
                onPress={running ? pause : start}
                activeOpacity={0.85}
              >
                <Ionicons name={running ? 'pause' : 'play'} size={17} color="#FFFFFF" />
                <Text style={styles.primaryText}>
                  {running
                    ? copy.player.pause
                    : elapsedRef.current > 0
                      ? copy.player.resume
                      : breathe.startBtn}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.85}>
                <Ionicons name="refresh" size={17} color="#FFFFFF" />
                <Text style={styles.primaryText}>{copy.player.again}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.secondaryRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={reset} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={15} color={tone('#666')} />
                <Text style={styles.secondaryText}>{copy.player.reset}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.secondaryText}>{copy.player.done}</Text>
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
      backgroundColor: toneBg('#6B79F2'),
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
    stage: { alignItems: 'center', paddingTop: 18, paddingBottom: 6 },
    ring: {
      width: 236,
      height: 236,
      borderRadius: 118,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: toneBg('#EEF1FF'),
      borderWidth: 1,
      borderColor: toneBg('#DCE2FF'),
      overflow: 'hidden',
    },
    blob: {
      position: 'absolute',
      top: 18,
      left: 18,
      right: 18,
      bottom: 18,
      borderRadius: 100,
      backgroundColor: toneBg('#6B79F2'),
      opacity: 0.92,
    },
    blobContent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phaseLabel: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
    phaseCount: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
    hint: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 14, textAlign: 'center' },
    pips: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 },
    pip: { width: 22, height: 5, borderRadius: 3, backgroundColor: toneBg('#E0E0E0') },
    pipActive: { backgroundColor: tone('#6B79F2') },
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
    trackFill: { height: '100%', borderRadius: 3, backgroundColor: tone('#6B79F2') },
    actions: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.full,
      backgroundColor: toneBg('#6B79F2'),
    },
    primaryBtnRunning: { backgroundColor: toneBg('#E08A00') },
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
    secondaryText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
