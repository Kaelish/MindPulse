import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AssessmentTool,
  AssessmentToolQuestion,
  DEFAULT_LIKERT,
  scoreToolAnswers,
  recordToolCompletion,
} from '../../services/assessmentTools';
import { saveNewStressSession } from '../../services/dashboard';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';

interface ToolSurveyScreenProps {
  tool: AssessmentTool;
  onBack: () => void;
  onComplete: () => void;
}

/**
 * Renders a questionnaire exactly as configured by the administrator
 * (admin portal → Assessment Tools). On completion the score is persisted to
 * stress_sessions so the admin's "Review Assessment Outcomes" page reflects it.
 */
export const ToolSurveyScreen = ({ tool, onBack, onComplete }: ToolSurveyScreenProps) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const questions: AssessmentToolQuestion[] = tool.questions;
  const currentQuestion = questions[currentIndex];
  const selectedValue = currentQuestion ? answers[currentQuestion.id] : undefined;
  const canProceed = selectedValue !== undefined;
  const progressPercent = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleNext = async () => {
    if (!currentQuestion) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    // Last question answered → score, persist, done. The raw answers travel
    // with the session so the doctor can review which items drove the score.
    setSaving(true);
    setSaveError('');
    try {
      const score = scoreToolAnswers(questions, answers);
      const surveyAnswers = {
        toolId: tool.id,
        toolTitle: tool.title,
        items: questions.map((question) => {
          const value = answers[question.id] ?? 0;
          const options = question.options?.length ? question.options : DEFAULT_LIKERT;
          const option = options.find((candidate) => candidate.value === value);
          return {
            id: question.id,
            text: question.text,
            reverse: question.reverse ?? false,
            value,
            label: option?.label ?? String(value),
          };
        }),
      };
      await saveNewStressSession(
        score,
        `Completed assessment: ${tool.title}`,
        undefined,
        score,
        undefined,
        undefined,
        surveyAnswers,
      );
      await recordToolCompletion(tool.id);
      Alert.alert(
        t.toolSurvey.completeAlertTitle,
        t.toolSurvey.completeAlertBodyFmt
          .replace('{title}', tool.title)
          .replace('{score}', String(score)),
      );
      onComplete();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.toolSurvey.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t.toolSurvey.noQuestions}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onBack}>
            <Text style={styles.retryText}>{t.toolSurvey.goBack}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const options = currentQuestion.options?.length ? currentQuestion.options : DEFAULT_LIKERT;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack} disabled={saving}>
          <Ionicons name="chevron-back" size={24} color={tone('#6B79F2')} />
          <Text style={styles.headerBtnText}>{t.common.back}</Text>
        </TouchableOpacity>

        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>
            {currentIndex + 1}/{questions.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={onBack} disabled={saving}>
          <Text style={styles.headerExitText}>{t.common.exit}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titlePill}>
          <Text style={styles.titlePillText}>{tool.title}</Text>
        </View>

        <Text style={styles.questionText}>{currentQuestion.text}</Text>

        <View style={styles.optionsContainer}>
          {options.map((opt) => {
            const isSelected = selectedValue === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                activeOpacity={0.7}
                disabled={saving}
                onPress={() => setAnswers({ ...answers, [currentQuestion.id]: opt.value })}
              >
                <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={16} color={tone('#fff')} />
                  ) : (
                    <Text style={styles.optionIconText}>{opt.value}</Text>
                  )}
                </View>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, canProceed && !saving && styles.nextBtnActive]}
          disabled={!canProceed || saving}
          onPress={() => void handleNext()}
        >
          <Text style={[styles.nextBtnText, canProceed && styles.nextBtnTextActive]}>
            {saving
              ? t.common.saving
              : currentIndex === questions.length - 1
                ? t.toolSurvey.completeAssessment
                : t.common.nextQuestion}
          </Text>
          {canProceed && !saving && <Ionicons name="chevron-forward" size={20} color={tone('#fff')} />}
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
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center' },
  headerBtnText: { fontSize: 16, fontWeight: '600', color: tone('#6B79F2') },
  headerExitText: { color: tone('#64748b'), fontSize: 16, fontWeight: '600' },
  headerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: toneBg('#EEF0FD') },
  headerPillText: { fontSize: 12, fontWeight: '700', color: tone('#6B79F2') },

  progressTrack: {
    height: 6,
    backgroundColor: toneBg('#E0E0E0'),
    marginHorizontal: 18,
    borderRadius: 3,
    marginBottom: 24,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: toneBg('#6B79F2') },

  scrollContent: { paddingHorizontal: 18 },

  titlePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: toneBg('#EEF0FD'),
    marginBottom: 16,
  },
  titlePillText: { fontSize: 12, fontWeight: '700', color: tone('#6B79F2') },

  questionText: {
    color: tone('#182033'),
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 8,
  },

  optionsContainer: { gap: 12, marginTop: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: toneBg('#fff'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: toneBg('#E0E0E0'),
  },
  optionCardSelected: { backgroundColor: toneBg('#FFF8E6'), borderColor: toneBg('#E6C252') },
  optionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: toneBg('#F0F0F0'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionIconSelected: { backgroundColor: toneBg('#E6C252') },
  optionIconText: { color: tone('#8b95a5'), fontSize: 14, fontWeight: '700' },
  optionLabel: { color: tone('#182033'), fontSize: 15, fontWeight: '600' },
  optionLabelSelected: { color: tone('#8a6d0f') },

  saveError: { marginTop: 18, color: tone('#d95d5d'), fontSize: 13, fontWeight: '600', textAlign: 'center' },

  footer: { padding: 18 },
  nextBtn: {
    backgroundColor: toneBg('#F0F0F0'),
    flexDirection: 'row',
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnActive: { backgroundColor: toneBg('#6B79F2') },
  nextBtnText: { color: tone('#8b95a5'), fontSize: 16, fontWeight: '700', marginRight: 8 },
  nextBtnTextActive: { color: tone('#fff') },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { color: tone('#64748b'), fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: toneBg('#6B79F2') },
  retryText: { color: tone('#fff'), fontSize: 15, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
