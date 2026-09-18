import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography, Radius, Spacing } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { loadAssessmentState, saveAssessmentState } from '../assessment/StressAssessmentHubScreen';

type SurveyOption = { value: number; label: string };
type SurveyQuestion = {
  id: number;
  pill: string;
  text: string;
  sub?: string;
  options?: SurveyOption[];
};

const part1Questions: SurveyQuestion[] = [
  { id: 1, pill: 'Unexpected Event', text: 'How often have you been upset because of something that happened unexpectedly?' },
  { id: 2, pill: 'Control', text: 'How often have you felt unable to control important things in your life?' },
  ...Array.from({ length: 7 }).map((_, i) => ({ id: i + 3, pill: 'Stress Factor', text: `Mock question ${i + 3} for the PSS-10 survey?` })),
  { id: 10, pill: 'Overwhelm', text: 'How often have you felt difficulties piling up so high that you could not overcome them?' }
];

const part2Questions: SurveyQuestion[] = [
  { id: 101, pill: 'Sleep Hours', text: 'How many hours did you sleep last night?', options: [
    { value: 0, label: 'Less than 4 hours' },
    { value: 1, label: '4-5 hours' },
    { value: 2, label: '6-7 hours' },
    { value: 3, label: '8+ hours' },
  ]},
  { id: 102, pill: 'Breathing Pattern', text: 'How is your breathing right now?', sub: 'Are you breathing fast, or feeling shortness of breath?', options: [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Slightly' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'Often' },
  ]},
  ...Array.from({ length: 6 }).map((_, i) => ({
    id: 103 + i, pill: 'Psychological Check', text: `Part 2 Mock Question ${i + 3}`, options: [
      { value: 0, label: 'Option A' }, { value: 1, label: 'Option B' }, { value: 2, label: 'Option C' }, { value: 3, label: 'Option D' }
    ]
  }))
];

const part1Options = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Almost Never' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Fairly Often' },
  { value: 4, label: 'Very Often' },
];

