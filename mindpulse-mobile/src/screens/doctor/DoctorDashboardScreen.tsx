import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  DoctorDashboardData,
  DoctorScheduleItem,
  fetchDoctorDashboard,
} from '../../services/doctorDashboard';

interface DoctorDashboardScreenProps {
  onNavigate?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
  onStartVideoCall?: (appointmentId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Requested',
  awaiting_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: '#FCECEC', text: '#C05656' },
  awaiting_payment: { bg: Colors.tagBlueBg, text: Colors.tagBlueText },
  confirmed: { bg: Colors.tagGreenBg, text: Colors.tagGreenText },
  completed: { bg: Colors.divider, text: Colors.textSecondary },
  declined: { bg: Colors.tagRedBg, text: Colors.tagRedText },
  cancelled: { bg: Colors.divider, text: Colors.textHint },
};

const StatCard = ({ label, value, icon, color }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; color: string }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconWrap, { backgroundColor: `${color}1A` }]}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const DoctorDashboardScreen: React.FC<DoctorDashboardScreenProps> = ({
  onNavigate,
  onStartVideoCall,
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

  const stats = data?.stats;
  const schedule = data?.schedule ?? [];
  const nextCall =
    schedule.find(
      (item) => item.rawStatus === 'confirmed' && (!item.startsAt || item.startsAt.getTime() >= Date.now() - 60 * 60 * 1000),
    ) ?? schedule.find((item) => item.rawStatus === 'confirmed');
  const upcomingSchedule = schedule.filter((item) => item.rawStatus !== 'completed').slice(0, 6);
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
              <View style={styles.roleBadge}>
                <Ionicons name="medkit-outline" size={14} color={Colors.white} />
                <Text style={styles.roleBadgeText}>Doctor</Text>
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

          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCard label="Patients" value={stats?.patients ?? 0} icon="people-outline" color="#5B6EF5" />
            <StatCard label="Appointments" value={stats?.appointments ?? 0} icon="calendar-outline" color="#DB8D62" />
            <StatCard label="Upcoming" value={stats?.upcoming ?? 0} icon="time-outline" color="#27AE60" />
            <StatCard label="Risk Alerts" value={stats?.riskAlerts ?? 0} icon="warning-outline" color="#E05C5C" />
          </View>

          {/* Next confirmed call */}
          {nextCall && (
            <View style={styles.nextCallCard}>
              <View style={styles.nextCallLeft}>
                <View style={styles.nextCallIcon}>
                  <Ionicons name="videocam" size={20} color={Colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextCallLabel}>Next video call</Text>
                  <Text style={styles.nextCallPatient}>{nextCall.patientName}</Text>
                  <Text style={styles.nextCallTime}>
                    {nextCall.dayLabel} · {nextCall.timeLabel}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.joinBtn}
                onPress={() => onStartVideoCall?.(nextCall.id)}
                activeOpacity={0.85}
              >
                <Ionicons name="videocam" size={15} color={Colors.white} />
                <Text style={styles.joinBtnText}>Join</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Schedule */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
            <TouchableOpacity onPress={() => onNavigate?.('clinics')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scheduleCard}>
            {upcomingSchedule.length === 0 && (
              <Text style={styles.emptyText}>
                No upcoming appointments. Patients who book with you will appear here.
              </Text>
            )}
            {upcomingSchedule.map((item: DoctorScheduleItem, index) => {
              const pill = STATUS_COLORS[item.rawStatus] ?? STATUS_COLORS.scheduled;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.scheduleRow, index === upcomingSchedule.length - 1 && { borderBottomWidth: 0 }]}
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

          {/* Patients */}
          <Text style={styles.sectionTitle}>My Patients</Text>
          <View style={styles.patientsCard}>
            {(data?.patients ?? []).length === 0 && (
              <Text style={styles.emptyText}>Patients appear here once they book a consultation with you.</Text>
            )}
            {(data?.patients ?? []).slice(0, 5).map((patient, index, arr) => {
              const badge =
                patient.status === 'Critical'
                  ? { bg: Colors.tagRedBg, text: Colors.tagRedText }
                  : patient.status === 'Watch'
                    ? { bg: Colors.tagYellowBg, text: Colors.tagYellowText }
                    : patient.status === 'Stable'
                      ? { bg: Colors.tagGreenBg, text: Colors.tagGreenText }
                      : { bg: Colors.divider, text: Colors.textHint };
              return (
                <View
                  key={patient.id}
                  style={[styles.patientRow, index === arr.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientAvatarText}>{patient.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName} numberOfLines={1}>
                      {patient.name}
                    </Text>
                    <Text style={styles.patientScore}>
                      {patient.score != null ? `Latest stress score ${patient.score}` : 'No assessments yet'}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusPillText, { color: badge.text }]}>{patient.status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  retryBtn: { alignSelf: 'flex-start', backgroundColor: Colors.btnBlue, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18 },
  retryText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

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
  statIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  nextCallCard: {
    backgroundColor: '#5B6EF5',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextCallLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nextCallIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  nextCallLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextCallPatient: { color: Colors.white, fontSize: 15, fontWeight: '800', marginTop: 1 },
  nextCallTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.full,
  },
  joinBtnText: { color: '#5B6EF5', fontWeight: '800', fontSize: 13 },

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

  patientsCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  patientAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8ECFA', alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 13, fontWeight: '800', color: '#5B6EF5' },
  patientName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  patientScore: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
});
