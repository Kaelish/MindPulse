import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PatientDashboardData,
  StressSessionItem,
  fetchDashboardData,
} from '../../services/dashboard';
import { isMessageNotification, markNotificationRead } from '../../services/notifications';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

export type DashboardTab = 'home' | 'analysis' | 'clinics' | 'profile';

interface PatientDashboardScreenProps {
  activeTab?: DashboardTab;
  onNavigate?: (tab: DashboardTab) => void;
  onStartVideoCall?: (doctorId?: string) => void;
  onRunSurvey?: () => void;
  onRunFaceScan?: () => void;
  onRunDailyCheck?: () => void;
  /** Chat rows in the notifications sheet land on the Messages thread. */
  onOpenMessages?: () => void;
}

/* ─── Quick Action Card ─── */
const QuickAction = ({
  icon, label, bg, iconColor, onPress, isMaterial
}: { icon: any; label: string; bg: string; iconColor: string; onPress?: () => void; isMaterial?: boolean }) => (
  <TouchableOpacity style={[styles.quickActionCard, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.quickActionIconBox, { backgroundColor: iconColor }]}>
      {isMaterial ? (
        <MaterialCommunityIcons name={icon} size={22} color={Colors.white} />
      ) : (
        <Ionicons name={icon} size={22} color={Colors.white} />
      )}
    </View>
    <Text style={[styles.quickActionLabel, { color: iconColor }]}>{label}</Text>
  </TouchableOpacity>
);

/* ─── Session Row ─── */
const SessionRow = ({ session, onPress }: { session: StressSessionItem; onPress: () => void }) => {
  const isHigh = session.statusColor === 'pink';
  const isModerate = session.statusColor === 'yellow';

  const scoreBg = isHigh ? '#FCE5DE' : isModerate ? '#FFF3CD' : '#D6F5E3';
  const scoreText = isHigh ? '#E05C5C' : isModerate ? '#E08A00' : '#27AE60';
  const pillLabel = isHigh ? 'High' : isModerate ? 'Moderate' : 'Low';

  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.sessionScoreCircle, { backgroundColor: scoreBg }]}>
        <Text style={[styles.sessionScoreText, { color: scoreText }]}>{session.score}</Text>
      </View>
      <View style={styles.sessionTextWrap}>
        <Text style={styles.sessionTitle}>{session.title}</Text>
        <Text style={styles.sessionDate}>{session.date}</Text>
      </View>
      <View style={[styles.sessionPill, { backgroundColor: scoreBg }]}>
        <Text style={[styles.sessionPillText, { color: scoreText }]}>{pillLabel}</Text>
      </View>
    </TouchableOpacity>
  );
};