export const StressSurveyScreen = ({ onBack }: { onBack: () => void }) => {
  const [phase, setPhase] = useState<'part1' | 'interstitial' | 'part2'>('part1');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const isPart1 = phase === 'part1';
  const isPart2 = phase === 'part2';
  const currentQuestions = isPart1 ? part1Questions : part2Questions;
  const currentQuestion = currentQuestions[currentIndex];
  const selectedValue = answers[currentQuestion?.id];
  const canProceed = selectedValue !== undefined;

  const handleNext = async () => {
    if (currentIndex < currentQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (isPart1) {
        setPhase('interstitial');
      } else if (isPart2) {
        // Finished survey completely
        const state = await loadAssessmentState();
        state.survey = 'completed';
        state.faceScan = 'unlocked';
        await saveAssessmentState(state);
        onBack();
      }
    }
  };

  const progressPercent = ((currentIndex + 1) / currentQuestions.length) * 100;

  if (phase === 'interstitial') {
    return (
      <SafeAreaView style={styles.interstitialRoot}>
        <View style={styles.interstitialContent}>
          <View style={styles.interstitialIconBox}>
            <MaterialCommunityIcons name="chart-bell-curve" size={60} color={Colors.white} />
          </View>
          <Text style={styles.interstitialTitle}>Part 2: Psychological Check</Text>
          <Text style={styles.interstitialSub}>
            These 8 quick indicators — sleep, breathing, mood, eye fatigue, and more — help us better understand your body's stress signals.
          </Text>

          <View style={styles.interstitialGrid}>
            {[
              { label: 'Sleep Hours', icon: 'sleep' }, { label: 'Breathing', icon: 'head-outline' },
              { label: 'Mood Check', icon: 'emoticon-outline' }, { label: 'Eye Fatigue', icon: 'eye-outline' },
              { label: 'Stressors', icon: 'file-document-outline' }, { label: 'Symptoms', icon: 'magnify' },
              { label: 'Device Use', icon: 'cellphone' }, { label: 'Energy', icon: 'lightning-bolt' }
            ].map((item, idx) => (
              <View key={idx} style={styles.interstitialGridItem}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color="#558E4C" style={{ marginRight: 8 }} />
                <Text style={styles.interstitialGridText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.interstitialFooter}>
          <TouchableOpacity style={styles.interstitialBackBtn} onPress={onBack}>
            <Text style={styles.interstitialBackText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.interstitialStartBtn} onPress={() => { setPhase('part2'); setCurrentIndex(0); }}>
            <Text style={styles.interstitialStartText}>Start Part 2</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Common UI for Part 1 & 2
  const themeColor = isPart2 ? '#558E4C' : '#6B79F2';
  const themeBg = isPart2 ? '#E8F5E9' : '#EEF0FD';
  const selectedThemeBg = isPart2 ? '#F1F8E9' : '#FFF8E6';
  const selectedThemeBorder = isPart2 ? '#558E4C' : '#E6C252';
  const selectedThemeIconColor = isPart2 ? '#558E4C' : '#B8860B';

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={themeColor} />
          <Text style={[styles.headerBtnText, { color: themeColor }]}>Back</Text>
        </TouchableOpacity>

        <View style={[styles.headerPill, { backgroundColor: themeBg }]}>
          <Text style={[styles.headerPillText, { color: themeColor }]}>
            Part {isPart1 ? 1 : 2} • {currentIndex + 1}/{currentQuestions.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Text style={styles.headerExitText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: themeColor }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Question Pill */}
        <View style={[styles.questionPill, { backgroundColor: themeBg }]}>
          <Text style={[styles.questionPillText, { color: themeColor }]}>{currentQuestion.pill}</Text>
        </View>

        {/* Question Text */}
        <Text style={styles.questionText}>{currentQuestion.text}</Text>
        {isPart2 && currentQuestion.sub && <Text style={styles.questionSubText}>{currentQuestion.sub}</Text>}

        {/* Options */}
        <View style={styles.optionsContainer}>
          {(isPart2 ? currentQuestion.options ?? part1Options : part1Options).map((opt) => {
            const isSelected = selectedValue === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionCard, 
                  isSelected && { backgroundColor: selectedThemeBg, borderColor: selectedThemeBorder }
                ]}
                activeOpacity={0.7}
                onPress={() => setAnswers({ ...answers, [currentQuestion.id]: opt.value })}
              >
                <View style={[styles.optionIcon, isSelected && { backgroundColor: selectedThemeBorder }]}>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={16} color={isPart2 ? Colors.white : selectedThemeIconColor} />
                  ) : (
                    <Text style={styles.optionIconText}>{opt.value}</Text>
                  )}
                </View>
                <Text style={[styles.optionLabel, isSelected && { color: selectedThemeIconColor }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, canProceed && { backgroundColor: themeColor }]}
          disabled={!canProceed}
          onPress={handleNext}
        >
          <Text style={[styles.nextBtnText, canProceed && styles.nextBtnTextActive]}>
            {currentIndex === currentQuestions.length - 1 ? (isPart1 ? 'Continue to Part 2' : 'Complete Survey') : 'Next Question'}
          </Text>
          {canProceed && <Ionicons name="chevron-forward" size={20} color={Colors.white} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFBF8' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center' },
  headerBtnText: { fontSize: 16, fontWeight: '600' },
  headerExitText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  headerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  headerPillText: { fontSize: 12, fontWeight: '700' },

  progressTrack: {
    height: 6,
    backgroundColor: '#E0E0E0',
    marginHorizontal: Spacing.lg,
    borderRadius: 3,
    marginBottom: Spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  scrollContent: { paddingHorizontal: Spacing.lg },

  questionPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: 16,
  },
  questionPillText: { fontSize: 13, fontWeight: '700' },

  questionText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 8,
  },
  questionSubText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },

  optionsContainer: { gap: 12, marginTop: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  optionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionIconText: {
    color: Colors.textHint,
    fontSize: 14,
    fontWeight: '700',
  },
  optionLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  footer: {
    padding: Spacing.lg,
    backgroundColor: 'transparent',
  },
  nextBtn: {
    backgroundColor: '#F0F0F0',
    flexDirection: 'row',
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: Colors.textHint,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  nextBtnTextActive: {
    color: Colors.white,
  },

  // Interstitial styles
  interstitialRoot: { flex: 1, backgroundColor: '#FCFBF8', padding: Spacing.lg, justifyContent: 'center' },
  interstitialContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  interstitialIconBox: { width: 100, height: 100, borderRadius: 32, backgroundColor: '#6CAE5B', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  interstitialTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  interstitialSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16, marginBottom: 32 },
  interstitialGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  interstitialGridItem: { flexDirection: 'row', alignItems: 'center', width: '45%', padding: 12, borderWidth: 1, borderColor: '#C8E6C9', borderRadius: Radius.full, justifyContent: 'center' },
  interstitialGridText: { color: '#2E502B', fontSize: 13, fontWeight: '700' },
  interstitialFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingBottom: 24 },
  interstitialBackBtn: { flex: 1, height: 56, backgroundColor: '#E8F5E9', borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  interstitialBackText: { color: '#2E502B', fontSize: 16, fontWeight: '700' },
  interstitialStartBtn: { flex: 1, height: 56, backgroundColor: '#6CAE5B', borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  interstitialStartText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
