import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography, Radius, Spacing } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { loadAssessmentState, saveAssessmentState } from '../assessment/StressAssessmentHubScreen';
import { AssessmentTool } from '../../services/assessmentTools';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';
import { part1Display, part2Display, likertDisplay } from '../../i18n/translations';
import type { PssDisplayItem, LifestyleDisplayItem, LikertOption } from '../../i18n/types';

type SurveyOption = LikertOption;
type PssQuestion = PssDisplayItem;
type LifestyleQuestion = LifestyleDisplayItem;

/* PSS-10 (Cohen et al., 1983) — public-domain Perceived Stress Scale.
 * Items 4, 5, 7, 8 are reverse-scored (score = 4 - raw).
 * Recall window adapted from the original "last month" to "last 24 hours" so a
 * daily check-in measures today instead of the past 30 days. Scoring is
 * unchanged (0-40), so dashboard thresholds stay comparable. */
const PSS_REVERSE_IDS = new Set([4, 5, 7, 8]);

export const StressSurveyScreen = ({ onBack, tool }: { onBack: () => void; tool?: AssessmentTool }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'part1' | 'interstitial' | 'part2'>('part1');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const isPart1 = phase === 'part1';
  const isPart2 = phase === 'part2';

  /** Localized PSS-10 questions (part 1). */
  const pssQuestions: PssQuestion[] = part1Display(t);
  /** Localized lifestyle questions (part 2). */
  const lifestyleQuestions: LifestyleQuestion[] = part2Display(t);
  /** Localized 5-point Likert scale for part 1. */
  const likertOptions: SurveyOption[] = likertDisplay(t);

  const currentQuestions = isPart1 ? pssQuestions : lifestyleQuestions;
  const currentQuestion = currentQuestions[currentIndex];
  const selectedValue = answers[currentQuestion?.id];
  const canProceed = selectedValue !== undefined;

  /** Options rendered for the current question. */
  const currentOptions = isPart1
    ? likertOptions
    : (currentQuestion as LifestyleQuestion).options.map((label, value) => ({ value, label }));

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
        const pssSum = pssQuestions.reduce((sum, q) => {
          const raw = answers[q.id] ?? 0;
          return sum + (PSS_REVERSE_IDS.has(q.id) ? 4 - raw : raw);
        }, 0);
        const part2Sum = lifestyleQuestions.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);
        const maxPossible = pssQuestions.length * 4 + lifestyleQuestions.length * 3;
        const scaledScore = Math.round(((pssSum + part2Sum) / maxPossible) * 100);

        state.surveyScore = scaledScore;

        // Carry every answered item with the run so the final save stores the
        // same {toolId, toolTitle, items} snapshot the standalone tools write.
        // All 18 items travel: the 10 PSS-10 items + the 8 physiological
        // indicators the doctor reviewed — nothing answered is dropped.
        const snapshotItems = [
          ...pssQuestions.map((question) => {
            const value = answers[question.id] ?? 0;
            const option = likertOptions.find((candidate) => candidate.value === value);
            return {
              id: question.id,
              text: question.text,
              reverse: PSS_REVERSE_IDS.has(question.id),
              value,
              label: option?.label ?? String(value),
            };
          }),
          ...lifestyleQuestions.map((question) => {
            const value = answers[question.id] ?? 0;
            const option = question.options?.findIndex((_, i) => i === value) !== -1
              ? { value, label: question.options[value] }
              : undefined;
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
    const { title, sub, start, gridSleep, gridBreathing, gridMood, gridEyes, gridStressors, gridSymptoms, gridDevice, gridEnergy } = t.survey.interstitial;
    return (
      <SafeAreaView style={styles.interstitialRoot}>
        <View style={styles.interstitialContent}>
          <View style={styles.interstitialIconBox}>
            <MaterialCommunityIcons name="chart-bell-curve" size={60} color={Colors.white} />
          </View>
          <Text style={styles.interstitialTitle}>{title}</Text>
          <Text style={styles.interstitialSub}>
            {sub}
          </Text>

          <View style={styles.interstitialGrid}>
            {[
              { label: gridSleep, icon: 'sleep' }, { label: gridBreathing, icon: 'head-outline' },
              { label: gridMood, icon: 'emoticon-outline' }, { label: gridEyes, icon: 'eye-outline' },
              { label: gridStressors, icon: 'file-document-outline' }, { label: gridSymptoms, icon: 'magnify' },
              { label: gridDevice, icon: 'cellphone' }, { label: gridEnergy, icon: 'lightning-bolt' }
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
            <Text style={styles.interstitialBackText}>{t.common.back}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.interstitialStartBtn} onPress={() => { setPhase('part2'); setCurrentIndex(0); }}>
            <Text style={styles.interstitialStartText}>{start}</Text>
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
          <Text style={[styles.headerBtnText, { color: themeColor }]}>{t.common.back}</Text>
        </TouchableOpacity>

        <View style={[styles.headerPill, { backgroundColor: themeBg }]}>
          <Text style={[styles.headerPillText, { color: themeColor }]}>
            Part {isPart1 ? 1 : 2} • {currentIndex + 1}/{currentQuestions.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Text style={styles.headerExitText}>{t.common.exit}</Text>
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
        {isPart2 && (currentQuestion as LifestyleQuestion).sub && <Text style={styles.questionSubText}>{(currentQuestion as LifestyleQuestion).sub}</Text>}

        {/* Options */}
        <View style={styles.optionsContainer}>
          {currentOptions.map((opt) => {
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
            {currentIndex === currentQuestions.length - 1 ? (isPart1 ? t.survey.footer.continueToPart2 : t.survey.footer.completeSurvey) : t.common.nextQuestion}
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
    backgroundColor: toneBg(Colors.white),
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
