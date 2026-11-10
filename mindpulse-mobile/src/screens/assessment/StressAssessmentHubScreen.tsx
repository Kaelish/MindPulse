import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography, Radius, Spacing } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AssessmentTool,
  fetchActiveAssessmentTools,
} from '../../services/assessmentTools';
import { requireUserId } from '../../services/session';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';

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
  /** Latest face-scan result: expression label + model confidence (0–1). */
  faceScanData?: { expression: 'happy' | 'neutral' | 'sad'; confidence: number };
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

export const getAssessmentKey = (userId?: string): string =>
  userId ? `assessment_state_${userId}` : 'assessment_state';

export const clearAllAssessmentKeys = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const assessmentKeys = keys.filter(k => k.startsWith('assessment_state'));
    if (assessmentKeys.length > 0) await AsyncStorage.multiRemove(assessmentKeys);
  } catch { /* ignore storage failures */ }
};

export const loadAssessmentState = async (): Promise<AssessmentState> => {
  let userId: string | undefined;
  try {
    userId = await requireUserId();
  } catch {
    userId = undefined;
  }

  let stored: AssessmentState = DEFAULT_STATE;
  try {
    const key = userId ? getAssessmentKey(userId) : 'assessment_state';
    const json = await AsyncStorage.getItem(key);
    if (json) {
      stored = { ...DEFAULT_STATE, ...(JSON.parse(json) as AssessmentState) };
    } else if (userId) {
      return { ...DEFAULT_STATE };
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
  let userId: string | undefined;
  try {
    userId = await requireUserId();
  } catch {
    userId = undefined;
  }
  try {
    if (userId) {
      await AsyncStorage.setItem(getAssessmentKey(userId), JSON.stringify(state));
      await AsyncStorage.removeItem('assessment_state');
    } else {
      await AsyncStorage.setItem('assessment_state', JSON.stringify(state));
    }
  } catch (e) {
    console.error('Failed to save assessment state', e);
  }
};

/**
 * Muted palette for steps that are not available yet. A step is greyed out
 * rather than "locked": the padlock is gone, but the gating is unchanged — a
 * tap still explains what has to be finished first. Values run through
 * tone()/toneBg() so they follow the active theme.
 */
const LOCKED = {
  cardBg: '#FAFBFC',
  iconBg: '#EEF1F5',
  iconFg: '#A9B2C0',
  badge: '#C6CDD9',
  title: '#6B7A99',
  subtitle: '#B0B8C8',
  flagBg: '#F2F4F7',
  flagText: '#9AA3B2',
} as const;

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
  /** Pre-translated flag label (passed by parent so the hub can localize it). */
  flagLabel?: string;
  /** Explains what to finish first when a greyed-out step is tapped. */
  lockedHint?: string;
  /** Today's run is already saved — tapping explains why it is closed. */
  dayComplete?: boolean;
}

const StepCard = ({
  title, subtitle, icon, iconColor, iconBg, status, onPress, weight, flag, flagLabel, lockedHint, dayComplete,
}: StepCardProps) => {
  const { t } = useTranslation();
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
            t.hub.alerts.dayCompleteTitle,
            t.hub.alerts.dayCompleteBody,
          );
        } else if (isLocked) {
          Alert.alert(
            t.hub.alerts.notAvailable,
            lockedHint ?? t.hub.lockedHintDefault,
          );
        } else if (isCompleted) {
          // The checkmark has to mean something: a stray tap must not look
          // like progress was lost. Retaking stays possible mid-run (before
          // the day is saved), but only after an explicit confirmation —
          // new answers replace the old ones.
          Alert.alert(
            t.hub.alerts.completedTitle,
            t.hub.alerts.retakePrompt,
            [
              { text: t.common.cancel, style: 'cancel' },
              { text: t.hub.alerts.retake, onPress },
            ],
          );
        } else {
          onPress();
        }
      }}
    >
      <View style={[styles.iconBox, { backgroundColor: isLocked ? toneBg(LOCKED.iconBg) : iconBg }]}>
        <MaterialCommunityIcons name={icon} size={28} color={isLocked ? tone(LOCKED.iconFg) : iconColor} />
        <View style={[styles.weightBadge, { backgroundColor: isLocked ? tone(LOCKED.badge) : iconColor }]}>
          <Text style={styles.weightText}>{weight}</Text>
        </View>
      </View>
      
      <View style={styles.stepTextContent}>
        <Text style={[styles.stepTitle, isLocked && styles.stepTitleLocked]}>{title}</Text>
        <Text style={[styles.stepSubtitle, isLocked && styles.stepSubtitleLocked]}>{subtitle}</Text>
        {flag && (
          <View style={[styles.flagPill, flag === 'required' ? styles.flagRequired : styles.flagSkippable, isLocked && styles.flagPillLocked]}>
            <Text
              style={[styles.flagText, flag === 'required' ? styles.flagTextRequired : styles.flagTextSkippable, isLocked && styles.flagTextLocked]}
            >
              {flagLabel ?? (flag === 'required' ? t.hub.required : t.hub.skippable)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statusIndicator}>
        {isCompleted && <Ionicons name="checkmark-circle" size={24} color={tone('#4CAF50')} />}
        {status === 'unlocked' && <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />}
        {isSkipped && (
          <View style={styles.skippedPill}>
            <Text style={styles.skippedPillText}>{t.hub.skipped}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

interface HubExtras {
  tools: AssessmentTool[];
}

export const StressAssessmentHubScreen = ({
  onNavigate,
  onExit,
}: {
  onNavigate: (screen: string, tool?: AssessmentTool) => void;
  onExit?: () => void;
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<AssessmentState | null>(null);
  // Fetched so the Stress Survey step below can hand the Multi-Modal tool
  // definition to the survey screen, and (A-4) so admin-published
  // supplementary questionnaires get an entry point into ToolSurveyScreen.
  // The Multi-Modal tool is filtered OUT of that list — it IS the daily
  // survey step, so showing it twice would be a second entry point to the
  // same work (the reason the original standalone tool list was removed).
  const [extras, setExtras] = useState<HubExtras>({ tools: [] });

  useEffect(() => {
    loadAssessmentState().then(setState);
    fetchActiveAssessmentTools().then((result) => setExtras({ tools: result.tools }));
  }, []);

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

  // Admin-published supplementary questionnaires (A-4) — every active tool
  // except the Multi-Modal category the Stress Survey step already covers.
  const supplementaryTools = extras.tools.filter((tool) => tool.category !== 'Multi-Modal');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={Colors.white} />
          </View>
          <Text style={styles.title}>{t.hub.title}</Text>
          <Text style={styles.subtitle}>
            {dayComplete ? t.hub.subtitleDone : t.hub.subtitleReady}
          </Text>
        </View>

        {dayComplete && (
          <View style={styles.dayCompleteBanner}>
            <Ionicons name="checkmark-circle" size={22} color={tone('#FFF')} />
            <View style={styles.dayCompleteCopy}>
              <Text style={styles.dayCompleteTitle}>{t.hub.bannerTitle}</Text>
              <Text style={styles.dayCompleteSub}>
                {t.hub.bannerSub}
              </Text>
            </View>
          </View>
        )}

        {/* Steps List */}
        <View style={styles.stepsSection}>
           <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t.hub.sectionTitle}</Text>
              <Text style={styles.progressText}>
                {dayComplete ? t.hub.completedToday : `${completedCount}/4 ${t.hub.completedSuffix}`}
              </Text>
            </View>
            <Text style={styles.sectionNote}>
              {t.hub.sectionNote}
            </Text>
          
          <StepCard
            title={t.hub.steps.survey.title}
            subtitle={t.hub.steps.survey.subtitle}
            icon="clipboard-edit-outline"
            iconColor="#6B79F2"
            iconBg="#EEF0FD"
            status={displayStatus(state.survey)}
            weight="50%"
            flag="required"
            flagLabel={t.hub.required}
            dayComplete={dayComplete}
            onPress={() =>
              onNavigate(
                'StressSurvey',
                extras.tools.find((candidate) => candidate.category === 'Multi-Modal'),
              )
            }
          />
          <StepCard
            title={t.hub.steps.faceScan.title}
            subtitle={t.hub.steps.faceScan.subtitle}
            icon="camera-outline"
            iconColor="#50C8EA"
            iconBg="#E4F7FC"
            status={displayStatus(state.faceScan)}
            weight="20%"
            flag="skippable"
            flagLabel={t.hub.skippable}
            lockedHint={t.hub.lockedHintFace}
            dayComplete={dayComplete}
            onPress={() => onNavigate('FaceScan')}
          />
          <StepCard
            title={t.hub.steps.heartRate.title}
            subtitle={t.hub.steps.heartRate.subtitle}
            icon="heart-outline"
            iconColor="#EE7788"
            iconBg="#FCE9EC"
            status={displayStatus(state.heartRate)}
            weight="20%"
            flag="required"
            flagLabel={t.hub.required}
            lockedHint={t.hub.lockedHintHeart}
            dayComplete={dayComplete}
            onPress={() => onNavigate('HeartRate')}
          />
          <StepCard
            title={t.hub.steps.reaction.title}
            subtitle={t.hub.steps.reaction.subtitle}
            icon="lightning-bolt-outline"
            iconColor="#F2BA24"
            iconBg="#FEF6DB"
            status={displayStatus(state.reaction)}
            weight="20%"
            flag="required"
            flagLabel={t.hub.required}
            lockedHint={t.hub.lockedHintReaction}
            dayComplete={dayComplete}
            onPress={() => onNavigate('ReactionGame')}
          />
        </View>

        {/* Supplementary assessments (A-4): admin-published questionnaires,
            rendered outside the daily steps because they are optional and save
            their own session instead of feeding the daily fusion score. */}
        {supplementaryTools.length > 0 && (
          <View style={styles.extraToolsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t.hub.extraTools.title}</Text>
            </View>
            <Text style={styles.sectionNote}>{t.hub.extraTools.note}</Text>
            {supplementaryTools.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                style={styles.extraToolCard}
                activeOpacity={0.75}
                onPress={() => onNavigate('ToolSurvey', tool)}
              >
                <View style={styles.extraToolIconWrap}>
                  <MaterialCommunityIcons
                    name="file-document-edit-outline"
                    size={22}
                    color={tone('#6B79F2')}
                  />
                </View>
                <View style={styles.extraToolTextContent}>
                  <Text style={styles.extraToolTitle}>{tool.title}</Text>
                  {!!tool.description && <Text style={styles.extraToolSubtitle}>{tool.description}</Text>}
                  <Text style={styles.extraToolMeta}>
                    {tool.durationMinutes} {t.hub.extraTools.minutes}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tip Box */}
        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>{dayComplete ? t.hub.noteLabel : t.hub.tipLabel}</Text>{' '}
            {dayComplete
              ? t.hub.noteBody
              : t.hub.tipBody}
          </Text>
        </View>

        {canViewResults && (
          <TouchableOpacity 
            style={styles.viewResultsBtn}
            onPress={() => onNavigate('Results')}
          >
            <Text style={styles.viewResultsText}>
              {dayComplete ? t.hub.viewTodayResults : t.hub.viewResults}
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
  // Supplementary assessment cards (A-4) — same visual language as StepCard
  // but without the day-complete state machine: these are optional, always
  // available, and save their own session.
  extraToolsSection: { gap: 12, marginTop: 20 },
  extraToolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: toneBg(Colors.white),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: toneBg('#E4E7F0'),
    padding: 14,
  },
  extraToolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: toneBg('#EEF0FD'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  extraToolTextContent: { flex: 1, marginRight: 8 },
  extraToolTitle: { color: tone('#182033'), fontSize: 15, fontWeight: '700' },
  extraToolSubtitle: { color: tone('#64748b'), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  extraToolMeta: { color: tone('#8b95a5'), fontSize: 12, fontWeight: '600', marginTop: 4 },
  progressText: { color: Colors.btnBlue, fontSize: 13, fontWeight: '700' },
  
  stepCard: {
    backgroundColor: toneBg(Colors.white),
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
    backgroundColor: toneBg(LOCKED.cardBg),
    // No raised shadow while greyed out — keeps it looking inset/inactive.
    shadowOpacity: 0,
    elevation: 0,
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
  stepTitleLocked: { color: tone(LOCKED.title) },
  stepSubtitle: { ...Typography.body2, color: Colors.textSecondary, fontSize: 13 },
  stepSubtitleLocked: { color: tone(LOCKED.subtitle) },
  flagPill: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5 },
  flagRequired: { backgroundColor: toneBg('#EEF0FD') },
  flagSkippable: { backgroundColor: toneBg('#FFF3E0') },
  flagPillLocked: { backgroundColor: toneBg(LOCKED.flagBg) },
  flagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  flagTextRequired: { color: tone('#4C5EE5') },
  flagTextSkippable: { color: tone('#E08A00') },
  flagTextLocked: { color: tone(LOCKED.flagText) },
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
