import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import {
  DashboardMetric,
  DoctorDashboardData,
  DoctorScheduleItem,
  MetricTone,
  fetchDoctorDashboard,
} from '../../services/doctorDashboard';
import { DoctorNotifications } from '../../components/DoctorNotifications';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../../theme/theme';

interface DoctorDashboardScreenProps {
  onNavigate?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
  /** Chat rows in the bell sheet land on the Messages thread. */
  onOpenMessages?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Requested',
  awaiting_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const makeStatusColors = (): Record<string, { bg: string; text: string }> => ({
  scheduled: { bg: toneBg('#FCECEC'), text: tone('#C05656') },
  awaiting_payment: { bg: Colors.tagBlueBg, text: Colors.tagBlueText },
  confirmed: { bg: Colors.tagGreenBg, text: Colors.tagGreenText },
  completed: { bg: Colors.divider, text: Colors.textSecondary },
  declined: { bg: Colors.tagRedBg, text: Colors.tagRedText },
  cancelled: { bg: Colors.divider, text: Colors.textHint },
});

let STATUS_COLORS = makeStatusColors();

const makeToneColors = (): Record<MetricTone, string> => ({
  positive: Colors.tagGreenText,
  warning: Colors.tagYellowText,
  danger: Colors.tagRedText,
  neutral: Colors.textSecondary,
});

let TONE_COLORS = makeToneColors();

registerThemeStyles(() => {
  STATUS_COLORS = makeStatusColors();
  TONE_COLORS = makeToneColors();
});

const makeMetricCards = (): { key: keyof DoctorDashboardData['metrics']; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] => [
  { key: 'activeCases', label: 'Active Cases', icon: 'people-outline', color: tone('#5B6EF5') },
  { key: 'pendingReviews', label: 'Pending Reviews', icon: 'clipboard-outline', color: tone('#DB8D62') },
  { key: 'highRiskStudents', label: 'High Risk Patients', icon: 'warning-outline', color: tone('#E05C5C') },
  { key: 'completedThisWeek', label: 'Completed this week', icon: 'checkmark-done-outline', color: tone('#27AE60') },
];

let METRIC_CARDS = makeMetricCards();

registerThemeStyles(() => {
  METRIC_CARDS = makeMetricCards();
});

const statusBadge = (status: string) =>
  status === 'Critical'
    ? { bg: Colors.tagRedBg, text: Colors.tagRedText }
    : status === 'Watch'
      ? { bg: Colors.tagYellowBg, text: Colors.tagYellowText }
      : status === 'Stable'
        ? { bg: Colors.tagGreenBg, text: Colors.tagGreenText }
        : { bg: Colors.divider, text: Colors.textHint };

const MetricCard = ({ label, metric, icon, color }: { label: string; metric: DashboardMetric; icon: keyof typeof Ionicons.glyphMap; color: string }) => (
  <View style={styles.statCard}>
    <View style={styles.statTop}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
    </View>
    <Text style={styles.statValue}>{metric.value.toLocaleString()}</Text>
    <Text style={[styles.statNote, { color: TONE_COLORS[metric.note.tone] }]} numberOfLines={1}>
      {metric.note.text}
    </Text>
  </View>
);

export const DoctorDashboardScreen: React.FC<DoctorDashboardScreenProps> = ({
  onNavigate,
  onOpenMessages,
}) => {
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await fetchDoctorDashboard());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const metrics = data?.metrics;
  const schedule = data?.schedule ?? [];
  const nextCall =
    schedule.find(
      (item) => item.rawStatus === 'confirmed' && (!item.startsAt || item.startsAt.getTime() >= Date.now() - 60 * 60 * 1000),
    ) ?? schedule.find((item) => item.rawStatus === 'confirmed');
  const upcomingSchedule = schedule.filter((item) => item.rawStatus !== 'completed').slice(0, 6);
  const recentCases = [...(data?.patients ?? [])]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={Colors.primary} />}
      >
        <LinearGradient colors={[Colors.gradPurpleTop, Colors.gradPurpleBot]} style={styles.header}>
          <SafeAreaView>
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.headerEyebrow}>{greeting},</Text>
                <Text style={styles.headerName}>{data?.doctorName ?? 'Doctor'}</Text>
                <Text style={styles.headerDate}>{today}</Text>
              </View>
              <View style={styles.headerActions}>
                <DoctorNotifications variant="onGradient" onOpenMessages={onOpenMessages} />
                <View style={styles.roleBadge}>
                  <Ionicons name="medkit-outline" size={14} color={Colors.white} />
                  <Text style={styles.roleBadgeText}>Doctor</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          {error && !data && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && !!data && (
            <View style={styles.staleBanner}>
              <Ionicons name="cloud-offline-outline" size={15} color={Colors.tagYellowText} />
              <Text style={styles.staleBannerText}>Couldn’t refresh — showing saved data.</Text>
            </View>
          )}

          {/* Summary metrics */}
          {metrics && (
            <View style={styles.statsGrid}>
              {METRIC_CARDS.map((card) => (
                <MetricCard
                  key={card.key}
                  label={card.label}
                  metric={metrics[card.key]}
                  icon={card.icon}
                  color={card.color}
                />
              ))}
            </View>
          )}

          {/* Next confirmed session — only an online booking offers a call */}
          {nextCall && (
            <View style={styles.nextCallCard}>
              <View style={styles.nextCallRow}>
                <View style={styles.nextCallLeft}>
                  <View style={styles.nextCallIcon}>
                    <Ionicons
                      name={
                        nextCall.consultationMode === 'in_person'
                          ? 'business-outline'
                          : 'videocam'
                      }
                      size={20}
                      color={Colors.white}
                    />
                  </View>
                  <View style={styles.nextCallBody}>
                    <Text style={styles.nextCallLabel}>
                      {nextCall.consultationMode === 'in_person'
                        ? 'Next face-to-face session'
                        : 'Next video call'}
                    </Text>
                    <Text style={styles.nextCallPatient}>{nextCall.patientName}</Text>
                    <Text style={styles.nextCallTime}>
                      {nextCall.dayLabel} · {nextCall.timeLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.webOnlyPill}>
                  <Ionicons
                    name={
                      nextCall.consultationMode === 'in_person'
                        ? 'location-outline'
                        : 'globe-outline'
                    }
                    size={13}
                    color={tone('#5B6EF5')}
                  />
                  <Text style={styles.webOnlyPillText}>
                    {nextCall.consultationMode === 'in_person' ? 'At the clinic' : 'Join on the web'}
                  </Text>
                </View>
              </View>
              <Text style={styles.webOnlyHint}>
                {nextCall.consultationMode === 'in_person'
                  ? 'Meet your patient at the clinic — there is no call to join.'
                  : 'Log in to the MindPulse website to join this video call.'}
              </Text>
            </View>
          )}

          {/* Recent cases */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Cases</Text>
            <TouchableOpacity onPress={() => onNavigate?.('clinics')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.patientsCard}>
            {recentCases.length === 0 && (
              <Text style={styles.emptyText}>
                Patient cases appear here once they book a consultation with you.
              </Text>
            )}
            {recentCases.map((patient, index, arr) => {
              const badge = statusBadge(patient.status);
              const fill = patient.score == null ? 0 : Math.max(0, Math.min(100, patient.score));
              return (
                <View
                  key={patient.id}
                  style={[styles.patientRow, index === arr.length - 1 && styles.rowLast]}
                >
                  <View style={styles.patientAvatar}>
                    {patient.avatarUrl
                      ? <Image source={{ uri: patient.avatarUrl }} style={styles.patientAvatarImage} />
                      : <Text style={styles.patientAvatarText}>{patient.initials}</Text>}
                  </View>
                  <View style={styles.patientBody}>
                    <Text style={styles.patientName} numberOfLines={1}>
                      {patient.name}
                    </Text>
                    <Text style={styles.patientScore}>
                      {patient.score != null ? (
                        <>
                          Stress: <Text style={styles.patientScoreStrong}>{patient.score}%</Text>
                        </>
                      ) : (
                        'No assessment yet'
                      )}
                    </Text>
                    <View style={styles.riskTrack}>
                      <View
                        style={[
                          styles.riskFill,
                          { width: `${fill}%`, backgroundColor: badge.text },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusPillText, { color: badge.text }]}>{patient.status}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Consultations */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming Consultations</Text>
            <TouchableOpacity onPress={() => onNavigate?.('clinics')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scheduleCard}>
            {upcomingSchedule.length === 0 && (
              <Text style={styles.emptyText}>
                No consultations scheduled. Approved bookings show up here with their date and session type.
              </Text>
            )}
            {upcomingSchedule.map((item: DoctorScheduleItem, index) => {
              const pill = STATUS_COLORS[item.rawStatus] ?? STATUS_COLORS.scheduled;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.scheduleRow, index === upcomingSchedule.length - 1 && styles.rowLast]}
                  activeOpacity={0.7}
                  onPress={() => onNavigate?.('clinics')}
                >
                  <View style={styles.scheduleTimeBox}>
                    <Text style={styles.scheduleDay}>{item.dayLabel}</Text>
                    <Text style={styles.scheduleTime}>{item.timeLabel}</Text>
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.schedulePatient} numberOfLines={1}>
                      {item.patientName}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.statusPillText, { color: pill.text }]}>
                        {STATUS_LABELS[item.rawStatus] ?? item.rawStatus}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textHint} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.pageBg },
  loadingText: { color: Colors.textSecondary, ...Typography.body2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 90 },

  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl + 8 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 16 },
  headerEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  headerName: { color: Colors.white, fontSize: 26, fontWeight: '900', marginTop: 2 },
  headerDate: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  roleBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '800' },

  body: {
    backgroundColor: Colors.pageBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },

  errorBox: { backgroundColor: Colors.tagRedBg, borderRadius: Radius.md, padding: Spacing.md, gap: 8 },
  errorText: { color: Colors.tagRedText, fontSize: 13, lineHeight: 18 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: toneBtn(Colors.btnBlue), paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18 },
  retryText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.tagYellowBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  staleBannerText: { color: Colors.tagYellowText, fontSize: 12, fontWeight: '700', flex: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  statIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  statNote: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  nextCallCard: {
    backgroundColor: toneBg('#5B6EF5'),
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
  },
  nextCallRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextCallLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nextCallBody: { flex: 1 },
  nextCallIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  nextCallLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextCallPatient: { color: Colors.white, fontSize: 15, fontWeight: '800', marginTop: 1 },
  nextCallTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  webOnlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: toneBg(Colors.white),
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  webOnlyPillText: { color: tone('#5B6EF5'), fontWeight: '800', fontSize: 12 },
  webOnlyHint: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, lineHeight: 16 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: Colors.textPrimary, ...Typography.h3 },
  seeAll: { color: Colors.btnBlue, fontSize: 13, fontWeight: '700' },

  scheduleCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  scheduleTimeBox: {
    width: 86,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    paddingVertical: 7,
    alignItems: 'center',
  },
  scheduleDay: { fontSize: 10, fontWeight: '800', color: Colors.primaryDark, textTransform: 'uppercase' },
  scheduleTime: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark, marginTop: 1 },
  scheduleInfo: { flex: 1, gap: 4 },
  schedulePatient: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },
  emptyText: { fontSize: 13, color: Colors.textHint, textAlign: 'center', paddingVertical: 18, fontStyle: 'italic', paddingHorizontal: 8 },
  rowLast: { borderBottomWidth: 0 },

  patientsCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  patientAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: toneBg('#E8ECFA'), alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 13, fontWeight: '800', color: tone('#5B6EF5') },
  patientAvatarImage: { width: 38, height: 38, borderRadius: 19 },
  patientBody: { flex: 1, gap: 3 },
  patientName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  patientScore: { fontSize: 11.5, color: Colors.textSecondary },
  patientScoreStrong: { fontWeight: '800', color: Colors.textPrimary },
  riskTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden', marginTop: 3 },
  riskFill: { height: 5, borderRadius: 3 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
