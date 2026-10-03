import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography, Radius, Spacing } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { loadAssessmentState, saveAssessmentState } from '../assessment/StressAssessmentHubScreen';
import { AssessmentTool } from '../../services/assessmentTools';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

type SurveyOption = { value: number; label: string };
type SurveyQuestion = {
  id: number;
  pill: string;
  text: string;
  sub?: string;
  options?: SurveyOption[];
};

/* PSS-10 (Cohen et al., 1983) — public-domain Perceived Stress Scale.
 * Items 4, 5, 7, 8 are reverse-scored (score = 4 - raw).
 * Recall window adapted from the original "last month" to "last 24 hours" so a
 * daily check-in measures today instead of the past 30 days. Scoring is
 * unchanged (0-40), so dashboard thresholds stay comparable. */
const PSS_REVERSE_IDS = new Set([4, 5, 7, 8]);
const RECALL = 'In the last 24 hours';

const part1Questions: SurveyQuestion[] = [
  { id: 1, pill: 'Unexpected Event', text: `${RECALL}, how often have you been upset because of something that happened unexpectedly?` },
  { id: 2, pill: 'Control', text: `${RECALL}, how often have you felt that you were unable to control the important things in your life?` },
  { id: 3, pill: 'Nervous & Stressed', text: `${RECALL}, how often have you felt nervous and stressed?` },
  { id: 4, pill: 'Confidence', text: `${RECALL}, how often have you felt confident about your ability to handle your personal problems?` },
  { id: 5, pill: 'Going Your Way', text: `${RECALL}, how often have you felt that things were going your way?` },
  { id: 6, pill: 'Overloaded', text: `${RECALL}, how often have you found that you could not cope with all the things that you had to do?` },
  { id: 7, pill: 'Irritations', text: `${RECALL}, how often have you been able to control irritations in your life?` },
  { id: 8, pill: 'On Top of Things', text: `${RECALL}, how often have you felt that you were on top of things?` },
  { id: 9, pill: 'Anger', text: `${RECALL}, how often have you been angered because of things that were outside of your control?` },
  { id: 10, pill: 'Overwhelm', text: `${RECALL}, how often have you felt difficulties were piling up so high that you could not overcome them?` },
];

/* Part 2 — 8 body/lifestyle indicators, 0-3 scale, higher = more stress. */
const part2Questions: SurveyQuestion[] = [
  { id: 101, pill: 'Sleep Hours', text: 'How many hours did you sleep last night?', options: [
    { value: 0, label: '8+ hours' },
    { value: 1, label: '6-7 hours' },
    { value: 2, label: '4-5 hours' },
    { value: 3, label: 'Less than 4 hours' },
  ]},
  { id: 102, pill: 'Breathing Pattern', text: 'How is your breathing right now?', sub: 'Are you breathing fast, or feeling shortness of breath?', options: [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Slightly' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'Often' },
  ]},
  { id: 103, pill: 'Mood Check', text: 'How has your mood been today?', options: [
    { value: 0, label: 'Good and stable' },
    { value: 1, label: 'Mostly okay' },
    { value: 2, label: 'Low or irritable' },
    { value: 3, label: 'Very low or overwhelmed' },
  ]},
  { id: 104, pill: 'Eye Fatigue', text: 'How tired are your eyes right now?', options: [
    { value: 0, label: 'Not tired' },
    { value: 1, label: 'Mildly tired' },
    { value: 2, label: 'Quite tired' },
    { value: 3, label: 'Very tired or sore' },
  ]},
  { id: 105, pill: 'Stressors', text: 'How many sources of stress (school, work, relationships, money) are affecting you right now?', options: [
    { value: 0, label: 'None' },
    { value: 1, label: 'One or two' },
    { value: 2, label: 'Three or four' },
    { value: 3, label: 'Five or more' },
  ]},
  { id: 106, pill: 'Physical Symptoms', text: 'Have you noticed physical signs of stress (headache, tense muscles, stomach trouble)?', options: [
    { value: 0, label: 'None' },
    { value: 1, label: 'Rarely' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'Often' },
  ]},
  { id: 107, pill: 'Device Use', text: 'How many hours a day do you spend on screens beyond work or school?', options: [
    { value: 0, label: 'Less than 1 hour' },
    { value: 1, label: '1-2 hours' },
    { value: 2, label: '3-4 hours' },
    { value: 3, label: '5+ hours' },
  ]},
  { id: 108, pill: 'Energy Level', text: 'How would you rate your energy level today?', options: [
    { value: 0, label: 'Very energetic' },
    { value: 1, label: 'Fairly energetic' },
    { value: 2, label: 'Low energy' },
    { value: 3, label: 'Exhausted' },
  ]},
];

