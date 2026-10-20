import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { supabase } from '../../supabase/client';
import {
  PatientDashboardData,
  StressSessionItem,
  fetchDashboardData,
} from '../../services/dashboard';
import {
  PlantProgress,
  fetchPlantProgress,
} from '../../services/plantProgress';
import { AccountInfoModal } from './settings/AccountInfoModal';
import { getAvatarUrl } from '../../services/profileAvatar';
import { NotificationsModal } from './settings/NotificationsModal';
import { PrivacyDataModal } from './settings/PrivacyDataModal';
import { AboutMindPulseModal } from './settings/AboutMindPulseModal';
import { HelpGuideModal } from './settings/HelpGuideModal';
import { SessionDetailModal } from '../../components/SessionDetailModal';
import { MyFilesSection } from './MyFilesSection';
import { TransactionsSection } from './TransactionsSection';
import { registerThemeStyles, setThemeMode, tone, toneBg, useThemeMode } from '../../theme/theme';

export type ProfileTabSegment = 'profile' | 'history' | 'files' | 'others' | 'settings';

const PROFILE_SEGMENTS: ProfileTabSegment[] = ['profile', 'history', 'files', 'others', 'settings'];

const SEGMENT_LABELS: Record<ProfileTabSegment, string> = {
  profile: 'My Profile',
  history: 'History',
  files: 'My Files',
  others: 'Others',
  settings: 'Settings',
};

interface PatientProfileScreenProps {
  onNavigateHome?: () => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
  onSignOut?: () => void;
  onOpenHealthSetup?: () => void;
  onOpenPlantProgress?: () => void;
}

// ── MindPlant growth stages ──────────────────────────────────────────────────
const PLANT_STAGES = [
  { name: 'Bare Pot', stage: 0, emoji: '🪴' },
  { name: 'Seedling', stage: 1, emoji: '🌱' },
  { name: 'Sprout', stage: 2, emoji: '🌿' },
  { name: 'Young Plant', stage: 3, emoji: '🌵' },
  { name: 'Mature Plant', stage: 4, emoji: '🌳' },
  { name: 'Full Bloom', stage: 5, emoji: '🌸' },
];
const STAGE_DESCRIPTIONS: Record<string, string> = {
  'Bare Pot': 'Your journey is ready to begin.',
  'Seedling': 'A tiny seedling sprouted! Your calm mind is starting to nurture new life.',
  'Sprout': 'Your steady practice is helping it grow.',
  'Young Plant': 'Your healthy rhythm is taking root.',
  'Mature Plant': 'Your consistency is flourishing.',
  'Full Bloom': 'A strong and sustained wellness practice.',
};

// ── Stress level helpers ──────────────────────────────────────────────────────
const levelProps = (status: string) => {
  if (status === 'Low') return { bg: toneBg('#D6F5E3'), color: tone('#27AE60'), label: 'Low' };
  if (status === 'Moderate') return { bg: toneBg('#FFF3CD'), color: tone('#E08A00'), label: 'Moderate' };
  return { bg: toneBg('#FFD6D6'), color: tone('#E05C5C'), label: 'High' };
};

