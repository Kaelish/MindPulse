import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AssessmentTool,
  AssessmentToolQuestion,
  DEFAULT_LIKERT,
} from '../../services/assessmentTools';
import { Colors } from '../../theme/colors';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';

interface ToolResultScreenProps {
  tool: AssessmentTool;
  score: number;
  answers: Record<number, number>;
  questions: AssessmentToolQuestion[];
  onDone: () => void;
}

type Band = 'low' | 'moderate' | 'high';

const bandFor = (score: number): Band => {
  if (score <= 35) return 'low';
  if (score <= 60) return 'moderate';
  return 'high';
};

export const ToolResultScreen = ({ tool, score, answers, questions, onDone }: ToolResultScreenProps) => {
  const { t } = useTranslation();
  const copy = t.toolSurvey.result;
  const band = bandFor(score);
  const bandLabel = band === 'low' ? copy.bandLow : band === 'moderate' ? copy.bandModerate : copy.bandHigh;
  const interpretation =
    band === 'low'
      ? copy.interpretationLow
      : band === 'moderate'
        ? copy.interpretationModerate
        : copy.interpretationHigh;
  const pillBg =
    band === 'low' ? Colors.badgeNormalBg : band === 'moderate' ? Colors.badgeElevatedBg : Colors.badgeHighBg;
  const pillText =
    band === 'low'
      ? Colors.badgeNormalText
      : band === 'moderate'
        ? Colors.badgeElevatedText
        : Colors.badgeHighText;

  const rows = questions.map((question) => {
    const value = answers[question.id] ?? 0;
    const options = question.options?.length ? question.options : DEFAULT_LIKERT;
    const option = options.find((candidate) => candidate.value === value);
    return {
      id: question.id,
      text: question.text,
      value,
      label: option?.label ?? String(value),
    };
  });

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>{copy.resultTitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.toolTitle}>{tool.title}</Text>
        {!!tool.description && <Text style={styles.toolSubtitle}>{tool.description}</Text>}

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>{copy.scoreLabel}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <View style={[styles.bandPill, { backgroundColor: pillBg }]}>
            <Text style={[styles.bandPillText, { color: pillText }]}>{bandLabel}</Text>
          </View>
          <Text style={styles.interpretation}>{interpretation}</Text>
          <Text style={styles.timestamp}>{new Date().toLocaleString()}</Text>
        </View>

        <Text style={styles.sectionLabel}>{copy.answersTitle}</Text>
        <View style={styles.answerList}>
          {rows.map((row, index) => (
            <View key={row.id} style={styles.answerRow}>
              <View style={styles.answerIndexBox}>
                <Text style={styles.answerIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.answerBody}>
                <Text style={styles.answerQuestion}>{row.text}</Text>
                <View style={styles.answerMeta}>
                  <Text style={styles.answerLabel}>{row.label}</Text>
                  <Text style={styles.answerValue}>{row.value}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={onDone}>
          <Text style={styles.doneBtnText}>{copy.done}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: toneBg('#FCFBF8') },

    header: { paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
    headerPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: toneBg('#EEF0FD'),
    },
    headerPillText: { fontSize: 12, fontWeight: '700', color: tone('#6B79F2') },

    scrollContent: { paddingHorizontal: 18, paddingBottom: 24 },

    toolTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: tone('#182033'),
      textAlign: 'center',
      marginTop: 8,
    },
    toolSubtitle: {
      fontSize: 13,
      color: tone('#64748b'),
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 6,
    },

    scoreCard: {
      backgroundColor: toneBg('#EEF0FA'),
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      marginTop: 20,
      gap: 8,
    },
    scoreLabel: { fontSize: 12, fontWeight: '700', color: tone('#64748b'), letterSpacing: 0.6 },
    scoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
    scoreValue: {
      fontSize: 64,
      fontWeight: '800',
      color: tone('#182033'),
      letterSpacing: -2,
      lineHeight: 72,
    },
    scoreOutOf: { fontSize: 16, fontWeight: '700', color: tone('#8b95a5'), marginBottom: 12, marginLeft: 4 },
    bandPill: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 6, marginTop: 4 },
    bandPillText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
    interpretation: {
      fontSize: 13,
      color: tone('#64748b'),
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 4,
    },
    timestamp: { fontSize: 11, color: tone('#8b95a5'), marginTop: 4 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: tone('#64748b'),
      letterSpacing: 0.8,
      marginTop: 20,
      marginBottom: 8,
    },
    answerList: { gap: 10 },
    answerRow: {
      flexDirection: 'row',
      backgroundColor: toneBg('#fff'),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: toneBg('#E0E0E0'),
      padding: 12,
    },
    answerIndexBox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: toneBg('#EEF0FD'),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    answerIndexText: { fontSize: 12, fontWeight: '800', color: tone('#6B79F2') },
    answerBody: { flex: 1, gap: 6 },
    answerQuestion: { fontSize: 14, fontWeight: '600', color: tone('#182033'), lineHeight: 20 },
    answerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    answerLabel: { fontSize: 13, fontWeight: '700', color: tone('#6B79F2'), flex: 1 },
    answerValue: { fontSize: 13, fontWeight: '700', color: tone('#8b95a5') },

    footer: { padding: 18 },
    doneBtn: {
      height: 56,
      borderRadius: 999,
      backgroundColor: toneBg('#6B79F2'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: { color: tone('#fff'), fontSize: 16, fontWeight: '800' },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