const part1Options = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Almost Never' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Fairly Often' },
  { value: 4, label: 'Very Often' },
];

export const StressSurveyScreen = ({ onBack, tool }: { onBack: () => void; tool?: AssessmentTool }) => {
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
        // The face scan stays optional: heart rate unlocks right after the
        // survey so the user can continue without facial analysis.
        if (state.faceScan === 'locked') state.faceScan = 'unlocked';
        if (state.heartRate === 'locked') state.heartRate = 'unlocked';
        
        // Score 0-100 (higher = more stress): PSS-10 with reverse-keyed items
        // (4,5,7,8) on a 0-40 scale + Part 2 on a 0-24 scale → max 64.
        const pssSum = part1Questions.reduce((sum, q) => {
          const raw = answers[q.id] ?? 0;
          return sum + (PSS_REVERSE_IDS.has(q.id) ? 4 - raw : raw);
        }, 0);
        const part2Sum = part2Questions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
        const maxPossible = part1Questions.length * 4 + part2Questions.length * 3;
        const scaledScore = Math.round(((pssSum + part2Sum) / maxPossible) * 100);
        
        state.surveyScore = scaledScore;

        // Carry every answered item with the run so the final save stores the
        // same {toolId, toolTitle, items} snapshot the standalone tools write.
        // All 18 items travel: the 10 PSS-10 items + the 8 physiological
        // indicators the doctor reviewed — nothing answered is dropped.
        const snapshotItems = [
          ...part1Questions.map((question) => {
            const value = answers[question.id] ?? 0;
            const option = part1Options.find((candidate) => candidate.value === value);
            return {
              id: question.id,
              text: question.text,
              reverse: PSS_REVERSE_IDS.has(question.id),
              value,
              label: option?.label ?? String(value),
            };
          }),
          ...part2Questions.map((question) => {
            const value = answers[question.id] ?? 0;
            const option = question.options?.find((candidate) => candidate.value === value);
            return {
              id: question.id,
              text: question.text,
              reverse: false,
              value,
              label: option?.label ?? String(value),
            };
          }),
        ];
        state.surveyAnswersSnapshot = {
          ...(tool?.id ? { toolId: tool.id } : {}),
          toolTitle: tool?.title ?? 'PSS-10 Stress Assessment',
          items: snapshotItems,
        };

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
                <MaterialCommunityIcons name={item.icon as any} size={24} color={tone('#558E4C')} style={{ marginRight: 8 }} />
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

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: toneBg('#FCFBF8') },
  
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
    backgroundColor: toneBg('#E0E0E0'),
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
    borderColor: toneBg('#E0E0E0'),
  },
  optionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: toneBg('#F0F0F0'),
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
    backgroundColor: toneBg('#F0F0F0'),
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
  interstitialRoot: { flex: 1, backgroundColor: toneBg('#FCFBF8'), padding: Spacing.lg, justifyContent: 'center' },
  interstitialContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  interstitialIconBox: { width: 100, height: 100, borderRadius: 32, backgroundColor: toneBg('#6CAE5B'), alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  interstitialTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  interstitialSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16, marginBottom: 32 },
  interstitialGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  interstitialGridItem: { flexDirection: 'row', alignItems: 'center', width: '45%', padding: 12, borderWidth: 1, borderColor: toneBg('#C8E6C9'), borderRadius: Radius.full, justifyContent: 'center' },
  interstitialGridText: { color: tone('#2E502B'), fontSize: 13, fontWeight: '700' },
  interstitialFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingBottom: 24 },
  interstitialBackBtn: { flex: 1, height: 56, backgroundColor: toneBg('#E8F5E9'), borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  interstitialBackText: { color: tone('#2E502B'), fontSize: 16, fontWeight: '700' },
  interstitialStartBtn: { flex: 1, height: 56, backgroundColor: toneBg('#6CAE5B'), borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  interstitialStartText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
