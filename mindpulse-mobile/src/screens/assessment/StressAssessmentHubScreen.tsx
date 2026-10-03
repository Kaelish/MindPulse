import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography, Radius, Spacing } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AssessmentTool,
  fetchActiveAssessmentTools,
  loadToolCompletions,
} from '../../services/assessmentTools';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

export type AssessmentStepStatus = 'locked' | 'unlocked' | 'completed' | 'skipped';

/**
 * Self-contained snapshot of the built-in survey's answers — the same shape
 * standalone tools store on stress_sessions.survey_answers (migration 0019),
 * so the doctor's "View survey answers" works for the daily check-in too.
 */
export type SurveyAnswersSnapshot = {
  toolId?: string;
  toolTitle: string;
  items: { id: number; text: string; reverse: boolean; value: number; label: string }[];
};

export interface AssessmentState {
  survey: AssessmentStepStatus;
  faceScan: AssessmentStepStatus;
  heartRate: AssessmentStepStatus;
  reaction: AssessmentStepStatus;

  /** Local YYYY-MM-DD the patient saved this run. Null/absent = still open. */
  completedOn?: string;

  // Stored data from modules
  surveyScore?: number;
  faceScanData?: any;
  heartRateBpm?: number;
  reactionTimeMs?: number;
  /** Raw answers from today's survey, carried to the final session save. */
  surveyAnswersSnapshot?: SurveyAnswersSnapshot;
}

