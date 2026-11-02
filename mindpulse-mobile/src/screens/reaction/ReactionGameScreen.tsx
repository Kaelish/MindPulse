import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

type Phase = 'idle' | 'waiting' | 'go' | 'results';

export interface ReactionResult {
  average: number;
}

interface Props {
  onBack: () => void;
  onComplete?: (result: ReactionResult) => void;
}

/**
 * Reaction time bands. The result used to be hard-coded red, which read as a
 * warning even for a perfectly healthy score — colour now follows the number.
 */
type ReactionBand = {
  key: 'fast' | 'normal' | 'slow';
  label: string;
  accent: string;
  bg: string;
  pillBg: string;
  pillText: string;
  sub: string;
};

const bandFor = (ms: number): ReactionBand => {
  if (ms <= 250) {
    return {
      key: 'fast',
      label: 'Fast',
      accent: '#2E7D32',
      bg: '#E8F5E9',
      pillBg: '#CDE9D4',
      pillText: '#1F7A45',
      sub: 'Faster than average — sharp focus',
    };
  }
  if (ms <= 400) {
    return {
      key: 'normal',
      label: 'Normal',
      accent: '#2C7A7B',
      bg: '#E6F7F5',
      pillBg: '#C6ECE5',
      pillText: '#1F6E6E',
      sub: 'Normal reaction time',
    };
  }
  return {
    key: 'slow',
    label: 'Slow',
    accent: '#D32F2F',
    bg: '#FDECE6',
    pillBg: '#F8D5C8',
    pillText: '#B32D2D',
    sub: 'Slower than average — may suggest stress',
  };
};

export const ReactionGameScreen: React.FC<Props> = ({ onBack, onComplete }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [attempts, setAttempts] = useState<number[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const startRound = () => {
    setPhase('waiting');
    timer.current = setTimeout(() => {
      startedAt.current = performance.now();
      setPhase('go');
    }, 1500 + Math.random() * 2000);
  };

  const handleTap = () => {
    if (phase === 'waiting') {
      // tapped too early
      clearTimeout(timer.current!);
      setPhase('idle');
      return;
    }
    if (phase === 'go') {
      const time = Math.round(performance.now() - startedAt.current);
      const nextAttempts = [...attempts, time];
      setAttempts(nextAttempts);

      if (nextAttempts.length >= 3) {
        setPhase('results');
      } else {
        setRound(nextAttempts.length + 1);
        setPhase('idle');
      }
    }
  };

  const average = attempts.length > 0 ? Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length) : 0;
  const band = bandFor(average);

  return (
    <StressAnalysisLayout
      activeModule="reaction"
      heartRateDone
      onBack={onBack}
    >
      {phase !== 'results' ? (
        <>
          {round === 1 && phase === 'idle' && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoBody}>
                The screen will turn <Text style={{ color: tone('#E8A359'), fontWeight: 'bold' }}>yellow</Text> (wait)... then change to <Text style={{ color: tone('#5DB75D'), fontWeight: 'bold' }}>green</Text>. Tap as fast as you can when it turns green!
              </Text>
              <View style={styles.tipBox}>
                <Ionicons name="warning" size={16} color={tone('#B8860B')} />
                <Text style={styles.tipText}>
                  Because sometimes stress slows reaction time — higher reaction times may suggest fatigue, cognitive stress, or reduced attention.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.gameCard,
              phase === 'idle' && styles.gameIdle,
              phase === 'waiting' && styles.gameWaiting,
              phase === 'go' && styles.gameGo,
            ]}
            onPress={phase === 'idle' ? startRound : handleTap}
            activeOpacity={0.9}
          >
            {phase === 'idle' && (
              <>
                <Ionicons name="flash" size={64} color={tone('#FFF')} />
                <Text style={styles.gameTitle}>Round {round}/3</Text>
                <Text style={styles.gameSubtitle}>Tap to begin</Text>
              </>
            )}
            {phase === 'waiting' && (
              <>
                <Ionicons name="radio-button-on" size={64} color={tone('#FFF')} />
                <Text style={styles.gameTitle}>Wait for green...</Text>
                <Text style={styles.gameSubtitle}>(Tap if you see the green!)</Text>
              </>
            )}
            {phase === 'go' && (
              <>
                <Text style={styles.gameTitleLarge}>TAP NOW!</Text>
                <Text style={styles.gameSubtitle}>React as fast as possible</Text>
              </>
            )}
          </TouchableOpacity>

          {attempts.length > 0 && phase === 'idle' && (
            <View style={styles.attemptsCard}>
              <Text style={styles.attemptsTitle}>Reaction Times</Text>
              <View style={styles.attemptsRow}>
                {attempts.map((t, i) => {
                  const b = bandFor(t);
                  return (
                    <View key={i} style={[styles.attemptPill, { backgroundColor: toneBg(b.bg) }]}>
                      <Text style={styles.attemptLabel}>R{i + 1}</Text>
                      <Text style={[styles.attemptValue, { color: tone(b.accent) }]}>{t}ms</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.resultHero, { backgroundColor: toneBg(band.bg) }]}>
            <Text style={styles.resultLabel}>Average Reaction Time</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.resultValue, { color: tone(band.accent) }]}>{average}</Text>
              <Text style={[styles.resultUnit, { color: tone(band.accent) }]}>ms</Text>
            </View>
            <View style={[styles.resultPill, { backgroundColor: toneBg(band.pillBg) }]}>
              <Text style={[styles.resultPillText, { color: tone(band.pillText) }]}>{band.label}</Text>
            </View>
          </View>

          <View style={styles.attemptsCardResult}>
            <Text style={styles.attemptsTitle}>Reaction Times</Text>
            <View style={styles.attemptsRowResult}>
              {attempts.map((t, i) => {
                const b = bandFor(t);
                return (
                  <View key={i} style={[styles.attemptPill, { backgroundColor: toneBg(b.bg) }]}>
                    <Text style={styles.attemptLabel}>R{i + 1}</Text>
                    <Text style={[styles.attemptValue, { color: tone(b.accent) }]}>{t}ms</Text>
                  </View>
                );
              })}
            </View>

            <View style={[styles.summaryBox, { backgroundColor: toneBg(band.bg) }]}>
              <Ionicons name="flash" size={16} color={tone(band.accent)} />
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.summaryTitle, { color: tone(band.accent) }]}>Average: {average}ms</Text>
                <Text style={styles.summarySub}>{band.sub}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => onComplete?.({ average })}
          >
            <Text style={styles.nextBtnText}>Next: View Results</Text>
            <Ionicons name="chevron-forward" size={20} color={tone('#FFF')} />
          </TouchableOpacity>
        </>
      )}
    </StressAnalysisLayout>
  );
};

