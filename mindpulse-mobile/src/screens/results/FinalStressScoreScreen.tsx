import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { ReactionResult } from '../reaction/ReactionGameScreen';
import {
  heartRateStress as heartRateToStress,
  reactionStress as reactionToStress,
} from '../../services/stressFormula';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';

interface Props {
  heartRate: number;
  reaction: ReactionResult;
  onBack: () => void;
  onDone: (score: number) => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

type BandKey = 'high' | 'moderate' | 'low';

// Bands match dashboard levelForScore (High > 60, Moderate > 35, Low ≤ 35).
// Palette only — the label/body copy lives in the dictionaries so it follows
// the selected language.
const getLevel = (score: number) => {
  if (score > 60) return {
    band: 'high' as const,
    color: tone('#E05C5C'), bg: toneBg('#FFD6D6'),
    ringColor: tone('#E05C5C'), lightBg: toneBg('#FFF0F0'),
    isHigh: true,
  };
  if (score > 35) return {
    band: 'moderate' as const,
    color: tone('#E08A00'), bg: toneBg('#FFF3CD'),
    ringColor: tone('#F5C842'), lightBg: toneBg('#FFFBE6'),
    isHigh: false,
  };
  return {
    band: 'low' as const,
    color: tone('#27AE60'), bg: toneBg('#D6F5E3'),
    ringColor: tone('#27AE60'), lightBg: toneBg('#EBF9F2'),
    isHigh: false,
  };
};

// ── Score ring (circular border) ──
const ScoreRing = ({ score, color }: { score: number; color: string }) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={styles.scoreNum}>{score}</Text>
      <Text style={styles.scoreOutOf}>{t.results.outOf100}</Text>
    </View>
  );
};

// ── Horizontal bar signal ──
const FusionBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.fusionRow}>
    <View style={styles.fusionMeta}>
      <Text style={styles.fusionLabel}>{label}</Text>
      <Text style={[styles.fusionPct, { color }]}>{value}%</Text>
    </View>
    <View style={styles.fusionTrack}>
      <View style={[styles.fusionFill, { width: `${value}%` as any, backgroundColor: color }]} />
    </View>
  </View>
);

// ── Hotline row ──
const HotlineRow = ({
  name, number, color, tel,
}: { name: string; number: string; color: string; tel: string }) => (
  <TouchableOpacity
    style={styles.hotlineRow}
    activeOpacity={0.7}
    onPress={() => Linking.openURL(tel).catch(() => {})}
  >
    <View style={[styles.hotlineIcon, { backgroundColor: color }]}>
      <Ionicons name="call" size={14} color={tone('#FFF')} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.hotlineName}>{name}</Text>
      <Text style={styles.hotlineNum}>{number}</Text>
    </View>
  </TouchableOpacity>
);

// Displayed split of the renormalized canonical weights in this two-indicator
// flow (0.2 / 0.1 over 0.3 → 67% / 33%); the score itself uses the exact
// fractions above. Shown in the fusion-card title so the patient is told the
// real weighting.
const HR_FUSION_PCT = Math.round((0.2 / 0.3) * 100);
const RX_FUSION_PCT = 100 - HR_FUSION_PCT;

