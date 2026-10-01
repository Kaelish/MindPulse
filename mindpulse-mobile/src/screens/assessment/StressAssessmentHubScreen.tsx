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

export interface AssessmentState {
  survey: AssessmentStepStatus;
  faceScan: AssessmentStepStatus;
  heartRate: AssessmentStepStatus;
  reaction: AssessmentStepStatus;
  
  // Stored data from modules
  surveyScore?: number;
  faceScanData?: any;
  heartRateBpm?: number;
  reactionTimeMs?: number;
}

const DEFAULT_STATE: AssessmentState = {
  survey: 'unlocked',
  faceScan: 'locked',
  heartRate: 'locked',
  reaction: 'locked',
};

export const loadAssessmentState = async (): Promise<AssessmentState> => {
  try {
    const json = await AsyncStorage.getItem('assessment_state');
    if (json) {
      return JSON.parse(json) as AssessmentState;
    }
  } catch (e) {
    console.error('Failed to load assessment state', e);
  }
  return DEFAULT_STATE;
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
}

const StepCard = ({ title, subtitle, icon, iconColor, iconBg, status, onPress, weight }: StepCardProps) => {
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';

  return (
    <TouchableOpacity
      style={[styles.stepCard, isLocked && styles.stepCardLocked]}
      activeOpacity={isLocked ? 1 : 0.7}
      onPress={() => {
        if (isLocked) {
          Alert.alert('Locked', 'Complete the previous assessment first to unlock this assessment.');
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
}

export const StressAssessmentHubScreen = ({
  onNavigate,
  onExit,
}: {
  onNavigate: (screen: string, tool?: AssessmentTool) => void;
  onExit?: () => void;
}) => {
  const [state, setState] = useState<AssessmentState | null>(null);
  const [extras, setExtras] = useState<HubExtras>({ tools: [], completions: {} });

  useEffect(() => {
    loadAssessmentState().then(setState);
    Promise.all([fetchActiveAssessmentTools(), loadToolCompletions()]).then(([tools, completions]) =>
      setExtras({ tools, completions }),
    );
  }, []);

  if (!state) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.btnBlue} />
      </View>
    );
  }

  const completedCount = [state.survey, state.faceScan, state.heartRate, state.reaction]
    .filter(s => s === 'completed').length;
  // The face scan is a demo excluded from scoring, so it never blocks results —
  // only the three scored steps (survey, heart rate, reaction) are required.
  const canViewResults =
    state.survey === 'completed' &&
    state.heartRate === 'completed' &&
    state.reaction === 'completed';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={Colors.white} />
          </View>
          <Text style={styles.title}>Stress Assessment</Text>
          <Text style={styles.subtitle}>Complete all steps for the most accurate result</Text>
        </View>

        {/* Questionnaires published by the administrator */}
        {extras.tools.length > 0 && (
          <View style={styles.stepsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>AVAILABLE ASSESSMENTS</Text>
              <Text style={styles.progressText}>{extras.tools.length} Tools</Text>
            </View>
            {extras.tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                completedAt={extras.completions[tool.id]}
                onPress={() => {
                  // Multi-Modal tools launch the full 4-step flow (survey →
                  // scan → heart rate → reaction); surveys run standalone.
                  if (tool.category === 'Multi-Modal') onNavigate('StressSurvey');
                  else onNavigate('ToolSurvey', tool);
                }}
              />
            ))}
          </View>
        )}

        {/* Steps List */}
        <View style={styles.stepsSection}>
          <View style={styles.sectionHeaderRow}>
             <Text style={styles.sectionTitle}>ASSESSMENT STEPS</Text>
             <Text style={styles.progressText}>{completedCount}/4 Completed</Text>
          </View>
          
          <StepCard
            title="Stress Survey"
            subtitle="PSS-10 + physiological indicators"
            icon="clipboard-edit-outline"
            iconColor="#6B79F2"
            iconBg="#EEF0FD"
            status={state.survey}
            weight="50%"
            onPress={() => onNavigate('StressSurvey')}
          />
          <StepCard
            title="Face Emotion Scan"
            subtitle="AI facial cue detection"
            icon="camera-outline"
            iconColor="#50C8EA"
            iconBg="#E4F7FC"
            status={state.faceScan}
            weight="20%"
            onPress={() => onNavigate('FaceScan')}
          />
          <StepCard
            title="Heart Rate"
            subtitle="Manual 15-second BPM reading"
            icon="heart-outline"
            iconColor="#EE7788"
            iconBg="#FCE9EC"
            status={state.heartRate}
            weight="20%"
            onPress={() => onNavigate('HeartRate')}
          />
          <StepCard
            title="Reaction Time Game"
            subtitle="Tap-speed cognitive indicator"
            icon="lightning-bolt-outline"
            iconColor="#F2BA24"
            iconBg="#FEF6DB"
            status={state.reaction}
            weight="20%"
            onPress={() => onNavigate('ReactionGame')}
          />
        </View>

        {/* Tip Box */}
        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>Tip:</Text> Complete all 4 steps for the most accurate stress score. Each step contributes a weighted input to your final analysis.
          </Text>
        </View>

        {canViewResults && (
          <TouchableOpacity 
            style={styles.viewResultsBtn}
            onPress={() => onNavigate('Results')}
          >
            <Text style={styles.viewResultsText}>View Final Results</Text>
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

  stepsSection: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: Colors.textHint, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
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
