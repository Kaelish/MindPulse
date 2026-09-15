import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';

type Phase = 'idle' | 'waiting' | 'go' | 'results';

export interface ReactionResult {
  average: number;
}

interface Props {
  onBack: () => void;
  onComplete?: (result: ReactionResult) => void;
}

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
  const isSlow = average > 400; // Arbitrary threshold

  return (
    <StressAnalysisLayout
      activeModule="reaction"
      activeSection={phase === 'results' ? 'results' : 'reaction'}
      heartRateDone
      onBack={onBack}
    >
      {phase !== 'results' ? (
        <>
          {round === 1 && phase === 'idle' && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoBody}>
                The screen will turn <Text style={{ color: '#E8A359', fontWeight: 'bold' }}>yellow</Text> (wait)... then change to <Text style={{ color: '#5DB75D', fontWeight: 'bold' }}>green</Text>. Tap as fast as you can when it turns green!
              </Text>
              <View style={styles.tipBox}>
                <Ionicons name="warning" size={16} color="#B8860B" />
                <Text style={styles.tipText}>
                  Because sometimes stress slows reaction time — higher reaction time can indicate fatigue, cognitive stress, or reduced attention.
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
                <Ionicons name="flash" size={64} color="#FFF" />
                <Text style={styles.gameTitle}>Round {round}/3</Text>
                <Text style={styles.gameSubtitle}>Tap to begin</Text>
              </>
            )}
            {phase === 'waiting' && (
              <>
                <Ionicons name="radio-button-on" size={64} color="#FFF" />
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
                {attempts.map((t, i) => (
                  <View key={i} style={styles.attemptPill}>
                    <Text style={styles.attemptLabel}>R{i + 1}</Text>
                    <Text style={styles.attemptValue}>{t}ms</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={styles.resultHero}>
            <Text style={styles.resultLabel}>Average Reaction Time</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.resultValue}>{average}</Text>
              <Text style={styles.resultUnit}>ms</Text>
            </View>
            <View style={styles.resultPill}>
              <Text style={styles.resultPillText}>{isSlow ? 'Very Slow' : 'Normal'}</Text>
            </View>
          </View>

          <View style={styles.attemptsCardResult}>
            <Text style={styles.attemptsTitle}>Reaction Times</Text>
            <View style={styles.attemptsRowResult}>
              {attempts.map((t, i) => (
                <View key={i} style={styles.attemptPill}>
                  <Text style={styles.attemptLabel}>R{i + 1}</Text>
                  <Text style={styles.attemptValue}>{t}ms</Text>
                </View>
              ))}
            </View>

            <View style={styles.summaryBox}>
              <Ionicons name="flash" size={16} color="#D32F2F" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.summaryTitle}>Average: {average}ms</Text>
                <Text style={styles.summarySub}>{isSlow ? 'Slower than average - possible stress' : 'Normal reaction time'}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => onComplete?.({ average })}
          >
            <Text style={styles.nextBtnText}>Next: View Results</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </>
      )}
    </StressAnalysisLayout>
  );
};

const styles = StyleSheet.create({
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#EEE' },
  infoTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  infoBody: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  tipBox: { backgroundColor: '#FFF8E6', borderRadius: 8, padding: 12, flexDirection: 'row' },
  tipText: { fontSize: 13, color: '#8C6200', flex: 1, marginLeft: 8, lineHeight: 18, fontWeight: '500' },
  
  gameCard: { height: 280, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 20 },
  gameIdle: { backgroundColor: '#6B79F2' },
  gameWaiting: { backgroundColor: '#E09E6D' },
  gameGo: { backgroundColor: '#5DB75D' },
  gameTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginTop: 16, marginBottom: 8 },
  gameTitleLarge: { fontSize: 36, fontWeight: '900', color: '#FFF', marginBottom: 12 },
  gameSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  attemptsCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: '#EEE' },
  attemptsCardResult: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginTop: 20, borderWidth: 1, borderColor: '#EEE' },
  attemptsTitle: { fontSize: 16, fontWeight: '600', color: '#666', marginBottom: 16 },
  attemptsRow: { flexDirection: 'row', gap: 12 },
  attemptsRowResult: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  attemptPill: { flex: 1, backgroundColor: '#FDECE6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  attemptLabel: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 4 },
  attemptValue: { fontSize: 16, color: '#D32F2F', fontWeight: '800' },

  resultHero: { backgroundColor: '#F4E5E3', borderRadius: 20, padding: 30, alignItems: 'center', justifyContent: 'center' },
  resultLabel: { fontSize: 16, fontWeight: '600', color: '#777', marginBottom: 16 },
  resultValue: { fontSize: 64, fontWeight: '900', color: '#D32F2F' },
  resultUnit: { fontSize: 28, fontWeight: '800', color: '#D32F2F', marginLeft: 4 },
  resultPill: { backgroundColor: '#F3C5C5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
  resultPillText: { color: '#B32D2D', fontWeight: '700', fontSize: 14 },

  summaryBox: { backgroundColor: '#F8EEF0', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: '#D32F2F', marginBottom: 2 },
  summarySub: { fontSize: 11, color: '#999' },

  nextBtn: { backgroundColor: '#6B79F2', borderRadius: 28, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginRight: 8 },
});