export const FinalStressScoreScreen: React.FC<Props> = ({
  heartRate, reaction, onBack, onDone, onNavigateTab,
}) => {
  const { t } = useTranslation();
  // Canonical formula (services/stressFormula.ts, A-6): this standalone flow
  // collects only heart rate + reaction, so the hub's canonical weights
  // (HR 0.2, reaction 0.1) renormalize over those two indicators. The old
  // |bpm−70|×1.5 transform and 40/60 blend are gone — the same measurements
  // now produce the same number here as in the saved session.
  const heartRateStress = heartRateToStress(heartRate);
  const reactionStress = reactionToStress(reaction.average);
  // Weighted stress score — higher = more stress, same convention as saved sessions
  const score = Math.round(heartRateStress * (0.2 / 0.3) + reactionStress * (0.1 / 0.3));
  const level = getLevel(score);
  const levelLabel: Record<BandKey, string> = {
    high: t.results.bandHigh,
    moderate: t.results.bandModerate,
    low: t.results.bandLow,
  };
  const levelMessage: Record<BandKey, string> = {
    high: t.finalScore.bandHighBody,
    moderate: t.finalScore.bandModerateBody,
    low: t.finalScore.bandLowBody,
  };
  const activeTab = 'analysis' as const;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Stress Analysis chrome header */}
      <StressAnalysisLayout
        activeModule="reaction"
        heartRateDone
        onBack={onBack}
        subtitle={t.finalScore.subtitle}
      >
        {/* ── Score card ── */}
        <View style={styles.scoreCard}>
          <Text style={styles.sectionTitle}>{t.results.finalScore}</Text>
          <View style={styles.scoreRow}>
            <ScoreRing score={score} color={level.ringColor} />
            <View style={styles.scoreGuide}>
              <View style={[styles.levelPill, { backgroundColor: level.bg }]}>
                <Text style={[styles.levelPillText, { color: level.color }]}>{levelLabel[level.band]}</Text>
              </View>
              <Text style={styles.levelGuideRow}>
                <Ionicons name="ellipse" size={8} color={tone('#E05C5C')} /> {t.finalScore.guideHigh}
              </Text>
              <Text style={styles.levelGuideRow}>
                <Ionicons name="ellipse" size={8} color={tone('#E08A00')} /> {t.finalScore.guideModerate}
              </Text>
              <Text style={styles.levelGuideRow}>
                <Ionicons name="ellipse" size={8} color={tone('#27AE60')} /> {t.finalScore.guideLow}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Multi-Modal Fusion bars ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t.finalScore.fusionTitleFmt
              .replace('{hr}', String(HR_FUSION_PCT))
              .replace('{rx}', String(RX_FUSION_PCT))}
          </Text>
          <FusionBar label={t.results.fusionHeartRate} value={heartRateStress} color={tone('#E05C5C')} />
          <FusionBar label={t.results.fusionReaction} value={reactionStress} color={tone('#F5A623')} />
        </View>

        {/* ── Guidance card ── */}
        <View style={[styles.guidanceCard, { backgroundColor: level.lightBg, borderColor: level.bg }]}>
          <View style={styles.guidanceHeader}>
            <Ionicons
              name={level.isHigh ? 'warning' : 'leaf'}
              size={20}
              color={level.color}
            />
            <Text style={[styles.guidanceTitle, { color: level.color }]}>
              {level.isHigh ? t.results.advisoryElevatedTitle : t.results.advisoryLowTitle}
            </Text>
          </View>
          <Text style={styles.guidanceBody}>{levelMessage[level.band]}</Text>
          {level.isHigh ? (
            <>
              <GuidanceBullet text={t.finalScore.bulletsHigh.rest} color={level.color} />
              <GuidanceBullet text={t.finalScore.bulletsHigh.breathe} color={level.color} />
              <GuidanceBullet text={t.finalScore.bulletsHigh.counselor} color={level.color} />
              <GuidanceBullet text={t.finalScore.bulletsHigh.telehealth} color={level.color} />
            </>
          ) : (
            <>
              <GuidanceBullet text={t.finalScore.bulletsLow.sleep} color={level.color} />
              <GuidanceBullet text={t.finalScore.bulletsLow.hydrate} color={level.color} />
              <GuidanceBullet text={t.finalScore.bulletsLow.activities} color={level.color} />
            </>
          )}
        </View>

        {/* ── Verified help in-app ── */}
        <TouchableOpacity
          style={styles.clinicCard}
          onPress={() => onNavigateTab?.('clinics')}
          disabled={!onNavigateTab}
          activeOpacity={0.75}
        >
          <View style={styles.clinicHeaderRow}>
            <Ionicons name="people" size={16} color={tone('#E05C5C')} />
            <Text style={styles.clinicCardTitle}>{t.finalScore.clinicTitle}</Text>
          </View>
          <Text style={styles.clinicCardSub}>{t.finalScore.clinicSub}</Text>
        </TouchableOpacity>

        {/* ── Emergency Hotlines ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.results.hotlinesTitle}</Text>
          {/* Names are official organization names — only the descriptions localize. */}
          <HotlineRow name="National Crisis Hotline" number={t.results.hotlineDescs.finalNational} color={toneBg('#E05C5C')} tel="tel:988" />
          <HotlineRow name="In Touch Crisis Line (PH)" number={t.results.hotlineDescs.finalInTouch} color={toneBg('#F5A623')} tel="tel:09175584673" />
          <HotlineRow name="NCMH Crisis Hotline" number={t.results.hotlineDescs.finalNcmh} color={toneBg('#5B6EF5')} tel="tel:1553" />
          <HotlineRow name="Crisis Text Line" number={t.results.hotlineDescs.finalCrisisText} color={toneBg('#4A90D9')} tel="sms:741741" />
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={() => onDone(score)}>
            <Text style={styles.saveBtnText}>{t.results.saveAction}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpBtn} onPress={() => onDone(score)}>
            <Text style={styles.helpBtnText}>{t.finalScore.getHelp}</Text>
          </TouchableOpacity>
        </View>
      </StressAnalysisLayout>
    </SafeAreaView>
  );
};