// ── Simple sparkline chart (using View bars) ──────────────────────────────────
const LineChart = ({
  data, color, height = 80,
}: { data: number[]; color: string; height?: number }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  return (
    <View style={[lcStyles.wrap, { height }]}>
      {/* Y-axis labels */}
      <View style={lcStyles.yAxis}>
        <Text style={lcStyles.axisLabel}>{max}</Text>
        <Text style={lcStyles.axisLabel}>{Math.round((max + min) / 2)}</Text>
        <Text style={lcStyles.axisLabel}>{min}</Text>
      </View>
      {/* Bars */}
      <View style={lcStyles.bars}>
        {data.map((v, i) => {
          const barH = ((v - min) / range) * (height - 20);
          return (
            <View key={i} style={lcStyles.barWrap}>
              <View style={{ flex: 1 }} />
              <View style={[lcStyles.bar, { height: barH, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
};

const makeLcStyles = () => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: { width: 28, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 },
  axisLabel: { fontSize: 9, color: tone('#B0B8C8') },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barWrap: { flex: 1, flexDirection: 'column' },
  bar: { borderRadius: 3 },
});

let lcStyles = makeLcStyles();
registerThemeStyles(() => { lcStyles = makeLcStyles(); });

// ── Session row ───────────────────────────────────────────────────────────────
const SessionRow = ({
  session, onPress,
}: { session: StressSessionItem; onPress: () => void }) => {
  const lp = levelProps(session.status);
  return (
    <TouchableOpacity style={sessionStyles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={[sessionStyles.scorePill, { backgroundColor: lp.bg }]}>
        <Text style={[sessionStyles.scoreText, { color: lp.color }]}>{session.score}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={sessionStyles.rowTop}>
          <Text style={sessionStyles.title}>{session.title}</Text>
          <View style={[sessionStyles.badge, { backgroundColor: lp.bg }]}>
            <Text style={[sessionStyles.badgeText, { color: lp.color }]}>{lp.label}</Text>
          </View>
        </View>
        <Text style={sessionStyles.date}>{session.date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
    </TouchableOpacity>
  );
};

const makeSessionStyles = () => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scorePill: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 16, fontWeight: '800' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  date: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});

let sessionStyles = makeSessionStyles();
registerThemeStyles(() => { sessionStyles = makeSessionStyles(); });

// ── Settings row ──────────────────────────────────────────────────────────────
const SettingRow = ({
  icon, bg, label, sub, onPress, accent = false, right,
}: {
  icon: any;
  bg: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  accent?: boolean;
  /** Rendered instead of the chevron — used by switch rows. */
  right?: React.ReactNode;
}) => (
  <TouchableOpacity style={settingStyles.row} onPress={onPress}>
    <View style={[settingStyles.iconBox, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={accent ? '#E05C5C' : Colors.textPrimary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[settingStyles.label, accent && { color: tone('#E05C5C') }]}>{label}</Text>
      {sub && <Text style={settingStyles.sub}>{sub}</Text>}
    </View>
    {right ?? (!accent && <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />)}
  </TouchableOpacity>
);

const makeSettingStyles = () => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  sub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
});

let settingStyles = makeSettingStyles();
registerThemeStyles(() => { settingStyles = makeSettingStyles(); });

// ── Main component ─────────────────────────────────────────────────────────────
export const PatientProfileScreen: React.FC<PatientProfileScreenProps> = ({
  onNavigateHome, onNavigateTab, onSignOut, onOpenHealthSetup, onOpenPlantProgress,
}) => {
  const [activeSegment, setActiveSegment] = useState<ProfileTabSegment>('profile');
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailSession, setDetailSession] = useState<StressSessionItem | null>(null);
  const [plant, setPlant] = useState<PlantProgress | null>(null);
  const [plantError, setPlantError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Settings Modal states
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPrivacyData, setShowPrivacyData] = useState(false);
  const [showAboutMindPulse, setShowAboutMindPulse] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Dark mode (device-wide, restored on the next launch)
  const themeMode = useThemeMode();

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchDashboardData();
      setData(res);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
    fetchPlantProgress()
      .then(p => { setPlant(p); setPlantError(null); })
      .catch((e: any) => setPlantError(e?.message || 'Could not load plant progress.'));
    getAvatarUrl()
      .then(url => setAvatarUrl(url))
      .catch(() => {});
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive current plant stage from live Supabase data (new-user default: Bare Pot)
  const currentStageIndex = Math.max(
    0,
    PLANT_STAGES.findIndex(s => s.name === (plant?.currentStage ?? 'Bare Pot')),
  );
  const currentStage = PLANT_STAGES[currentStageIndex];

  const handleSignOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    onSignOut?.();
  };

  if (loadError) {
    return (
      <View style={styles.loader}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.textHint} />
        <Text style={styles.loaderText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void loadAll()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loaderText}>Loading Profile...</Text>
      </View>
    );
  }

  const { userName, userEmail, userInitials, metrics, recentSessions } = data;

  // ── Score trend data (last 10 sessions reversed); HR chart only plots
  //    sessions that actually recorded a heart rate ──
  const chartSessions = recentSessions.slice(0, 10);
  const scoreTrend = [...chartSessions].reverse().map(s => s.score);
  const hrSessions = chartSessions.filter(s => typeof s.heartRate === 'number');
  const hrTrend = [...hrSessions].reverse().map(s => s.heartRate as number);

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        {/* Avatar + Name + Email */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            {/* Initials underneath: a broken photo URL falls back to them. */}
            <Text style={styles.avatarText}>{userInitials}</Text>
            {!!avatarUrl && (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                onError={() => setAvatarUrl(null)}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>

        {/* Stats pills */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>{metrics.totalAssessments}</Text>
            <Text style={styles.statLbl}>Assessments</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: toneBg('#FFF9E6') }]}>
            <Text style={[styles.statVal, { color: tone('#B08B28') }]}>
              {metrics.avgStressScore !== null ? `${metrics.avgStressScore}/100` : '—'}
            </Text>
            <Text style={[styles.statLbl, { color: tone('#B08B28') }]}>Average Stress</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: toneBg('#E6F7F5') }]}>
            <Text style={[styles.statVal, { color: tone('#2C7A7B') }]}>
              {metrics.avgHeartRate !== null ? `${metrics.avgHeartRate} bpm` : '—'}
            </Text>
            <Text style={[styles.statLbl, { color: tone('#2C7A7B') }]}>Average HR</Text>
          </View>
        </View>

        {/* Segment tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {PROFILE_SEGMENTS.map(seg => (
            <TouchableOpacity
              key={seg}
              style={[styles.tabBtn, activeSegment === seg && styles.tabBtnActive]}
              onPress={() => setActiveSegment(seg)}
            >
              <Text style={[styles.tabText, activeSegment === seg && styles.tabTextActive]}>
                {SEGMENT_LABELS[seg]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* ── Tab content ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════ MY PROFILE TAB ══════════ */}
        {activeSegment === 'profile' && (
          <>
            {/* Health Background */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Health Background</Text>
                <TouchableOpacity onPress={onOpenHealthSetup}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.emptyText}>
                {data.healthConditions.length > 0
                  ? data.healthConditions.join(', ')
                  : 'No health conditions flagged'}
              </Text>
            </View>

            {/* Academic Information */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Academic Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Year Level</Text>
                <Text style={styles.infoVal}>{data.yearLevel ?? 'Not set'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Living With</Text>
                <Text style={styles.infoVal}>{data.livingSituation ?? 'Not set'}</Text>
              </View>
            </View>

            {/* Assessment stats grid */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Assessment Overview</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.gridCell, { backgroundColor: toneBg('#EEEDFE') }]}>
                  <Text style={[styles.gridVal, { color: tone('#5B6EF5') }]}>{metrics.totalAssessments}</Text>
                  <Text style={[styles.gridLbl, { color: tone('#5B6EF5') }]}>Total Sessions</Text>
                </View>
                <View style={[styles.gridCell, { backgroundColor: toneBg('#FFF3CD') }]}>
                  <Text style={[styles.gridVal, { color: tone('#E08A00') }]}>{metrics.avgStressScore ?? '—'}</Text>
                  <Text style={[styles.gridLbl, { color: tone('#E08A00') }]}>Avg Stress</Text>
                </View>
                <View style={[styles.gridCell, { backgroundColor: toneBg('#FFD6D6') }]}>
                  <Text style={[styles.gridVal, { color: tone('#E05C5C') }]}>
                    {metrics.avgHeartRate !== null ? `${metrics.avgHeartRate} bpm` : '—'}
                  </Text>
                  <Text style={[styles.gridLbl, { color: tone('#E05C5C') }]}>Avg Heart Rate</Text>
                </View>
                <View style={[styles.gridCell, { backgroundColor: toneBg('#D6F5E3') }]}>
                  <Text style={[styles.gridVal, { color: tone('#27AE60') }]}>{metrics.latestTrend ?? '—'}</Text>
                  <Text style={[styles.gridLbl, { color: tone('#27AE60') }]}>Trend</Text>
                </View>
              </View>
            </View>

            {/* MindPlant — tap to open full progress screen */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.card, { backgroundColor: toneBg('#F0FBF4') }]}
              onPress={onOpenPlantProgress}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>🌱 My MindPlant</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.stageLabel}>{currentStage.name}</Text>
                  <Ionicons name="chevron-forward" size={14} color={tone('#27AE60')} />
                </View>
              </View>
              {/* Plant illustration */}
              <View style={styles.plantIllustration}>
                <Text style={styles.plantEmoji}>{currentStage.emoji}</Text>
              </View>
              <Text style={styles.plantDesc}>
                {STAGE_DESCRIPTIONS[currentStage.name] ?? 'Keep going — your plant is growing!'}
              </Text>
              <Text style={styles.plantTip}>
                {plantError
                  ? plantError
                  : <>🌱 {plant?.currentStreak ?? 0} day streak · ❄️ {plant?.freezes ?? 0} freeze{plant?.freezes === 1 ? '' : 's'} · {plant?.totalGrowthPoints ?? 0} growth points</>}
              </Text>
              {/* Stage dots */}
              <View style={styles.stageDots}>
                {PLANT_STAGES.map(s => (
                  <View
                    key={s.name}
                    style={[
                      styles.stageDot,
                      s.stage === currentStageIndex && styles.stageDotActive,
                      s.stage < currentStageIndex && styles.stageDotDone,
                    ]}
                  />
                ))}
                <Text style={styles.stageNum}>Stage {currentStageIndex}</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ══════════ HISTORY TAB ══════════ */}
        {activeSegment === 'history' && (
          <>
            {/* Stress Score Trend chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stress Score Trend</Text>
              {scoreTrend.length === 0 ? (
                <Text style={styles.emptyText}>No sessions yet — complete an assessment to see your trend.</Text>
              ) : (
                <>
                  <LineChart data={scoreTrend} color={tone('#5B6EF5')} height={90} />
                  <View style={styles.xLabels}>
                    {chartSessions.slice().reverse().map((s, i) => (
                      <Text key={i} style={styles.xLabel}>
                        {s.date.split(',')[0].split(' ').slice(-1)[0]}
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Heart Rate chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Heart Rate History (BPM)</Text>
              {hrTrend.length === 0 ? (
                <Text style={styles.emptyText}>No heart rate readings recorded yet.</Text>
              ) : (
                <>
                  <LineChart data={hrTrend} color={tone('#E05C5C')} height={90} />
                  <View style={styles.xLabels}>
                    {hrSessions.slice().reverse().map((s, i) => (
                      <Text key={i} style={styles.xLabel}>
                        {s.date.split(',')[0].split(' ').slice(-1)[0]}
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* All sessions list */}
            <Text style={styles.sectionLabel}>ALL SESSIONS</Text>
            {recentSessions.length === 0 && (
              <Text style={styles.emptyText}>No sessions recorded yet.</Text>
            )}
            {recentSessions.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onPress={() => setDetailSession(session)}
              />
            ))}
          </>
        )}

        {/* ══════════ MY FILES TAB ══════════ */}
        {activeSegment === 'files' && <MyFilesSection />}

        {/* ══════════ OTHERS TAB ══════════ */}
        {activeSegment === 'others' && <TransactionsSection />}

        {/* ══════════ SETTINGS TAB ══════════ */}
        {activeSegment === 'settings' && (
          <>
            <Text style={styles.settingSectionLabel}>ACCOUNT</Text>
            <View style={styles.card}>
              <SettingRow
                icon="person-outline"
                bg="#EEEDFE"
                label="Account Information"
                sub="Name, email, profile & password"
                onPress={() => setShowAccountInfo(true)}
              />
              <SettingRow
                icon="heart-outline"
                bg="#E6F8ED"
                label="Health Background"
                sub="Update your health profile"
                onPress={onOpenHealthSetup}
              />
            </View>

            <Text style={styles.settingSectionLabel}>APP</Text>
            <View style={styles.card}>
              <SettingRow
                icon="moon-outline"
                bg="#E9E7FD"
                label="Dark mode"
                sub="Darker surfaces, easier on the eyes"
                right={
                  <Switch
                    value={themeMode === 'dark'}
                    onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
                    trackColor={{ false: '#CBD5E1', true: '#8353E2' }}
                    thumbColor="#FFF"
                    accessibilityLabel="Dark mode"
                  />
                }
              />
              <SettingRow
                icon="notifications-outline"
                bg="#EEEDFE"
                label="Notifications"
                sub="Daily reminders & alert preferences"
                onPress={() => setShowNotifications(true)}
              />
              <SettingRow
                icon="shield-outline"
                bg="#E6F0FA"
                label="Privacy & Data"
                sub="Data policy, facial safeguards & export"
                onPress={() => setShowPrivacyData(true)}
              />
              <SettingRow
                icon="help-circle-outline"
                bg="#FFF3E0"
                label="Help & Guide"
                sub="How to use the app — step by step"
                onPress={() => setShowHelpGuide(true)}
              />
              <SettingRow
                icon="information-circle-outline"
                bg="#E6F7F5"
                label="About MindPulse"
                sub="App info, capstone disclaimer & support"
                onPress={() => setShowAboutMindPulse(true)}
              />
            </View>

            {/* Sign Out */}
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={16} color={tone('#E05C5C')} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              MindPulse v1.0.0 — For educational purposes only. This app does not replace professional medical advice.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── Settings Modals ── */}
      <AccountInfoModal
        visible={showAccountInfo}
        onClose={() => setShowAccountInfo(false)}
        currentName={userName}
        currentEmail={userEmail}
        onProfileUpdated={() => {
          // The update already succeeded; keep current data if the refresh fails.
          fetchDashboardData().then(res => setData(res)).catch(() => {});
          getAvatarUrl().then(url => setAvatarUrl(url)).catch(() => {});
        }}
      />
      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
      <PrivacyDataModal
        visible={showPrivacyData}
        onClose={() => setShowPrivacyData(false)}
        onDataChanged={() => { void loadAll(); }}
        onAccountDeleted={() => { void handleSignOut(); }}
      />
      <AboutMindPulseModal
        visible={showAboutMindPulse}
        onClose={() => setShowAboutMindPulse(false)}
      />
      <HelpGuideModal
        visible={showHelpGuide}
        onClose={() => setShowHelpGuide(false)}
      />
      <SessionDetailModal
        visible={detailSession !== null}
        session={detailSession}
        onClose={() => setDetailSession(null)}
      />
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  loaderText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 22, backgroundColor: Colors.primary },
  retryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  /* Header */
  headerSafe: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: toneBg('#F5A623'),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  avatarText: { fontSize: 20, fontWeight: '800', color: tone('#FFF') },
  userName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  userEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  statPill: {
    flex: 1,
    backgroundColor: toneBg('#EEEDFE'),
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statVal: { fontSize: 14, fontWeight: '800', color: tone('#5B6EF5') },
  statLbl: { fontSize: 9, fontWeight: '600', color: tone('#5B6EF5'), marginTop: 1 },

  /* Segment tabs */
  tabRow: { flexDirection: 'row', paddingHorizontal: 12 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 14, paddingBottom: 100 },

  /* Cards */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  editLink: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  emptyText: { fontSize: 13, color: Colors.textHint, fontStyle: 'italic' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey: { fontSize: 13, color: Colors.textSecondary },
  infoVal: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

  /* Stats grid */
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    width: '47%',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  gridVal: { fontSize: 18, fontWeight: '800' },
  gridLbl: { fontSize: 11, fontWeight: '600' },

  /* MindPlant */
  plantIllustration: { alignItems: 'center', paddingVertical: 12 },
  plantEmoji: { fontSize: 64 },
  plantDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  plantTip: { fontSize: 12, color: tone('#27AE60'), fontStyle: 'italic' },
  stageLabel: { fontSize: 12, fontWeight: '700', color: tone('#27AE60'), backgroundColor: toneBg('#D6F5E3'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  stageDots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  stageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  stageDotActive: { backgroundColor: toneBg('#27AE60'), width: 12, height: 12, borderRadius: 6 },
  stageDotDone: { backgroundColor: toneBg('#8CE072') },
  stageNum: { fontSize: 11, color: Colors.textSecondary, marginLeft: 6 },

  /* History */
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  xLabels: { flexDirection: 'row', paddingLeft: 32, gap: 4, marginTop: 4 },
  xLabel: { flex: 1, fontSize: 9, color: Colors.textHint, textAlign: 'center' },

  /* Settings */
  settingSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: toneBg('#FFF0F0'),
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: toneBg('#FFD6D6'),
  },
  signOutText: { fontSize: 14, fontWeight: '800', color: tone('#E05C5C') },
  disclaimer: {
    fontSize: 11,
    color: Colors.textHint,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
