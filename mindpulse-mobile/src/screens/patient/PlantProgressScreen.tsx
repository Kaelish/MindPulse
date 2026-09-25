import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchPlantProgress, PlantProgress } from '../../services/plantProgress';

interface PlantProgressScreenProps {
  onBack?: () => void;
}

type Stage = { name: string; subtitle: string; emoji: string; requiredStreak: number };

// Thresholds mirror the GROWTH_STAGE table (REQUIRED_SESSIONS) in Supabase
const stages: Stage[] = [
  { name: 'Bare Pot', subtitle: 'Stage 0', emoji: '🪴', requiredStreak: 0 },
  { name: 'Seedling', subtitle: 'Stage 1', emoji: '🌱', requiredStreak: 1 },
  { name: 'Sprout', subtitle: 'Stage 2', emoji: '🌿', requiredStreak: 5 },
  { name: 'Young Plant', subtitle: 'Stage 3', emoji: '🌵', requiredStreak: 10 },
  { name: 'Mature Plant', subtitle: 'Stage 4', emoji: '🌳', requiredStreak: 15 },
  { name: 'Full Bloom', subtitle: 'Stage 5', emoji: '🌸', requiredStreak: 25 },
];

const STAGE_MESSAGES: Record<string, string> = {
  'Bare Pot': 'Your journey is ready to begin. Complete a session to plant your seed!',
  'Seedling': 'A tiny seedling sprouted! Your calm mind is starting to nurture new life.',
  'Sprout': 'Your steady practice is helping it grow.',
  'Young Plant': 'Your healthy rhythm is taking root.',
  'Mature Plant': 'Your consistency is flourishing.',
  'Full Bloom': 'A strong and sustained wellness practice. Simply blooming!',
};

export const PlantProgressScreen: React.FC<PlantProgressScreenProps> = ({ onBack }) => {
  const [selectedStage, setSelectedStage] = useState(1);
  const [progress, setProgress] = useState<PlantProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const savedProgress = await fetchPlantProgress();
      setProgress(savedProgress);
      const savedIndex = stages.findIndex((item) => item.name === savedProgress.currentStage);
      if (savedIndex >= 0) setSelectedStage(savedIndex);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load plant progress.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
        <ActivityIndicator size="large" color="#1AA956" />
        <Text style={{ color: '#8A9B91', fontSize: 12 }}>Loading plant progress…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 }]}>
        <Text style={{ color: '#E05C5C', fontSize: 13, textAlign: 'center' }}>{loadError}</Text>
        <TouchableOpacity onPress={() => void load()} style={{ backgroundColor: '#1AA956', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 }}>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
        <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Back</Text></Pressable>
      </View>
    );
  }

  const stage = stages[selectedStage];
  const streak = progress?.currentStreak ?? 0;
  const isUnlocked = (s: Stage) => streak >= s.requiredStreak;

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Back</Text></Pressable>
            <Text style={styles.leaf}>🌱</Text>
          </View>
          <Text style={styles.stageName}>{stage.name}</Text>
          <Text style={styles.stageCount}>Stage {selectedStage} of 5 · {progress?.currentStreak ?? 0} day streak</Text>
          <View style={styles.plantScene}><Text style={styles.plantArt}>{stage.emoji}</Text></View>
        </View>

        <View style={styles.messageBox}><Text style={styles.message}>{STAGE_MESSAGES[stage.name] ?? 'Keep going — your plant is growing!'}</Text></View>
        <View style={styles.tipBox}><Text style={styles.tipTitle}>💡 GROWTH TIP</Text><Text style={styles.tipText}>🌿 Keep your streak going — each low-stress session helps it grow!</Text><Text style={styles.pointsText}>{progress?.totalGrowthPoints ?? 0} growth points</Text></View>

        <Text style={styles.sectionTitle}>ALL GROWTH STAGES</Text>
        <View style={styles.stageList}>
          {stages.map((item, index) => {
            const unlocked = isUnlocked(item);
            return (
              <Pressable key={item.name} disabled={!unlocked} onPress={() => setSelectedStage(index)} style={[styles.stageRow, selectedStage === index && styles.stageRowCurrent, !unlocked && styles.stageRowLocked]}>
                <Text style={styles.stageEmoji}>{unlocked ? item.emoji : '🔒'}</Text>
                <View style={styles.stageCopy}><Text style={[styles.stageRowName, !unlocked && styles.lockedText]}>{item.name}</Text><Text style={[styles.stageRowSubtitle, !unlocked && styles.lockedText]}>{unlocked ? item.subtitle : `Unlocks at ${item.requiredStreak}-day streak`}</Text></View>
                {selectedStage === index && <Text style={styles.current}>Current</Text>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFDFC' },
  content: { paddingBottom: 24 },
  hero: { height: 290, backgroundColor: '#E1F8EA', borderBottomWidth: 1, borderBottomColor: '#66D995' },
  heroHeader: { height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#168A47', fontSize: 11 },
  leaf: { fontSize: 18 },
  stageName: { color: '#142D22', textAlign: 'center', fontSize: 14, fontWeight: '800' },
  stageCount: { color: '#8A9B91', textAlign: 'center', fontSize: 9, marginTop: 3 },
  plantScene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 10 },
  plantArt: { fontSize: 75 },
  messageBox: { margin: 12, padding: 13, borderWidth: 1, borderColor: '#8BE5AA', borderRadius: 10, backgroundColor: '#E5FBEA' },
  message: { color: '#47705A', fontSize: 10, lineHeight: 15 },
  tipBox: { marginHorizontal: 12, padding: 12, borderWidth: 1, borderColor: '#DED5FF', borderRadius: 10, backgroundColor: '#F7F4FF' },
  tipTitle: { color: '#7562DA', fontSize: 8, fontWeight: '800', marginBottom: 5 },
  tipText: { color: '#647087', fontSize: 9, lineHeight: 13 },
  pointsText: { color: '#7562DA', fontSize: 8, fontWeight: '700', marginTop: 6 },
  sectionTitle: { marginTop: 14, marginHorizontal: 13, color: '#8A9AAF', fontSize: 8, fontWeight: '800' },
  stageList: { gap: 7, margin: 7 },
  stageRow: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#DDE5ED', borderRadius: 10, backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' },
  stageRowCurrent: { borderColor: '#7EE3A3', backgroundColor: '#E5FBEA' },
  stageRowLocked: { backgroundColor: '#FAFBFC', borderColor: '#EEF1F4' },
  stageEmoji: { width: 28, fontSize: 17, textAlign: 'center' },
  stageCopy: { flex: 1, marginLeft: 7 },
  stageRowName: { color: '#1F3145', fontSize: 10, fontWeight: '700' },
  stageRowSubtitle: { color: '#8A9AAF', fontSize: 8, marginTop: 2 },
  lockedText: { color: '#C8D0D9' },
  current: { color: '#1AA956', fontSize: 8, fontWeight: '800' },
});
