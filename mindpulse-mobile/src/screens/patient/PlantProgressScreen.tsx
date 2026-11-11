import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchPlantProgress, PlantProgress } from '../../services/plantProgress';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

const FREEZE_TIER_STORAGE_KEY = 'mindplant_last_freeze_tier';

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
  // The hero runs edge-to-edge, so the header - and with it the Back button -
  // has to clear the notch/status bar or the button sits underneath it and
  // cannot be tapped.
  const insets = useSafeAreaInsets();
  const [selectedStage, setSelectedStage] = useState(1);
  const [progress, setProgress] = useState<PlantProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [freezeCelebration, setFreezeCelebration] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const savedProgress = await fetchPlantProgress();
      setProgress(savedProgress);
      const savedIndex = stages.findIndex((item) => item.name === savedProgress.currentStage);
      if (savedIndex >= 0) setSelectedStage(savedIndex);
      try {
        const storedTier = await AsyncStorage.getItem(FREEZE_TIER_STORAGE_KEY);
        if (storedTier === null) {
          await AsyncStorage.setItem(FREEZE_TIER_STORAGE_KEY, String(savedProgress.freezeTier));
        } else {
          const lastTier = Number(storedTier);
          if (Number.isFinite(lastTier) && savedProgress.freezeTier > lastTier) {
            await AsyncStorage.setItem(FREEZE_TIER_STORAGE_KEY, String(savedProgress.freezeTier));
            setFreezeCelebration(savedProgress.freezes);
          }
        }
      } catch {
      }
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
        <ActivityIndicator size="large" color={tone('#1AA956')} />
        <Text style={{ color: tone('#8A9B91'), fontSize: 12 }}>Loading plant progress…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 }]}>
        <Text style={{ color: tone('#E05C5C'), fontSize: 13, textAlign: 'center' }}>{loadError}</Text>
        <TouchableOpacity onPress={() => void load()} style={{ backgroundColor: toneBg('#1AA956'), borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 }}>
          <Text style={{ color: tone('#FFF'), fontSize: 13, fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backHit}><Text style={styles.back}>‹ Back</Text></Pressable>
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
          <View style={[styles.heroHeader, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.backHit}><Text style={styles.back}>‹ Back</Text></Pressable>
            <Text style={styles.leaf}>🌱</Text>
          </View>
          <View style={styles.stageNameRow}>
            <Text style={styles.stageName}>{stage.name}</Text>
            <Pressable onPress={() => setShowInfo(true)} hitSlop={10} style={styles.infoBtn}>
              <Text style={styles.infoBtnText}>i</Text>
            </Pressable>
          </View>
          <Text style={styles.stageCount}>Stage {selectedStage} of 5 · {progress?.currentStreak ?? 0} day streak</Text>
          <View style={styles.plantScene}><Text style={styles.plantArt}>{stage.emoji}</Text></View>
        </View>

        <View style={styles.messageBox}><Text style={styles.message}>{STAGE_MESSAGES[stage.name] ?? 'Keep going — your plant is growing!'}</Text></View>

        {/* Streak + freeze bank: one freeze covers one missed day, so the
            streak (and the plant) survives a gap until the bank runs dry. */}
        <View style={styles.streakBox}>
          <Text style={styles.streakTitle}>🔥 {streak} day streak</Text>
          <Text style={styles.streakSub}>
            {progress?.freezes ?? 0} streak freeze{(progress?.freezes ?? 0) === 1 ? '' : 's'} · miss a day and one freeze covers it — run out and the streak restarts at 0.
          </Text>
        </View>

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

      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>How MindPlant Works</Text>
            <View style={styles.modalPoints}>
              <Text style={styles.modalPoint}>🔥 Streak: Complete one assessment session per day to grow your streak.</Text>
              <Text style={styles.modalPoint}>❄️ Freezes: One freeze covers one missed day so your streak survives a gap. Earn +1 freeze every 7-day streak tier (7, 14, 21 days), max 5 banked.</Text>
              <Text style={styles.modalPoint}>⭐ Growth Points: +10 points per session, lifetime total, never reset.</Text>
              <Text style={styles.modalPoint}>🌱 Stages: Bare Pot → Seedling → Sprout → Young Plant → Mature Plant → Full Bloom. Unlock by streak length.</Text>
            </View>
            <Pressable style={styles.modalBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={freezeCelebration !== null} transparent animationType="fade" onRequestClose={() => setFreezeCelebration(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.celebrateEmoji}>🎉 🎊 🥳</Text>
            <Text style={styles.modalTitle}>Streak Freeze Earned!</Text>
            <Text style={styles.celebrateBody}>
              You now have {freezeCelebration ?? 0} streak freeze{(freezeCelebration ?? 0) === 1 ? '' : 's'}. Miss a day and one freeze covers it.
            </Text>
            <Pressable style={styles.modalBtn} onPress={() => setFreezeCelebration(null)}>
              <Text style={styles.modalBtnText}>Awesome</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: toneBg('#FAFDFC') },
  content: { paddingBottom: 24 },
  hero: { height: 290, backgroundColor: toneBg('#E1F8EA'), borderBottomWidth: 1, borderBottomColor: toneBg('#66D995') },
  heroHeader: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backHit: { paddingVertical: 8, paddingHorizontal: 10, marginLeft: -10, borderRadius: 12 },
  back: { color: tone('#168A47'), fontSize: 16, fontWeight: '700' },
  leaf: { fontSize: 24 },
  stageNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  stageName: { color: tone('#142D22'), textAlign: 'center', fontSize: 18, fontWeight: '800' },
  stageCount: { color: tone('#8A9B91'), textAlign: 'center', fontSize: 12, marginTop: 3 },
  infoBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: tone('#168A47'), alignItems: 'center', justifyContent: 'center', backgroundColor: toneBg('#FFFFFF') },
  infoBtnText: { color: tone('#168A47'), fontSize: 13, fontWeight: '800' },
  plantScene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 10 },
  plantArt: { fontSize: 90 },
  messageBox: { margin: 12, padding: 13, borderWidth: 1, borderColor: toneBg('#8BE5AA'), borderRadius: 10, backgroundColor: toneBg('#E5FBEA') },
  message: { color: tone('#47705A'), fontSize: 13, lineHeight: 19 },
  streakBox: { marginHorizontal: 12, marginBottom: 12, padding: 12, borderWidth: 1, borderColor: toneBg('#FFD9A0'), borderRadius: 10, backgroundColor: toneBg('#FFF8EC') },
  streakTitle: { color: tone('#B4690E'), fontSize: 14, fontWeight: '800' },
  streakSub: { color: tone('#8A7A63'), fontSize: 11, lineHeight: 15, marginTop: 4 },
  tipBox: { marginHorizontal: 12, padding: 12, borderWidth: 1, borderColor: toneBg('#DED5FF'), borderRadius: 10, backgroundColor: toneBg('#F7F4FF') },
  tipTitle: { color: tone('#7562DA'), fontSize: 11, fontWeight: '800', marginBottom: 5 },
  tipText: { color: tone('#647087'), fontSize: 12, lineHeight: 16 },
  pointsText: { color: tone('#7562DA'), fontSize: 11, fontWeight: '700', marginTop: 6 },
  sectionTitle: { marginTop: 14, marginHorizontal: 13, color: tone('#8A9AAF'), fontSize: 12, fontWeight: '800' },
  stageList: { gap: 7, margin: 7 },
  stageRow: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: toneBg('#DDE5ED'), borderRadius: 10, backgroundColor: toneBg('#F1F5F9'), flexDirection: 'row', alignItems: 'center' },
  stageRowCurrent: { borderColor: toneBg('#7EE3A3'), backgroundColor: toneBg('#E5FBEA') },
  stageRowLocked: { backgroundColor: toneBg('#FAFBFC'), borderColor: toneBg('#EEF1F4') },
  stageEmoji: { width: 28, fontSize: 17, textAlign: 'center' },
  stageCopy: { flex: 1, marginLeft: 7 },
  stageRowName: { color: tone('#1F3145'), fontSize: 13, fontWeight: '700' },
  stageRowSubtitle: { color: tone('#8A9AAF'), fontSize: 10, marginTop: 2 },
  lockedText: { color: tone('#C8D0D9') },
  current: { color: tone('#1AA956'), fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalSheet: { width: '100%', maxWidth: 380, backgroundColor: toneBg('#FFFFFF'), borderRadius: 20, padding: 22, borderWidth: 1, borderColor: toneBg('#E2E8F0') },
  modalTitle: { color: tone('#142D22'), fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  modalPoints: { gap: 12 },
  modalPoint: { color: tone('#47705A'), fontSize: 13, lineHeight: 19 },
  celebrateEmoji: { fontSize: 34, textAlign: 'center', marginBottom: 8 },
  celebrateBody: { color: tone('#47705A'), fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 4 },
  modalBtn: { marginTop: 18, height: 48, borderRadius: 14, backgroundColor: toneBg('#1AA956'), alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: tone('#FFF'), fontSize: 15, fontWeight: '800' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