const DEFAULT_STATE: AssessmentState = {
  survey: 'unlocked',
  faceScan: 'locked',
  heartRate: 'locked',
  reaction: 'locked',
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * The device's local calendar day. Deliberately not `toISOString()` — that is
 * UTC, so a 9 PM check-in in UTC+8 would already count as tomorrow.
 */
export const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** True when today's 4-step run has already been saved. */
export const isDayComplete = (state: AssessmentState): boolean =>
  !!state.completedOn && state.completedOn === todayKey();

/**
 * The state written when the patient saves their result: today is done, every
 * step shows its finished status, and the numbers are kept so the results stay
 * viewable until the day rolls over.
 */
export const markDayComplete = (state: AssessmentState): AssessmentState => ({
  ...state,
  survey: 'completed',
  faceScan: state.faceScan === 'completed' ? 'completed' : 'skipped',
  heartRate: 'completed',
  reaction: 'completed',
  completedOn: todayKey(),
});

export const loadAssessmentState = async (): Promise<AssessmentState> => {
  let stored: AssessmentState = DEFAULT_STATE;
  try {
    const json = await AsyncStorage.getItem('assessment_state');
    if (json) {
      stored = { ...DEFAULT_STATE, ...(JSON.parse(json) as AssessmentState) };
    }
  } catch (e) {
    console.error('Failed to load assessment state', e);
  }

  // A run saved on an earlier day no longer counts — hand back a clean slate.
  // Nothing is written here; the next saveAssessmentState persists the reset.
  if (stored.completedOn && stored.completedOn !== todayKey()) {
    return { ...DEFAULT_STATE };
  }
  return stored;
};

export const saveAssessmentState = async (state: AssessmentState) => {
  try {
    await AsyncStorage.setItem('assessment_state', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save assessment state', e);
  }
};

interface StepCardProps {
  title: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  status: AssessmentStepStatus;
  onPress: () => void;
  weight: string;
  /** Short hint pill: Required steps gate the results, Skippable ones do not. */
  flag?: 'required' | 'skippable';
  /** Today's run is already saved — tapping explains why it is closed. */
  dayComplete?: boolean;
}

const StepCard = ({
  title, subtitle, icon, iconColor, iconBg, status, onPress, weight, flag, dayComplete,
}: StepCardProps) => {
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';

  return (
    <TouchableOpacity
      style={[styles.stepCard, isLocked && styles.stepCardLocked]}
      activeOpacity={isLocked ? 1 : 0.7}
      onPress={() => {
        if (dayComplete) {
          Alert.alert(
            'Today’s assessment is complete',
            'You already finished today’s check-in. The next one unlocks tomorrow.',
          );
        } else if (isLocked) {
          Alert.alert('Locked', 'Complete the previous assessment first to unlock this assessment.');
        } else if (isCompleted) {
          // The checkmark has to mean something: a stray tap must not look
          // like progress was lost. Retaking stays possible mid-run (before
          // the day is saved), but only after an explicit confirmation —
          // new answers replace the old ones.
          Alert.alert(
            'You already completed this step',
            'Retake it? Your new answers will replace the old ones.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retake', onPress },
            ],
          );
        } else {
          onPress();
        }
      }}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg, opacity: isLocked ? 0.5 : 1 }]}>
        <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
        <View style={[styles.weightBadge, { backgroundColor: iconColor }]}>
          <Text style={styles.weightText}>{weight}</Text>
        </View>
      </View>
      
      <View style={styles.stepTextContent}>
        <Text style={[styles.stepTitle, isLocked && styles.stepTitleLocked]}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
        {flag && (
          <View style={[styles.flagPill, flag === 'required' ? styles.flagRequired : styles.flagSkippable]}>
            <Text
              style={[styles.flagText, flag === 'required' ? styles.flagTextRequired : styles.flagTextSkippable]}
            >
              {flag === 'required' ? 'Required' : 'Skippable'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statusIndicator}>
        {isLocked && <Ionicons name="lock-closed-outline" size={20} color={Colors.textHint} />}
        {isCompleted && <Ionicons name="checkmark-circle" size={24} color={tone('#4CAF50')} />}
        {status === 'unlocked' && <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />}
        {isSkipped && (
          <View style={styles.skippedPill}>
            <Text style={styles.skippedPillText}>Skipped</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

interface ToolCardProps {
  tool: AssessmentTool;
  completedAt?: string;
  onPress: () => void;
}

/** Assessment questionnaire published by the administrator (Supabase). */
const ToolCard = ({ tool, completedAt, onPress }: ToolCardProps) => (
  <TouchableOpacity style={styles.stepCard} activeOpacity={0.7} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: toneBg('#EEF0FD') }]}>
      <MaterialCommunityIcons name="clipboard-text-outline" size={26} color={tone('#6B79F2')} />
    </View>

    <View style={styles.stepTextContent}>
      <Text style={styles.stepTitle}>{tool.title}</Text>
      <Text style={styles.stepSubtitle}>
        {tool.category} · {tool.questions.length} Questions · {tool.durationMinutes} min
      </Text>
    </View>

    <View style={styles.statusIndicator}>
      {completedAt ? (
        <Ionicons name="checkmark-circle" size={24} color={tone('#4CAF50')} />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      )}
    </View>
  </TouchableOpacity>
);

interface HubExtras {
  tools: AssessmentTool[];
  completions: Record<string, string>;
  /** The tools query failed (offline/RLS) — show a retry instead of hiding. */
  toolsFailed: boolean;
}

export const StressAssessmentHubScreen = ({
  onNavigate,
  onExit,
}: {
  onNavigate: (screen: string, tool?: AssessmentTool) => void;
  onExit?: () => void;
}) => {
  const [state, setState] = useState<AssessmentState | null>(null);
  const [extras, setExtras] = useState<HubExtras>({ tools: [], completions: {}, toolsFailed: false });
  const [toolsReloadKey, setToolsReloadKey] = useState(0);

  useEffect(() => {
    loadAssessmentState().then(setState);
    Promise.all([fetchActiveAssessmentTools(), loadToolCompletions()]).then(([result, completions]) =>
      setExtras({ tools: result.tools, completions, toolsFailed: result.failed }),
    );
  }, [toolsReloadKey]);

  if (!state) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.btnBlue} />
      </View>
    );
  }

  const dayComplete = isDayComplete(state);

  // Once today's run is saved, every step shows its finished status instead of
  // the "locked" leftovers from the run that just ended.
  const displayStatus = (s: AssessmentStepStatus): AssessmentStepStatus =>
    dayComplete && s !== 'completed' && s !== 'skipped' ? 'skipped' : s;

  const completedCount = [state.survey, state.faceScan, state.heartRate, state.reaction]
    .filter(s => s === 'completed').length;
  // The face scan is a demo excluded from scoring, so it never blocks results —
  // only the three scored steps (survey, heart rate, reaction) are required.
  const canViewResults =
    dayComplete ||
    (state.survey === 'completed' &&
      state.heartRate === 'completed' &&
      state.reaction === 'completed');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={Colors.white} />
          </View>
          <Text style={styles.title}>Stress Assessment</Text>
          <Text style={styles.subtitle}>
            {dayComplete
              ? 'Done for today — your results are below'
              : 'Complete all steps for the most accurate result'}
          </Text>
        </View>

        {dayComplete && (
          <View style={styles.dayCompleteBanner}>
            <Ionicons name="checkmark-circle" size={22} color={tone('#FFF')} />
            <View style={styles.dayCompleteCopy}>
              <Text style={styles.dayCompleteTitle}>Today's assessment is complete!</Text>
              <Text style={styles.dayCompleteSub}>
                Your next daily check-in unlocks tomorrow. You can still review today's results.
              </Text>
            </View>
          </View>
        )}

        {/* Questionnaires published by the administrator */}
        {extras.tools.length > 0 && (
          <View style={styles.stepsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>AVAILABLE ASSESSMENTS</Text>
              <Text style={styles.progressText}>{extras.tools.length} Tools</Text>
            </View>
            <Text style={styles.sectionNote}>
              Tap any assessment to take it now — each result is saved to your record.
            </Text>
            {extras.tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                completedAt={extras.completions[tool.id]}
                onPress={() => {
                  // Multi-Modal tools launch the full 4-step flow (survey →
                  // scan → heart rate → reaction); surveys run standalone.
                  if (tool.category === 'Multi-Modal') {
                    if (dayComplete) {
                      Alert.alert(
                        'Today’s assessment is complete',
                        'You already finished today’s check-in. The next one unlocks tomorrow.',
                      );
                      return;
                    }
                    onNavigate('StressSurvey', tool);
                    return;
                  }
                  onNavigate('ToolSurvey', tool);
                }}
              />
            ))}
          </View>
        )}

        {/* Failed fetch must not look like "no assessments exist" — say so. */}
        {extras.tools.length === 0 && extras.toolsFailed && (
          <View style={styles.stepsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>AVAILABLE ASSESSMENTS</Text>
            </View>
            <View style={styles.loadErrorCard}>
              <Ionicons name="cloud-offline-outline" size={22} color={Colors.textHint} />
              <Text style={styles.loadErrorText}>
                Couldn’t load your assessments. Check your connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => setToolsReloadKey((key) => key + 1)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Steps List */}
        <View style={styles.stepsSection}>
          <View style={styles.sectionHeaderRow}>
             <Text style={styles.sectionTitle}>ASSESSMENT STEPS</Text>
             <Text style={styles.progressText}>
               {dayComplete ? 'Completed today' : `${completedCount}/4 Completed`}
             </Text>
           </View>
           <Text style={styles.sectionNote}>
             One combined daily check-in: survey, face scan, heart rate & reaction time.
           </Text>
          
          <StepCard
            title="Stress Survey"
            subtitle="PSS-10 + physiological indicators"
            icon="clipboard-edit-outline"
            iconColor="#6B79F2"
            iconBg="#EEF0FD"
            status={displayStatus(state.survey)}
            weight="50%"
            flag="required"
            dayComplete={dayComplete}
            onPress={() =>
              onNavigate(
                'StressSurvey',
                extras.tools.find((candidate) => candidate.category === 'Multi-Modal'),
              )
            }
          />
          <StepCard
            title="Face Emotion Scan"
            subtitle="AI facial cue detection"
            icon="camera-outline"
            iconColor="#50C8EA"
            iconBg="#E4F7FC"
            status={displayStatus(state.faceScan)}
            weight="20%"
            flag="skippable"
            dayComplete={dayComplete}
            onPress={() => onNavigate('FaceScan')}
          />
          <StepCard
            title="Heart Rate"
            subtitle="Manual 15-second BPM reading"
            icon="heart-outline"
            iconColor="#EE7788"
            iconBg="#FCE9EC"
            status={displayStatus(state.heartRate)}
            weight="20%"
            flag="required"
            dayComplete={dayComplete}
            onPress={() => onNavigate('HeartRate')}
          />
          <StepCard
            title="Reaction Time Game"
            subtitle="Tap-speed cognitive indicator"
            icon="lightning-bolt-outline"
            iconColor="#F2BA24"
            iconBg="#FEF6DB"
            status={displayStatus(state.reaction)}
            weight="20%"
            flag="required"
            dayComplete={dayComplete}
            onPress={() => onNavigate('ReactionGame')}
          />
        </View>

        {/* Tip Box */}
        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>{dayComplete ? 'Note:' : 'Tip:'}</Text>{' '}
            {dayComplete
              ? 'You can retake the assessment tomorrow. Each day produces one score so your trend stays meaningful.'
              : 'Complete all 4 steps for the most accurate stress score. Each step contributes a weighted input to your final analysis.'}
          </Text>
        </View>

        {canViewResults && (
          <TouchableOpacity 
            style={styles.viewResultsBtn}
            onPress={() => onNavigate('Results')}
          >
            <Text style={styles.viewResultsText}>
              {dayComplete ? "View Today's Results" : 'View Final Results'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={tone('#FFF')} />
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.pageBg },
  scrollContent: { padding: Spacing.lg },
  
  header: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.xl },
  headerIconWrap: { 
    width: 88, 
    height: 88, 
    borderRadius: Radius.xl, 
    backgroundColor: toneBg('#7A8DF3'), 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 16
  },
  title: { ...Typography.h1, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...Typography.body1, color: Colors.textSecondary, textAlign: 'center' },

  dayCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: toneBg('#E6F9EF'),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: toneBg('#C8E8D5'),
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: Spacing.lg,
  },
  dayCompleteCopy: { flex: 1 },
  dayCompleteTitle: { fontSize: 15, fontWeight: '800', color: tone('#1F7A45') },
  dayCompleteSub: { fontSize: 12.5, color: tone('#2A5D40'), marginTop: 3, lineHeight: 17 },

  stepsSection: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: Colors.textHint, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  sectionNote: { color: Colors.textHint, fontSize: 12, lineHeight: 17 },
  loadErrorCard: {
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  loadErrorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryButton: {
    backgroundColor: Colors.btnBlue,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  retryButtonText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  progressText: { color: Colors.btnBlue, fontSize: 13, fontWeight: '700' },
  
  stepCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  stepCardLocked: {
    backgroundColor: toneBg('#FDFCFB'),
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  weightBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  weightText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  stepTextContent: { flex: 1 },
  stepTitle: { ...Typography.h3, color: Colors.textPrimary, marginBottom: 2 },
  stepTitleLocked: { color: Colors.textSecondary },
  stepSubtitle: { ...Typography.body2, color: Colors.textSecondary, fontSize: 13 },
  flagPill: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5 },
  flagRequired: { backgroundColor: toneBg('#EEF0FD') },
  flagSkippable: { backgroundColor: toneBg('#FFF3E0') },
  flagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  flagTextRequired: { color: tone('#4C5EE5') },
  flagTextSkippable: { color: tone('#E08A00') },
  statusIndicator: { minWidth: 32, alignItems: 'flex-end', justifyContent: 'center' },
  skippedPill: { backgroundColor: toneBg('#F1F5F9'), borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  skippedPillText: { color: Colors.textHint, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },

  tipBox: {
    flexDirection: 'row',
    backgroundColor: toneBg('#E6F9EF'),
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: toneBg('#C8E8D5'),
  },
  tipIcon: { fontSize: 18, marginRight: 10, marginTop: 2 },
  tipText: { flex: 1, color: tone('#2A5D40'), fontSize: 13, lineHeight: 18 },
  viewResultsBtn: {
    backgroundColor: toneBg('#6B79F2'),
    borderRadius: Radius.full,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: 8,
  },
  viewResultsText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