const GuidanceBullet = ({ text, color }: { text: string; color: string }) => (
  <View style={styles.bulletRow}>
    <Ionicons name="checkmark-circle" size={14} color={color} style={{ marginTop: 1 }} />
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },

  /* Score card */
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  scoreRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  scoreNum: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 48,
  },
  scoreOutOf: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  scoreGuide: { flex: 1, gap: 6 },
  levelPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  levelPillText: { fontSize: 12, fontWeight: '700' },
  levelGuideRow: { fontSize: 11, color: Colors.textSecondary, lineHeight: 18 },

  /* Cards */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  cardTitle: { ...Typography.h3, color: Colors.textPrimary, fontSize: 14 },

  /* Fusion bars */
  fusionRow: { gap: 4 },
  fusionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  fusionLabel: { fontSize: 12, color: Colors.textPrimary },
  fusionPct: { fontSize: 12, fontWeight: '700' },
  fusionTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.divider, overflow: 'hidden' },
  fusionFill: { height: '100%', borderRadius: 4 },

  /* Guidance card */
  guidanceCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 6,
  },
  guidanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guidanceTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  guidanceBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bulletText: { fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  /* Clinic card */
  clinicCard: {
    backgroundColor: toneBg('#FFF5F5'),
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: toneBg('#FFD6D6'),
    gap: Spacing.sm,
  },
  clinicHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicCardTitle: { fontSize: 14, fontWeight: '700', color: tone('#E05C5C') },
  clinicCardSub: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 10,
  },
  clinicPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: toneBg('#FFD6D6'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicInfo: { flex: 1, gap: 2 },
  clinicName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  clinicHours: { fontSize: 10, color: Colors.textSecondary },
  clinicBadge: {
    alignSelf: 'flex-start',
    backgroundColor: toneBg('#D6F5E3'),
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  clinicBadgeText: { fontSize: 9, fontWeight: '700', color: tone('#27AE60') },
  clinicRight: { alignItems: 'flex-end', gap: 6 },
  clinicDist: { fontSize: 11, color: Colors.textSecondary },
  callBtn: {
    backgroundColor: toneBg('#E05C5C'),
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  callBtnText: { fontSize: 11, fontWeight: '700', color: tone('#FFF') },

  /* Hotlines */
  hotlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hotlineIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlineName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  hotlineNum: { fontSize: 10, color: Colors.textSecondary },

  /* Action buttons */
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  saveBtn: {
    flex: 1,
    backgroundColor: toneBg('#27AE60'),
    borderRadius: Radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: tone('#FFF') },
  helpBtn: {
    flex: 1,
    backgroundColor: toneBtn(Colors.primary),
    borderRadius: Radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
  },
  helpBtnText: { fontSize: 14, fontWeight: '700', color: tone('#FFF') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
