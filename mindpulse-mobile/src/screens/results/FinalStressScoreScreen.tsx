import React from 'react';
import {
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
import { BottomTabBar } from '../../components/navigation/BottomTabBar';

interface Props {
  heartRate: number;
  reaction: ReactionResult;
  onBack: () => void;
  onDone: () => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

const getLevel = (score: number) => {
  if (score >= 70) return {
    label: 'Low Stress', color: '#27AE60', bg: '#D6F5E3',
    ringColor: '#27AE60', lightBg: '#EBF9F2',
    message: 'Your signals suggest a calm and focused state. Keep it up!',
    isHigh: false,
  };
  if (score >= 40) return {
    label: 'Moderate Stress', color: '#E08A00', bg: '#FFF3CD',
    ringColor: '#F5C842', lightBg: '#FFFBE6',
    message: 'Your signals suggest some cognitive or physical load. Monitor closely.',
    isHigh: false,
  };
  return {
    label: 'High Stress', color: '#E05C5C', bg: '#FFD6D6',
    ringColor: '#E05C5C', lightBg: '#FFF0F0',
    message: 'Your signals suggest elevated stress. Consider a short recovery break.',
    isHigh: true,
  };
};

// ── Score ring (circular border) ──
const ScoreRing = ({ score, color }: { score: number; color: string }) => (
  <View style={[styles.scoreRing, { borderColor: color }]}>
    <Text style={styles.scoreNum}>{score}</Text>
    <Text style={styles.scoreOutOf}>out of 100</Text>
  </View>
);

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

// ── Clinic row ──
const ClinicRow = ({
  name, distance, hours, badge,
}: { name: string; distance: string; hours?: string; badge?: string }) => (
  <View style={styles.clinicRow}>
    <View style={styles.clinicPin}>
      <Ionicons name="location" size={18} color="#E05C5C" />
    </View>
    <View style={styles.clinicInfo}>
      <Text style={styles.clinicName}>{name}</Text>
      {hours && <Text style={styles.clinicHours}>{hours}</Text>}
      {badge && (
        <View style={styles.clinicBadge}>
          <Text style={styles.clinicBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
    <View style={styles.clinicRight}>
      <Text style={styles.clinicDist}>{distance}</Text>
      <TouchableOpacity style={styles.callBtn}>
        <Text style={styles.callBtnText}>Call</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ── Hotline row ──
const HotlineRow = ({ name, number, color }: { name: string; number: string; color: string }) => (
  <View style={styles.hotlineRow}>
    <View style={[styles.hotlineIcon, { backgroundColor: color }]}>
      <Ionicons name="call" size={14} color="#FFF" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.hotlineName}>{name}</Text>
      <Text style={styles.hotlineNum}>{number}</Text>
    </View>
  </View>
);

export const FinalStressScoreScreen: React.FC<Props> = ({
  heartRate, reaction, onBack, onDone, onNavigateTab,
}) => {
  const heartRateScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(heartRate - 70) * 1.5)));
  const score = Math.round(heartRateScore * 0.4 + reaction.score * 0.6);
  const level = getLevel(score);
  const activeTab = 'analysis' as const;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Stress Analysis chrome header */}
      <StressAnalysisLayout
        activeModule="reaction"
        activeSection="results"
        heartRateDone
        onBack={onBack}
        subtitle="Multi-modal stress assessment"
      >
        {/* ── Score card ── */}
        <View style={styles.scoreCard}>
          <Text style={styles.sectionTitle}>Final Stress Score</Text>
          <View style={styles.scoreRow}>
            <ScoreRing score={score} color={level.ringColor} />
            <View style={styles.scoreGuide}>
              <View style={[styles.levelPill, { backgroundColor: level.bg }]}>
                <Text style={[styles.levelPillText, { color: level.color }]}>{level.label}</Text>
              </View>
              <Text style={styles.levelGuideRow}>
                <Ionicons name="ellipse" size={8} color="#27AE60" /> Low Stress (≥ 70)
              </Text>
              <Text style={styles.levelGuideRow}>
                <Ionicons name="ellipse" size={8} color="#E08A00" /> Moderate Stress (40–69)
              </Text>
              <Text style={styles.levelGuideRow}>
                <Ionicons name="ellipse" size={8} color="#E05C5C" /> High Stress ({'<'} 40)
              </Text>
            </View>
          </View>
        </View>

        {/* ── Multi-Modal Fusion bars ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Multi-Modal Fusion (50 / 20 / 20 / 10)</Text>
          <FusionBar label="Survey (PSS + Physio)" value={50} color="#5B6EF5" />
          <FusionBar label="Facial Emotion" value={Math.round(reaction.score * 0.8)} color="#4A90D9" />
          <FusionBar label="Heart Rate" value={Math.min(100, heartRateScore)} color="#E05C5C" />
          <FusionBar label="Reaction Time" value={Math.max(10, Math.min(100, reaction.score))} color="#F5A623" />
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
              {level.isHigh ? 'Your stress indicators are elevated' : 'You seem relaxed today.'}
            </Text>
          </View>
          <Text style={styles.guidanceBody}>{level.message}</Text>
          {level.isHigh ? (
            <>
              <GuidanceBullet text="Rest and avoid overloading tasks" color={level.color} />
              <GuidanceBullet text="Practice deep breathing or meditation" color={level.color} />
              <GuidanceBullet text="Reach out to campus counseling" color={level.color} />
              <GuidanceBullet text="Consider a telehealth consultation" color={level.color} />
            </>
          ) : (
            <>
              <GuidanceBullet text="Keep up your sleep schedule" color={level.color} />
              <GuidanceBullet text="Stay hydrated and eat well" color={level.color} />
              <GuidanceBullet text="Continue positive activities you enjoy" color={level.color} />
            </>
          )}
        </View>

        {/* ── Find Nearby Clinics ── */}
        <View style={styles.clinicCard}>
          <TouchableOpacity style={styles.clinicHeaderRow}>
            <Ionicons name="location" size={16} color="#E05C5C" />
            <Text style={styles.clinicCardTitle}>Find Nearby Psych Clinics</Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={16} color="#E05C5C" />
          </TouchableOpacity>
          <Text style={styles.clinicCardSub}>Suggested based on your stress level</Text>
          <ClinicRow name="University Wellness Center" distance="0.2 km" hours="Mon–Fri, 8AM–5PM" badge="On-campus" />
          <ClinicRow name="MindBridge Psych Clinic" distance="1.2 km" hours="Mon–Fri, 9AM–6PM" />
          <ClinicRow name="National Center for Mental Health" distance="2.5 km" hours="Mon–Sat, 8AM–6PM" />
          <ClinicRow name="Hopeful Hearts Counseling" distance="2.8 km" hours="Mon–Fri, 9AM–5PM" />
        </View>

        {/* ── Emergency Hotlines ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Mental Health Hotlines</Text>
          <HotlineRow name="National Crisis Hotline" number="988 · 24/7 free & confidential" color="#E05C5C" />
          <HotlineRow name="In Touch Crisis Line (PH)" number="0917-558-4673 · 24/7 support" color="#F5A623" />
          <HotlineRow name="NCMH Crisis Hotline" number="1553 · Free, Mon–Fri 8AM–5PM" color="#5B6EF5" />
          <HotlineRow name="Crisis Text Line" number="Text HOME to 741741 · Text-based support" color="#4A90D9" />
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={onDone}>
            <Text style={styles.saveBtnText}>Save Result</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpBtn} onPress={onDone}>
            <Text style={styles.helpBtnText}>Get Help  →</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: '#FFF5F5',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FFD6D6',
    gap: Spacing.sm,
  },
  clinicHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicCardTitle: { fontSize: 14, fontWeight: '700', color: '#E05C5C' },
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
    backgroundColor: '#FFD6D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicInfo: { flex: 1, gap: 2 },
  clinicName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  clinicHours: { fontSize: 10, color: Colors.textSecondary },
  clinicBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D6F5E3',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  clinicBadgeText: { fontSize: 9, fontWeight: '700', color: '#27AE60' },
  clinicRight: { alignItems: 'flex-end', gap: 6 },
  clinicDist: { fontSize: 11, color: Colors.textSecondary },
  callBtn: {
    backgroundColor: '#E05C5C',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  callBtnText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

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
    backgroundColor: '#27AE60',
    borderRadius: Radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  helpBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
  },
  helpBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
