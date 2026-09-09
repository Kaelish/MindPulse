import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchPlantProgress, PlantProgress } from '../../services/plantProgress';

interface PlantProgressScreenProps {
  onBack?: () => void;
}

type Stage = { name: string; subtitle: string; emoji: string; unlocked: boolean };

const stages: Stage[] = [
  { name: 'Bare Pot', subtitle: 'Stage 0', emoji: '🪴', unlocked: true },
  { name: 'Seedling', subtitle: 'Stage 1', emoji: '🌱', unlocked: true },
  { name: 'Sprout', subtitle: 'Stage 2', emoji: '🌿', unlocked: false },
  { name: 'Young Plant', subtitle: 'Stage 3', emoji: '🌿', unlocked: false },
  { name: 'Mature Plant', subtitle: 'Stage 4', emoji: '🌳', unlocked: false },
  { name: 'Full Bloom', subtitle: 'Stage 5', emoji: '🌸', unlocked: false },
];

export const PlantProgressScreen: React.FC<PlantProgressScreenProps> = ({ onBack }) => {
  const [selectedStage, setSelectedStage] = useState(1);
  const [progress, setProgress] = useState<PlantProgress | null>(null);

  useEffect(() => {
    void fetchPlantProgress().then((savedProgress) => {
      setProgress(savedProgress);
      const savedIndex = stages.findIndex((item) => item.name === savedProgress.currentStage);
      if (savedIndex >= 0) setSelectedStage(savedIndex);
    });
  }, []);

  const stage = stages[selectedStage];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Back</Text></Pressable>
            <Text style={styles.leaf}>🌱</Text>
          </View>
          <Text style={styles.stageName}>{stage.name}</Text>
          <Text style={styles.stageCount}>Stage {selectedStage} of 5 · {progress?.currentStreak ?? 1} day streak</Text>
          <View style={styles.plantScene}><Text style={styles.plantArt}>{selectedStage === 0 ? '🪴' : selectedStage === 1 ? '🌱' : '🌿'}</Text></View>
        </View>

        <View style={styles.messageBox}><Text style={styles.message}>A tiny seedling sprouted! Your calm mind is starting to nurture new life.</Text></View>
        <View style={styles.tipBox}><Text style={styles.tipTitle}>💡 GROWTH TIP</Text><Text style={styles.tipText}>🌿 Keep your streak going — each low-stress session helps it grow!</Text><Text style={styles.pointsText}>{progress?.totalGrowthPoints ?? 10} growth points</Text></View>

        <Text style={styles.sectionTitle}>ALL GROWTH STAGES</Text>
        <View style={styles.stageList}>
          {stages.map((item, index) => (
            <Pressable key={item.name} disabled={!item.unlocked} onPress={() => setSelectedStage(index)} style={[styles.stageRow, selectedStage === index && styles.stageRowCurrent, !item.unlocked && styles.stageRowLocked]}>
              <Text style={styles.stageEmoji}>{item.unlocked ? item.emoji : '🔒'}</Text>
              <View style={styles.stageCopy}><Text style={[styles.stageRowName, !item.unlocked && styles.lockedText]}>{item.name}</Text><Text style={[styles.stageRowSubtitle, !item.unlocked && styles.lockedText]}>{item.subtitle}</Text></View>
              {selectedStage === index && <Text style={styles.current}>Current</Text>}
            </Pressable>
          ))}
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