const makeStyles = () => StyleSheet.create({
  infoCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: toneBg('#EEE') },
  infoTitle: { fontSize: 18, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 12 },
  infoBody: { fontSize: 14, color: tone('#666'), lineHeight: 20, marginBottom: 16 },
  tipBox: { backgroundColor: toneBg('#FFF8E6'), borderRadius: 8, padding: 12, flexDirection: 'row' },
  tipText: { fontSize: 13, color: tone('#8C6200'), flex: 1, marginLeft: 8, lineHeight: 18, fontWeight: '500' },
  
  gameCard: { height: 280, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 20 },
  gameIdle: { backgroundColor: toneBg('#6B79F2') },
  gameWaiting: { backgroundColor: toneBg('#E09E6D') },
  gameGo: { backgroundColor: toneBg('#5DB75D') },
  gameTitle: { fontSize: 24, fontWeight: '800', color: tone('#FFF'), marginTop: 16, marginBottom: 8 },
  gameTitleLarge: { fontSize: 36, fontWeight: '900', color: tone('#FFF'), marginBottom: 12 },
  gameSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  attemptsCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: toneBg('#EEE') },
  attemptsCardResult: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: toneBg('#EEE') },
  attemptsTitle: { fontSize: 16, fontWeight: '600', color: tone('#666'), marginBottom: 16 },
  attemptsRow: { flexDirection: 'row', gap: 12 },
  attemptsRowResult: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  attemptPill: { flex: 1, backgroundColor: toneBg('#F1F5F9'), borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  attemptLabel: { fontSize: 12, color: tone('#888'), fontWeight: '700', marginBottom: 4 },
  attemptValue: { fontSize: 16, color: tone('#2C7A7B'), fontWeight: '800' },

  resultHero: { backgroundColor: toneBg('#E6F7F5'), borderRadius: 20, padding: 30, alignItems: 'center', justifyContent: 'center' },
  resultLabel: { fontSize: 16, fontWeight: '600', color: tone('#777'), marginBottom: 16 },
  resultValue: { fontSize: 64, fontWeight: '900', color: tone('#2C7A7B') },
  resultUnit: { fontSize: 28, fontWeight: '800', color: tone('#2C7A7B'), marginLeft: 4 },
  resultPill: { backgroundColor: toneBg('#C6ECE5'), paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
  resultPillText: { color: tone('#1F6E6E'), fontWeight: '700', fontSize: 14 },

  summaryBox: { backgroundColor: toneBg('#E6F7F5'), borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: tone('#2C7A7B'), marginBottom: 2 },
  summarySub: { fontSize: 11, color: tone('#999') },

  nextBtn: { backgroundColor: toneBg('#6B79F2'), borderRadius: 28, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  nextBtnText: { color: tone('#FFF'), fontSize: 16, fontWeight: '700', marginRight: 8 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
