import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Linking, LayoutChangeEvent } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { loadAssessmentState, saveAssessmentState, markDayComplete, isDayComplete, AssessmentState } from './StressAssessmentHubScreen';
import { saveNewStressSession } from '../../services/dashboard';
import { fetchDoctorPanel, PanelDoctor } from '../../services/appointments';
import {
  actionableTipsFor,
  tipsForBand,
  isToolAction,
  SelfCareAction,
  SelfCareTip,
  ToolAction,
} from '../../services/selfCareTips';
import { CALM_TRACKS } from '../../services/calmAudio';
import { exerciseById, ExerciseId, totalSeconds } from '../../services/guidedExercises';
import { JournalId, journalTemplateById } from '../../services/journal';
import { PAUSE_META } from '../../services/pauseTimer';
import { BoxBreathingModal } from '../../components/BoxBreathingModal';
import { CalmMusicModal } from '../../components/CalmMusicModal';
import { GuidedExerciseModal } from '../../components/GuidedExerciseModal';
import { JournalModal } from '../../components/JournalModal';
import { PauseTimerModal } from '../../components/PauseTimerModal';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';

interface Props {
  onBack: () => void;
  /** Opens the Clinics tab so the patient can book with one of the panel doctors. */
  onBookSession?: () => void;
}

type ResultBand = 'low' | 'moderate' | 'high';

/** Fixed launcher order so the buttons never reshuffle between bands. */
const LAUNCHER_ORDER: ToolAction[] = ['breathe', 'music', 'exercise', 'journal', 'pause'];

/** Presentation for each tool. The tip bank decides *which* show up.
 * Labels/meta/cta are filled in from translations inside the component. */
const TOOL_UI: Record<ToolAction, {
  icon: string;
  material?: boolean;
  bg: string;
  fg: string;
}> = {
  breathe: {
    icon: 'lungs',
    material: true,
    bg: '#E8F0FE',
    fg: '#1976D2',
  },
  music: {
    icon: 'musical-notes-outline',
    fg: '#00897B',
    bg: '#E0F2F1',
  },
  exercise: {
    icon: 'body-outline',
    fg: '#7B1FA2',
    bg: '#F3E5F5',
  },
  journal: {
    icon: 'create-outline',
    fg: '#E65100',
    bg: '#FFF3E0',
  },
  pause: {
    icon: 'eye-off-outline',
    fg: '#455A64',
    bg: '#ECEFF1',
  },
};