/* ─── Main Screen ─── */
export const PatientDashboardScreen: React.FC<PatientDashboardScreenProps> = ({
  activeTab = 'home',
  onNavigate,
  onStartVideoCall,
  onRunSurvey,
  onRunFaceScan,
  onRunDailyCheck,
  onOpenMessages,
}) => {
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<StressSessionItem | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchDashboardData();
      setData(res);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.textHint} />
        <Text style={styles.loadingText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void loadData()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.btnBlue} />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const { userName, greetingDate, metrics, recentSessions, notifications } = data;
  const unreadCount = notifications.filter(n => !n.read).length;

  /**
   * Opening a notification is the act of reading it: clear the bell dot, then
   * hand chat rows straight to the message thread.
   */
  const openNotification = (item: { id: string; read: boolean; title: string; message: string }) => {
    if (!item.read) {
      const patch = (read: boolean) => setData((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((row) =>
                row.id === item.id ? { ...row, read } : row,
              ),
            }
          : current,
      );
      patch(true);
      void markNotificationRead(item.id).catch(() => patch(false));
    }
    if (isMessageNotification(item)) {
      setShowNotificationsModal(false);
      onOpenMessages?.();
    }
  };

  const displaySessions = showAllSessions ? recentSessions : recentSessions.slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Green Gradient Header ── */}
        <LinearGradient
          colors={[Colors.gradGreenTop, Colors.gradGreenBot]}
          style={styles.header}
        >
          <SafeAreaView>
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.greetingEyebrow}>{greeting},</Text>
                <View style={styles.nameRow}>
                  <Text style={styles.greetingName}>{userName}</Text>
                  <MaterialCommunityIcons name="hand-wave" size={20} color={tone('#E2B852')} />
                </View>
                <Text style={styles.dateText}>{greetingDate}</Text>
              </View>
              <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotificationsModal(true)}>
                <Ionicons name="notifications-outline" size={24} color={Colors.white} />
                {unreadCount > 0 && <View style={styles.bellBadge} />}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ── White Body ── */}
        <View style={styles.body}>

          {/* Latest Stress Card */}
          <TouchableOpacity style={styles.stressCard} activeOpacity={0.9}
            onPress={() => recentSessions.length > 0 && setSelectedSession(recentSessions[0])}>
            <View style={styles.stressCardLeft}>
              <Text style={styles.stressCardLabel}>Latest Stress Level</Text>
              <Text style={styles.stressCardLevel}>{metrics.latestLevel ?? 'No data yet'}</Text>
              {metrics.latestTrend !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="trending-up" size={16} color={Colors.textSecondary} />
                  <Text style={styles.stressCardTrend}>{metrics.latestTrend}</Text>
                </View>
              )}
            </View>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreCircleNum}>{metrics.latestScore ?? '—'}</Text>
              <Text style={styles.scoreCircleLabel}>Score</Text>
            </View>
          </TouchableOpacity>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction icon="clipboard-list" isMaterial label="Survey" bg={Colors.dashSurveyBg} iconColor={Colors.dashSurveyIcon} onPress={() => onNavigate?.('analysis')} />
            <QuickAction icon="camera-outline" label="Face Scan" bg={Colors.dashFaceBg} iconColor={Colors.dashFaceIcon} onPress={() => onNavigate?.('analysis')} />
            <QuickAction icon="pulse-outline" label="Analysis" bg={Colors.dashAnalysisBg} iconColor={Colors.dashAnalysisIcon} onPress={() => onNavigate?.('analysis')} />
            <QuickAction icon="tv-outline" label="Consult" bg={Colors.dashConsultBg} iconColor={Colors.dashConsultIcon} onPress={() => onNavigate?.('clinics')} />
          </View>

          {/* Daily Stress Check Banner */}
          <TouchableOpacity style={styles.dailyCheckBanner} activeOpacity={0.9}
            onPress={onRunDailyCheck || (() => onNavigate?.('analysis'))}>
            <View style={styles.dailyCheckIconWrap}>
              <MaterialCommunityIcons name="brain" size={24} color={Colors.dashStressCheckBg} />
            </View>
            <View style={styles.dailyCheckText}>
              <Text style={styles.dailyCheckTitle}>Daily Stress Check</Text>
              <Text style={styles.dailyCheckSub}>Survey + Face + HR Analysis</Text>
            </View>
            <View style={styles.dailyCheckArrow}>
              <Ionicons name="chevron-forward" size={20} color={Colors.white} />
            </View>
          </TouchableOpacity>

          {/* Metrics Row */}
          <View style={styles.metricsRow}>
            <TouchableOpacity style={styles.metricCard} activeOpacity={0.85} onPress={() => onNavigate?.('analysis')}>
              <View style={styles.metricLabelRow}>
                <Ionicons name="heart" size={16} color={tone('#E05C5C')} />
                <Text style={styles.metricLabel}>Avg Heart Rate</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNum}>{metrics.avgHeartRate ?? '—'}</Text>
                {metrics.avgHeartRate !== null && <Text style={styles.metricUnit}>bpm</Text>}
              </View>
              <Text style={[styles.metricStatus, { color: tone('#E05C5C') }]}>{metrics.avgHeartRateStatus}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.metricCard} activeOpacity={0.85} onPress={() => onNavigate?.('analysis')}>
              <View style={styles.metricLabelRow}>
                <Ionicons name="trending-up" size={16} color={tone('#E08A00')} />
                <Text style={styles.metricLabel}>Avg Stress</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNum}>{metrics.avgStressScore ?? '—'}</Text>
                {metrics.avgStressScore !== null && <Text style={styles.metricUnit}>/100</Text>}
              </View>
              <Text style={[styles.metricStatus, { color: tone('#E08A00') }]}>{metrics.avgStressStatus}</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Sessions */}
          <View style={styles.sessionsHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <Pressable onPress={() => setShowAllSessions(v => !v)}>
              <Text style={styles.seeAll}>{showAllSessions ? 'Show less' : 'See all'}</Text>
            </Pressable>
          </View>
          <View style={styles.sessionsList}>
            {recentSessions.length === 0 && (
              <Text style={styles.sessionsEmpty}>
                No sessions yet — complete an assessment to see it here.
              </Text>
            )}
            {displaySessions.map(session => (
              <SessionRow key={session.id} session={session} onPress={() => setSelectedSession(session)} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Session Details Modal */}
      {selectedSession && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedSession(null)}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.box}>
              <Text style={modalStyles.title}>Session Details</Text>
              <Text style={modalStyles.score}>Score: {selectedSession.score} / 100 ({selectedSession.status})</Text>
              <Text style={modalStyles.date}>{selectedSession.date}</Text>
              {selectedSession.heartRate && <Text style={modalStyles.meta}>Heart Rate: {selectedSession.heartRate} bpm</Text>}
              {selectedSession.notes && (
                <View style={modalStyles.notes}>
                  <Text style={modalStyles.notesLabel}>Analysis Notes:</Text>
                  <Text style={modalStyles.notesText}>{selectedSession.notes}</Text>
                </View>
              )}
              <TouchableOpacity style={modalStyles.closeBtn} onPress={() => setSelectedSession(null)}>
                <Text style={modalStyles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowNotificationsModal(false)}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.box}>
              <Text style={modalStyles.title}>Notifications</Text>
              <ScrollView style={{ maxHeight: 260, marginVertical: 12 }}>
                {notifications.length === 0 && (
                  <Text style={styles.notifEmpty}>No notifications yet.</Text>
                )}
                {notifications.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={modalStyles.notifItem}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Open notification: ${n.title}`}
                    onPress={() => openNotification(n)}
                  >
                    <Text style={modalStyles.notifTitle}>{n.title}</Text>
                    <Text style={modalStyles.notifBody}>{n.message}</Text>
                    <Text style={modalStyles.notifTime}>{n.time}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={modalStyles.closeBtn} onPress={() => setShowNotificationsModal(false)}>
                <Text style={modalStyles.closeBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

/* ─── Styles ─── */
const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  loadingText: { color: Colors.textSecondary, ...Typography.body2, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 22, backgroundColor: Colors.btnBlue },
  retryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  notifEmpty: { fontSize: 13, color: Colors.textHint, textAlign: 'center', paddingVertical: 16 },
  sessionsEmpty: { fontSize: 13, color: Colors.textHint, textAlign: 'center', paddingVertical: 14, fontStyle: 'italic' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 90 },

  /* Header */
  header: { paddingHorizontal: Spacing.lg, paddingTop: 0, paddingBottom: Spacing.xxl + 8 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 16 },
  greetingEyebrow: { color: 'rgba(30,50,30,0.65)', fontSize: 14, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  greetingName: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900' },
  waveEmoji: { fontSize: 22, marginLeft: 8 },
  dateText: { color: 'rgba(30,50,30,0.55)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  bellBtn: { width: 48, height: 48, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 20 },
  bellBadge: { position: 'absolute', top: 10, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: toneBg('#E05C5C'), borderWidth: 1.5, borderColor: Colors.white },

  /* Body */
  body: { backgroundColor: Colors.pageBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -24, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, gap: Spacing.md },

  /* Latest Stress Card */
  stressCard: { backgroundColor: toneBg('#FAE5DF'), borderRadius: 22, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stressCardLeft: { flex: 1 },
  stressCardLabel: { color: tone('#7C4A3A'), fontSize: 13, fontWeight: '700' },
  stressCardLevel: { color: Colors.textPrimary, fontSize: 28, fontWeight: '900', marginTop: 4 },
  stressCardTrend: { color: tone('#E05C5C'), fontSize: 13, marginTop: 4, fontWeight: '600' },
  scoreCircle: { width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  scoreCircleNum: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900' },
  scoreCircleLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },

  /* Section title */
  sectionTitle: { color: Colors.textPrimary, ...Typography.h3, marginTop: 4 },

  /* Quick actions */
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionCard: { width: '46.5%', borderRadius: Radius.md, padding: 16, alignItems: 'center', gap: 10 },
  quickActionIconBox: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickActionIconText: { fontSize: 22 },
  quickActionLabel: { fontSize: 13, fontWeight: '700' },

  /* Daily Check Banner */
  dailyCheckBanner: { backgroundColor: Colors.dashStressCheckBg, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dailyCheckIconWrap: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  dailyCheckIcon: { fontSize: 22 },
  dailyCheckText: { flex: 1 },
  dailyCheckTitle: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  dailyCheckSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  dailyCheckArrow: { width: 32, height: 32, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  dailyCheckArrowText: { color: Colors.white, fontSize: 22, lineHeight: 28 },

  /* Metrics */
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricEmoji: { fontSize: 16 },
  metricLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  metricNum: { color: Colors.textPrimary, fontSize: 32, fontWeight: '900' },
  metricUnit: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  metricStatus: { fontSize: 12, fontWeight: '600' },

  /* Sessions */
  sessionsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  seeAll: { color: Colors.btnBlue, fontSize: 13, fontWeight: '700' },
  sessionsList: { gap: 10 },
  sessionRow: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 14 },
  sessionScoreCircle: { width: 52, height: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  sessionScoreText: { fontSize: 18, fontWeight: '900' },
  sessionTextWrap: { flex: 1 },
  sessionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  sessionDate: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  sessionPill: { borderRadius: Radius.full, paddingVertical: 5, paddingHorizontal: 12 },
  sessionPillText: { fontSize: 12, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });

const makeModalStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  box: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%' },
  title: { color: Colors.textPrimary, ...Typography.h3, marginBottom: 12 },
  score: { color: Colors.textPrimary, ...Typography.body1 },
  date: { color: Colors.textSecondary, ...Typography.body2, marginTop: 4 },
  meta: { color: Colors.textPrimary, ...Typography.body2, marginTop: 8 },
  notes: { backgroundColor: Colors.divider, borderRadius: Radius.sm, padding: Spacing.md, marginTop: 12 },
  notesLabel: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  notesText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  closeBtn: { marginTop: 20, height: 52, borderRadius: Radius.md, backgroundColor: Colors.btnBlue, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  notifItem: { borderBottomWidth: 1, borderBottomColor: Colors.divider, paddingVertical: 12 },
  notifTitle: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  notifBody: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  notifTime: { color: Colors.textHint, fontSize: 11, marginTop: 4 },
});

let modalStyles = makeModalStyles();
registerThemeStyles(() => { modalStyles = makeModalStyles(); });