export const AssessmentResultScreen: React.FC<Props> = ({ onBack, onBookSession }) => {
  const { t } = useTranslation();
  const [clinicsExpanded, setClinicsExpanded] = useState(false);
  const [stateData, setStateData] = useState<AssessmentState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // "Get Help" reveals the resource cards for a low-stress result (moderate and
  // high already show them) and then scrolls them into view. The button sits at
  // the very bottom of a long screen, so a change that happens above it is
  // invisible unless we actively move the user to it.
  const [helpRequested, setHelpRequested] = useState(false);
  // Verified clinicians listed inside "Find Nearby Psych Clinics".
  const [panel, setPanel] = useState<PanelDoctor[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // Scroll plumbing for Get Help: the resource block's offset inside the content.
  const scrollRef = useRef<ScrollView>(null);
  const helpSectionY = useRef<number | null>(null);
  const pendingHelpScroll = useRef(false);
  const helpScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Self-guided tools behind the advisory suggestions.
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState<string | undefined>(undefined);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalId, setJournalId] = useState<JournalId | undefined>(undefined);
  const [pauseOpen, setPauseOpen] = useState(false);

  // Hotlines sit *inside* the help block, so it needs its own offset too.
  const hotlinesY = useRef<number | null>(null);

  useEffect(() => () => {
    if (helpScrollTimer.current) clearTimeout(helpScrollTimer.current);
  }, []);

  useEffect(() => {
    let alive = true;
    setPanelLoading(true);
    fetchDoctorPanel()
      .then((docs) => {
        if (alive) setPanel(docs);
      })
      .catch(() => {
        // A missing panel must never mask the assessment result itself.
        if (alive) setPanel([]);
      })
      .finally(() => {
        if (alive) setPanelLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    loadAssessmentState().then(setStateData);
  }, []);

  if (!stateData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tone('#6B79F2')} />
      </View>
    );
  }

  // Four inputs, weighted; weights are renormalized over whichever are present.
  const surveyVal = stateData.surveyScore;
  const hrBpm = stateData.heartRateBpm;
  const rxMs = stateData.reactionTimeMs;
  const face = stateData.faceScanData;

  // Face expression → stress (happy low, neutral mid, sad high). Confidence
  // pulls the value toward neutral so an unsure scan barely moves the score.
  const FACE_STRESS: Record<string, number> = { happy: 20, neutral: 50, sad: 80 };
  const faceBase = face ? FACE_STRESS[face.expression] ?? 50 : null;
  const faceVal =
    faceBase != null
      ? Math.round(50 + (faceBase - 50) * Math.min(1, Math.max(0, face?.confidence ?? 0)))
      : null;

  // Re-opening these results after saving must not create a second row today.
  const alreadySavedToday = isDayComplete(stateData);

  // Heart rate → stress (60 bpm baseline; higher bpm = more stress)
  const hrVal = hrBpm != null ? Math.min(100, Math.max(0, (hrBpm - 60) * 2)) : null;
  // Reaction time → stress (250ms baseline; slower reactions = more stress)
  const rxVal = rxMs != null ? Math.min(100, Math.max(0, (rxMs - 250) / 3)) : null;

  const components: { value: number; weight: number }[] = [];
  if (surveyVal != null) components.push({ value: surveyVal, weight: 0.5 });
  if (hrVal != null) components.push({ value: hrVal, weight: 0.2 });
  if (faceVal != null) components.push({ value: faceVal, weight: 0.2 });
  if (rxVal != null) components.push({ value: rxVal, weight: 0.1 });
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const finalScore =
    totalWeight > 0
      ? Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight)
      : 0;

  // Bands match dashboard levelForScore (High > 60, Moderate > 35, Low ≤ 35)
  const isHighStress = finalScore > 60;
  const isModerateStress = finalScore > 35 && finalScore <= 60;
  const isLowStress = finalScore <= 35;

  const showHelpResources = helpRequested || isHighStress || isModerateStress;

  // Every suggestion on this screen comes out of the shared tip bank, so the
  // result page, the Home card and the self-care popup never drift apart.
  const band: ResultBand = isHighStress ? 'high' : isModerateStress ? 'moderate' : 'low';
  const bank = tipsForBand(band);

  // Players get a button in the launcher; routing tips stay as tappable rows in
  // the checklist, because their destination is already on this screen.
  type ToolTip = SelfCareTip & { action: ToolAction };
  const toolTips = actionableTipsFor(band).filter(
    (tip): tip is ToolTip => isToolAction(tip.action),
  );
  const launcherActions = LAUNCHER_ORDER.filter((a) => toolTips.some((t) => t.action === a));
  const exerciseTips = toolTips.filter((t) => t.action === 'exercise');
  const firstExercise = exerciseTips[0]?.toolId
    ? exerciseById(exerciseTips[0].toolId)
    : undefined;
  const exerciseMeta =
    exerciseTips.length > 1
      ? `${exerciseTips.length} available`
      : firstExercise
        ? `${totalSeconds(firstExercise)}s guided`
        : 'Step-by-step';

  // Which prompt does this band's journal tip open? Every band ships exactly
  // one today; the `> 1` branch keeps the button honest if that ever changes.
  const journalTips = toolTips.filter((t) => t.action === 'journal');
  const firstJournalId = journalTips[0]?.journalId;
  const firstJournal = firstJournalId ? journalTemplateById(firstJournalId) : undefined;
  // Always the tip for the prompt actually on screen, not merely the band's first.
  const activeJournalTip = journalTips.find((t) => t.journalId === journalId);
  const journalMeta =
    journalTips.length > 1 ? `${journalTips.length} prompts` : firstJournal?.meta ?? 'On this device';

  /** Default id each launcher button hands to `runAction`. */
  const defaultIdFor = (action: ToolAction): string | undefined =>
    action === 'exercise' ? firstExercise?.id
      : action === 'journal' ? firstJournalId
        : undefined;

  const isRoutingAction = (action?: SelfCareAction): action is 'clinics' | 'hotline' =>
    action === 'clinics' || action === 'hotline';
  const isRoutingTip = (tip: SelfCareTip) => isRoutingAction(tip.action);

  const candidates = bank.filter((tip) => !tip.action || isRoutingTip(tip));
  const picked = candidates.slice(0, 4);
  // A safety-relevant row must never fall outside the cap.
  const readTips = [...picked, ...bank.filter((tip) => isRoutingTip(tip) && !picked.includes(tip))];

  const runAction = (action: SelfCareAction, toolId?: string) => {
    switch (action) {
      case 'breathe':
        setBreathingOpen(true);
        break;
      case 'music':
        setMusicOpen(true);
        break;
      case 'exercise':
        setExerciseId(toolId);
        setExerciseOpen(true);
        break;
      case 'journal':
        setJournalId(toolId ? (toolId as JournalId) : undefined);
        setJournalOpen(true);
        break;
      case 'pause':
        setPauseOpen(true);
        break;
      case 'clinics':
        goToClinics();
        break;
      case 'hotline':
        goToHotlines();
        break;
    }
  };

  const jumpToHelp = () => {
    if (helpSectionY.current == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, helpSectionY.current - 8), animated: true });
  };

  const handleGetHelp = () => {
    setHelpRequested(true);
    setClinicsExpanded(true);

    pendingHelpScroll.current = true;
    if (helpScrollTimer.current) clearTimeout(helpScrollTimer.current);
    // Fallback for when the cards are already mounted: the block may not resize,
    // so its onLayout never re-fires — nudge the scroll once the reveal settles.
    helpScrollTimer.current = setTimeout(() => {
      if (!pendingHelpScroll.current) return;
      pendingHelpScroll.current = false;
      jumpToHelp();
    }, 350);
  };

  // The accurate moment to scroll: the block just mounted (low stress) or the
  // clinics list expanded. Beats the timer above, so it cancels it.
  const handleHelpSectionLayout = (e: LayoutChangeEvent) => {
    helpSectionY.current = e.nativeEvent.layout.y;
    if (!pendingHelpScroll.current) return;
    pendingHelpScroll.current = false;
    if (helpScrollTimer.current) clearTimeout(helpScrollTimer.current);
    requestAnimationFrame(jumpToHelp);
  };

  /**
   * "Book a session" → the Clinics tab. Falls back to opening the on-page panel
   * when no tab handler is wired up, so the row can never be a dead button.
   */
  const goToClinics = () => {
    if (onBookSession) {
      requestBookSession();
      return;
    }
    setClinicsExpanded(true);
    if (helpSectionY.current != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, helpSectionY.current - 8), animated: true });
    } else {
      handleGetHelp();
    }
  };

  /**
   * "Use the free hotlines" → the hotlines card further down. Its offset is
   * relative to the help block, so the two measured values are added together.
   */
  const goToHotlines = () => {
    const wrapper = helpSectionY.current;
    const inner = hotlinesY.current;
    if (wrapper != null && inner != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, wrapper + inner - 8), animated: true });
      return;
    }
    // Block not laid out (or hidden at low stress): reveal it instead of doing nothing.
    handleGetHelp();
  };

  const getTheme = () => {
    if (isLowStress) return { bg: toneBg('#E8F5E9'), text: tone('#2E7D32'), pillBg: toneBg('#4CAF50'), pillText: tone('#FFF'), label: t.results.bandLow };
    if (isModerateStress) return { bg: toneBg('#FFF3E0'), text: tone('#E65100'), pillBg: toneBg('#FF9800'), pillText: tone('#FFF'), label: t.results.bandModerate };
    return { bg: toneBg('#FDECE6'), text: tone('#D32F2F'), pillBg: toneBg('#F44336'), pillText: tone('#FFF'), label: t.results.bandHigh };
  };

  const theme = getTheme();

  /** Band-specific UI copy from translations. */
  const launcherCopy = {
    low: { title: t.results.launcher.low.title, sub: t.results.launcher.low.sub },
    moderate: { title: t.results.launcher.moderate.title, sub: t.results.launcher.moderate.sub },
    high: { title: t.results.launcher.high.title, sub: t.results.launcher.high.sub },
  };

  /** Tool launcher UI from translations. */
  const toolUi = (() => {
    const base = TOOL_UI;
    return {
      breathe: { ...base.breathe, label: t.results.tools.breathe.label, meta: '4·4·4·4 guided · 5 min', cta: t.results.tools.breathe.cta },
      music: { ...base.music, label: t.results.tools.music.label, meta: t.results.tools.music.metaFmt.replace('{n}', String(CALM_TRACKS.length)), cta: t.results.tools.music.cta },
      exercise: { ...base.exercise, label: t.results.tools.exercise.label, meta: '', cta: t.results.tools.exercise.cta },
      journal: { ...base.journal, label: t.results.tools.journal.label, meta: '', cta: t.results.tools.journal.cta },
      pause: { ...base.pause, label: t.results.tools.pause.label, meta: PAUSE_META, cta: t.results.tools.pause.cta },
    };
  })();

  /**
   * `after` runs only when the save actually succeeded — used when saving is a
   * detour on the way to somewhere else (booking a session). Left undefined it
   * does the usual thing and returns to the hub.
   *
   * Must always be called as `handleSaveResult()`: React Native passes the press
   * event as the first argument, which would otherwise be taken for `after`.
   */
  const handleSaveResult = async (after?: () => void) => {
    if (alreadySavedToday || isSaving) return;
    setIsSaving(true);
    try {
      // Same notes shape the standalone tools use ("Completed assessment: …")
      // so the doctor's session footer reads consistently across every flow,
      // and the raw answers ride along so item-level review works here too.
      const snapshot = stateData.surveyAnswersSnapshot;
      const assessmentName = snapshot?.toolTitle ?? t.toolSurvey.completeAssessment;
      await saveNewStressSession(
        finalScore,
        `${t.toolSurvey.completeAssessment}: ${assessmentName} (multi-modal). HR: ${hrBpm ?? 'n/a'} bpm, Reaction: ${rxMs ?? 'n/a'} ms, Face: ${face?.expression ?? 'n/a'}`,
        hrBpm,
        surveyVal,
            rxMs,
            face ? Math.round(Math.min(1, Math.max(0, face.confidence)) * 100) : undefined,
            snapshot ?? null,
      );

      // Today is now spent: keep the numbers for review, close every step, and
      // let the hub show "Today's assessment is complete!" until midnight.
      const completed = markDayComplete(stateData);
      await saveAssessmentState(completed);
      // Mirror it into this screen's own state as well. Navigation below
      // unmounts us today, but the double-save guard should not *depend* on
      // that: with `completedOn` set locally, the button reads "Saved for
      // today" and stays disabled even if we somehow remain mounted.
      setStateData(completed);

      if (after) after();
      else onBack();
    } catch (e: any) {
      // Reachable only when the insert itself failed. saveAssessmentState
      // swallows its own errors, and every step after the insert inside
      // saveNewStressSession is non-throwing (prefs, notification and plant
      // writes are all best-effort) — so no row exists on this path and a
      // retry writes exactly one, never two.
      Alert.alert(t.results.errorTitle, e?.message ?? t.results.errorBody);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Every route off this screen toward the Clinics tab passes through here.
   *
   * Switching tabs unmounts AssessmentNavigator (App.tsx renders it under
   * `currentTab === 'analysis'`), which drops the navigator's local `screen`
   * state — so an unsaved result loses not just its data but the amber banner
   * warning about it. The result stays reachable from the hub via
   * `canViewResults`, so this is a warning gap rather than data loss: make the
   * user choose instead of walking them out of the room silently.
   *
   * Already saved (or saving) means there is nothing to lose — go straight
   * through, so the prompt never becomes a tax on an ordinary booking.
   */
  const requestBookSession = () => {
    if (!onBookSession) return;
    if (alreadySavedToday || isSaving) {
      onBookSession();
      return;
    }
    Alert.alert(
      t.results.saveFirstTitle,
      t.results.saveFirstBody,
      [
        {
          text: t.results.saveAndBook,
          onPress: () => handleSaveResult(() => onBookSession!()),
        },
        {
          text: t.results.leaveWithoutSaving,
          style: 'destructive',
          onPress: onBookSession,
        },
        { text: t.common.cancel, style: 'cancel' },
      ],
    );
  };

  return (
    <StressAnalysisLayout
      activeModule="reaction"
      heartRateDone
      onBack={onBack}
      scrollViewRef={scrollRef}
    >
      {/* Final Stress Score Card */}
      <View style={[styles.scoreCard, { backgroundColor: theme.bg }]}>
        <Text style={styles.scoreTitle}>{t.results.finalScore}</Text>
        
        <View style={styles.scoreContent}>
          <View style={[styles.scoreCircle, { borderColor: theme.pillBg }]}>
            <Text style={[styles.scoreNumber, { color: theme.text }]}>{finalScore}</Text>
            <Text style={styles.scoreOutof}>{t.results.outOf100}</Text>
          </View>
          
          <View style={styles.scoreLegend}>
            <View style={[styles.scorePill, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.scorePillText, { color: theme.pillText }]}>{theme.label}</Text>
            </View>
            
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: toneBg('#4CAF50') }]} />
              <Text style={styles.legendText}>{t.results.legendLow}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: toneBg('#FF9800') }]} />
              <Text style={styles.legendText}>{t.results.legendModerate}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: toneBg('#F44336') }]} />
              <Text style={styles.legendText}>{t.results.legendHigh}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Multi-Modal Fusion Card */}
      <View style={styles.fusionCard}>
        <Text style={styles.fusionTitle}>{t.results.fusionTitle}</Text>

        {surveyVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>{t.results.fusionSurvey}</Text>
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#E8EAF6') }]}><Text style={[styles.fusionBadgeText, { color: tone('#3F51B5') }]}>50%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, surveyVal))}%`, backgroundColor: toneBg('#5C6BC0') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#3F51B5') }]}>{Math.round(surveyVal)}</Text>
          </View>
        )}

        {/* Face scan result — 20% of the score when the step was completed */}
        {faceVal != null && face && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>{t.results.fusionFace} ({face.expression})</Text>
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#FFF3E0') }]}><Text style={[styles.fusionBadgeText, { color: tone('#E08A00') }]}>20%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, faceVal))}%`, backgroundColor: toneBg('#FB8C00') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#E08A00') }]}>{faceVal}</Text>
          </View>
        )}

        {hrVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>{t.results.fusionHeartRate}</Text>
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#FFEBEE') }]}><Text style={[styles.fusionBadgeText, { color: tone('#F44336') }]}>20%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, hrVal))}%`, backgroundColor: toneBg('#EF5350') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#F44336') }]}>{Math.round(hrVal)}</Text>
          </View>
        )}

        {rxVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>{t.results.fusionReaction}</Text>
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#FFF8E1') }]}><Text style={[styles.fusionBadgeText, { color: tone('#FFB300') }]}>10%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, rxVal))}%`, backgroundColor: toneBg('#FFA000') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#FFB300') }]}>{Math.round(rxVal)}</Text>
          </View>
        )}
      </View>

      {/* Advisory Card */}
      {isLowStress ? (
        <View style={[styles.advisoryCard, { backgroundColor: toneBg('#E8F5E9') }]}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="leaf-outline" size={28} color={tone('#2E7D32')} />
            <Text style={[styles.advisoryTitle, { color: tone('#2E7D32') }]}>{t.results.advisoryLowTitle}</Text>
          </View>
          <Text style={styles.advisoryBody}>
            {t.results.advisoryLowBody}
          </Text>
          {readTips.map((tip) => {
            const routing = isRoutingTip(tip);
            return (
              <TouchableOpacity
                key={tip.title}
                style={styles.advisoryCheck}
                disabled={!routing}
                onPress={routing ? () => runAction(tip.action as SelfCareAction) : undefined}
                activeOpacity={0.65}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={tone('#2E7D32')} />
                <Text style={styles.advisoryCheckText}>{tip.title}</Text>
                {routing && (
                  <>
                    <View style={styles.advisorySpacer} />
                    <View style={styles.advisoryGo}>
                      <Text style={[styles.advisoryGoText, { color: tone('#2E7D32') }]}>
                        {tip.action === 'clinics' ? 'Open' : 'Go'}
                      </Text>
                      <Ionicons name="arrow-forward" size={12} color={tone('#2E7D32')} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={[styles.advisoryCard, { backgroundColor: toneBg('#FDECE6') }]}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="warning-outline" size={28} color={tone('#D32F2F')} />
            <Text style={[styles.advisoryTitle, { color: tone('#D32F2F') }]}>{t.results.advisoryElevatedTitle}</Text>
          </View>
          <Text style={styles.advisoryBody}>
            {t.results.advisoryElevatedBody}
          </Text>
          {readTips.map((tip) => {
            const routing = isRoutingTip(tip);
            return (
              <TouchableOpacity
                key={tip.title}
                style={styles.advisoryCheck}
                disabled={!routing}
                onPress={routing ? () => runAction(tip.action as SelfCareAction) : undefined}
                activeOpacity={0.65}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={tone('#D32F2F')} />
                <Text style={styles.advisoryCheckText}>{tip.title}</Text>
                {routing && (
                  <>
                    <View style={styles.advisorySpacer} />
                    <View style={styles.advisoryGo}>
                      <Text style={[styles.advisoryGoText, { color: tone('#D32F2F') }]}>
                        {tip.action === 'clinics' ? 'Open' : 'Go'}
                      </Text>
                      <Ionicons name="arrow-forward" size={12} color={tone('#D32F2F')} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Self-guided versions of the advice above — no booking, no saving. */}
      {toolTips.length > 0 && (
        <View style={styles.toolsCard}>
          <Text style={styles.toolsTitle}>{launcherCopy[band].title}</Text>
          <Text style={styles.toolsSub}>{launcherCopy[band].sub}</Text>
          <View style={styles.toolsRow}>
            {launcherActions.map((action) => {
              const ui = toolUi[action];
              const meta =
                action === 'exercise' ? exerciseMeta
                  : action === 'journal' ? journalMeta
                    : ui.meta;
              return (
                <TouchableOpacity
                  key={action}
                  style={styles.toolBtn}
                  onPress={() => runAction(action, defaultIdFor(action))}
                  activeOpacity={0.8}
                >
                  <View style={[styles.toolIcon, { backgroundColor: toneBg(ui.bg) }]}>
                    {ui.material ? (
                      <MaterialCommunityIcons name={ui.icon as any} size={22} color={tone(ui.fg)} />
                    ) : (
                      <Ionicons name={ui.icon as any} size={22} color={tone(ui.fg)} />
                    )}
                  </View>
                  <Text style={styles.toolName}>{ui.label}</Text>
                  <Text style={styles.toolMeta}>{meta}</Text>
                  <View style={[styles.toolGo, { backgroundColor: toneBg(ui.fg) }]}>
                    <Ionicons name="play" size={12} color={tone('#FFF')} />
                    <Text style={styles.toolGoText}>{ui.cta}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Conditional Resources */}
      {showHelpResources && (
        <View onLayout={handleHelpSectionLayout}>
          <View style={styles.clinicsCard}>
            <TouchableOpacity 
              style={styles.clinicsHeader} 
              onPress={() => setClinicsExpanded(!clinicsExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.clinicsIconWrap}>
                <Ionicons name="location-outline" size={20} color={tone('#FFF')} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.clinicsTitle}>{t.results.clinics.title}</Text>
                <Text style={styles.clinicsSub}>{t.results.clinics.sub}</Text>
              </View>
              <Ionicons name={clinicsExpanded ? "chevron-up" : "chevron-forward"} size={20} color={tone('#D32F2F')} />
            </TouchableOpacity>

            {clinicsExpanded && (
              <View style={styles.clinicsContent}>
                {panelLoading && (
                  <ActivityIndicator size="small" color={tone('#D32F2F')} style={{ marginVertical: 14 }} />
                )}

                {!panelLoading && panel.length === 0 && (
                  <Text style={styles.clinicsEmpty}>
                    {t.results.clinics.empty}
                  </Text>
                )}

                {/* Real verified clinicians — tap a row to open the Clinics tab */}
                {!panelLoading &&
                  panel.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      style={styles.clinicItem}
                      onPress={requestBookSession}
                      disabled={!onBookSession}
                      activeOpacity={0.75}
                    >
                      <View style={styles.doctorAvatar}>
                        {doc.avatarUrl ? (
                          <Image source={{ uri: doc.avatarUrl }} style={styles.doctorAvatarImage} />
                        ) : (
                          <Text style={styles.doctorAvatarText}>
                            {doc.name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.clinicInfo, { marginHorizontal: 10 }]}>
                        <Text style={styles.clinicName}>{doc.name}</Text>
                        <Text style={styles.clinicHours} numberOfLines={1}>{doc.specialty}</Text>
                        <View style={styles.clinicTag}>
                          <Text style={styles.clinicTagText}>{t.results.clinics.tapToView}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={tone('#D32F2F')} />
                    </TouchableOpacity>
                  ))}

                {onBookSession && (
                  <TouchableOpacity style={styles.doctorBookBtn} onPress={requestBookSession} activeOpacity={0.85}>
                    <Text style={styles.doctorBookText}>{t.results.clinics.openToBook}</Text>
                    <Ionicons name="arrow-forward" size={16} color={tone('#FFF')} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View
            style={styles.hotlinesCard}
            onLayout={(e) => {
              hotlinesY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.hotlinesTitle}>{t.results.hotlinesTitle}</Text>
            
            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:988').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#F44336') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>National Crisis Hotline</Text>
                <Text style={styles.hotlineDesc}>988 • 24/7 free & confidential</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:09178001123').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#FF9800') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>In Touch Crisis Line (PH)</Text>
                <Text style={styles.hotlineDesc}>0917-800-1123 • 24/7 support</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:1553').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#9C27B0') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>NCMH Crisis Hotline</Text>
                <Text style={styles.hotlineDesc}>1553 • Free, Mon-Fri 8AM - 5PM</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('sms:741741').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#03A9F4') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>Crisis Text Line</Text>
                <Text style={styles.hotlineDesc}>Text HOME to 741741 • Text-based support</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Not-saved indicator + actions. Get Help deliberately does NOT record
          anything — only Save Result writes the session to the backend. */}
      {!alreadySavedToday && !isSaving && (
        <View style={styles.unsavedBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={tone('#B26A00')} />
          <Text style={styles.unsavedText}>
            {t.results.unsaved}
          </Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={[styles.saveBtn, (isSaving || alreadySavedToday) && { opacity: 0.7 }]} 
          onPress={() => handleSaveResult()}
          disabled={isSaving || alreadySavedToday}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? t.results.saveSaving : alreadySavedToday ? t.results.saveSavedToday : t.results.saveAction}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.helpBtn, helpRequested && styles.helpBtnActive]}
          onPress={handleGetHelp}
        >
          <Text style={styles.helpBtnText}>{helpRequested ? t.results.helpShown : t.results.getHelp}</Text>
          <Ionicons
            name={helpRequested ? 'checkmark-circle' : 'arrow-forward'}
            size={16}
            color={tone('#FFF')}
          />
        </TouchableOpacity>
      </View>

      {/* Skipping is always allowed: the raw numbers stay on the device, so the
          patient can reopen "View Final Results" and save later. */}
      {!alreadySavedToday && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={onBack}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          <Text style={styles.skipBtnText}>{t.results.dontSave}</Text>
        </TouchableOpacity>
      )}

      {/* Self-guided tools — independent of saving, always closable. */}
      <BoxBreathingModal visible={breathingOpen} onClose={() => setBreathingOpen(false)} />
      <CalmMusicModal visible={musicOpen} onClose={() => setMusicOpen(false)} />
      <GuidedExerciseModal
        visible={exerciseOpen}
        onClose={() => setExerciseOpen(false)}
        exerciseIds={exerciseTips.map((t) => t.toolId).filter((id): id is ExerciseId => !!id)}
        initialId={exerciseId}
      />
      <JournalModal
        visible={journalOpen}
        onClose={() => setJournalOpen(false)}
        templateId={journalId}
        hint={activeJournalTip?.desc}
      />
      <PauseTimerModal visible={pauseOpen} onClose={() => setPauseOpen(false)} />

    </StressAnalysisLayout>
  );
};

const makeStyles = () => StyleSheet.create({
  scoreCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  scoreTitle: { fontSize: 16, fontWeight: '700', color: tone('#666'), textAlign: 'center', marginBottom: 16 },
  scoreContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: toneBg('#FFF') },
  scoreNumber: { fontSize: 40, fontWeight: '900' },
  scoreOutof: { fontSize: 12, color: tone('#888'), marginTop: -4 },
  scoreLegend: { gap: 8 },
  scorePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4 },
  scorePillText: { fontSize: 12, fontWeight: '800' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { fontSize: 11, color: tone('#666') },

  fusionCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: toneBg('#EEE') },
  fusionTitle: { fontSize: 14, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 16 },
  fusionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  fusionLabelRow: { width: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  fusionLabel: { fontSize: 11, color: tone('#888') },
  fusionBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  fusionBadgeText: { fontSize: 8, fontWeight: '800' },
  fusionTrack: { flex: 1, height: 6, backgroundColor: toneBg('#E0E0E0'), borderRadius: 3, marginHorizontal: 8 },
  fusionFill: { height: '100%', borderRadius: 3 },
  fusionScore: { fontSize: 12, fontWeight: '800', width: 24, textAlign: 'right' },

  advisoryCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  advisoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  advisoryTitle: { fontSize: 18, fontWeight: '800' },
  advisoryBody: { fontSize: 13, color: tone('#666'), lineHeight: 20, marginBottom: 16 },
  advisoryCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  advisoryCheckText: { fontSize: 12, color: tone('#555') },
  // Present only on checklist rows that navigate (routing tips).
  advisorySpacer: { flex: 1 },
  advisoryGo: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  advisoryGoText: { fontSize: 11, fontWeight: '800' },

  toolsCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: toneBg('#EEE') },
  toolsTitle: { fontSize: 15, fontWeight: '800', color: tone('#1A1A1A') },
  toolsSub: { fontSize: 12, color: tone('#777'), lineHeight: 17, marginTop: 4, marginBottom: 14 },
  toolsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  // Two per row at every supported width (47%*2 + 10px gap always fits), and
  // centering each wrapped line leaves a fifth button sitting neatly on its
  // own row instead of hugging the left edge.
  toolBtn: { width: '47%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 14, backgroundColor: toneBg('#F7F8FC'), borderWidth: 1, borderColor: toneBg('#ECEEF5') },
  toolIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  toolName: { fontSize: 13, fontWeight: '800', color: tone('#1A1A1A'), textAlign: 'center' },
  toolMeta: { fontSize: 10.5, color: tone('#8A8A8A'), marginTop: 3, textAlign: 'center' },
  toolGo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, backgroundColor: toneBg('#6B79F2'), paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  toolGoText: { fontSize: 11, fontWeight: '800', color: tone('#FFF') },

  clinicsCard: { backgroundColor: toneBg('#FDECE6'), borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  clinicsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  clinicsIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: toneBg('#E53935'), alignItems: 'center', justifyContent: 'center' },
  clinicsTitle: { fontSize: 14, fontWeight: '800', color: tone('#D32F2F') },
  clinicsSub: { fontSize: 11, color: tone('#D32F2F') },
  clinicsContent: { padding: 16, paddingTop: 0 },
  clinicsEmpty: { fontSize: 12, color: tone('#8A6A6A'), marginVertical: 12, lineHeight: 18 },
  clinicItem: { backgroundColor: toneBg('#FFF'), borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clinicInfo: { flex: 1 },
  clinicName: { fontSize: 13, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 2 },
  clinicHours: { fontSize: 11, color: tone('#888'), marginBottom: 4 },
  clinicTag: { backgroundColor: toneBg('#FDECE6'), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  clinicTagText: { fontSize: 9, color: tone('#D32F2F'), fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#E53935'), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: 4 },
  callBtnText: { color: tone('#FFF'), fontSize: 12, fontWeight: '700', marginLeft: 4 },
  clinicDist: { fontSize: 10, color: tone('#D32F2F'), fontWeight: '600' },

  doctorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: toneBg('#FDECE6'), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  doctorAvatarText: { fontSize: 13, fontWeight: '800', color: tone('#D32F2F') },
  doctorAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  doctorBookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, backgroundColor: toneBg('#D32F2F'), borderRadius: 23, marginTop: 14 },
  doctorBookText: { color: tone('#FFF'), fontSize: 14, fontWeight: '700' },

  hotlinesCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: toneBg('#EEE') },
  hotlinesTitle: { fontSize: 14, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 16 },
  hotlineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hotlineIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hotlineTextWrap: { flex: 1, marginLeft: 12 },
  hotlineName: { fontSize: 13, fontWeight: '800', color: tone('#1A1A1A') },
  hotlineDesc: { fontSize: 11, color: tone('#666'), marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  unsavedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: toneBg('#FFF8E1'), borderWidth: 1, borderColor: toneBg('#FFE082'), borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  unsavedText: { flex: 1, fontSize: 12, lineHeight: 17, color: tone('#B26A00'), fontWeight: '600' },
  saveBtn: { flex: 1, height: 50, backgroundColor: toneBg('#81C784'), borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: tone('#FFF'), fontSize: 14, fontWeight: '700' },
  helpBtn: { flex: 1, height: 50, backgroundColor: toneBg('#6B79F2'), borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  helpBtnActive: { backgroundColor: toneBg('#3F51B5') },
  helpBtnText: { color: tone('#FFF'), fontSize: 14, fontWeight: '700' },
  skipBtn: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: toneBg('#D0D0D0'), backgroundColor: toneBg('#FFF'), marginTop: 4 },
  skipBtnText: { fontSize: 13, fontWeight: '600', color: tone('#777') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
