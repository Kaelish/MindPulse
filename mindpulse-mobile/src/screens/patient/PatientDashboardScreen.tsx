import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppRadius, AppSpacing, AppTypography, Shadows } from '../../theme/tokens';
import {
  DashboardMetrics,
  NotificationItem,
  PatientDashboardData,
  StressSessionItem,
  fetchDashboardData,
} from '../../services/dashboard';

export type DashboardTab = 'home' | 'analysis' | 'clinics' | 'profile';

interface PatientDashboardScreenProps {
  activeTab?: DashboardTab;
  onNavigate?: (tab: DashboardTab) => void;
  onStartVideoCall?: () => void;
  onRunSurvey?: () => void;
  onRunFaceScan?: () => void;
  onRunDailyCheck?: () => void;
}

/* Custom Vector-Like Icon Components using React Native Views */
const BellIcon = () => (
  <View style={iconStyles.bellWrap}>
    <View style={iconStyles.bellTop} />
    <View style={iconStyles.bellBody} />
    <View style={iconStyles.bellClapper} />
  </View>
);

const ClipboardIcon = () => (
  <View style={iconStyles.clipboardWrap}>
    <View style={iconStyles.clipboardBody} />
    <View style={iconStyles.clipboardClip} />
    <View style={iconStyles.clipboardLine1} />
    <View style={iconStyles.clipboardLine2} />
  </View>
);

const CameraIcon = () => (
  <View style={iconStyles.cameraWrap}>
    <View style={iconStyles.cameraBody} />
    <View style={iconStyles.cameraLens} />
    <View style={iconStyles.cameraFlash} />
  </View>
);

const GraphIcon = () => (
  <View style={iconStyles.graphWrap}>
    <View style={[iconStyles.graphBar, { height: 7 }]} />
    <View style={[iconStyles.graphBar, { height: 12 }]} />
    <View style={[iconStyles.graphBar, { height: 17 }]} />
  </View>
);

const VideoCameraIcon = () => (
  <View style={iconStyles.videoWrap}>
    <View style={iconStyles.videoBody} />
    <View style={iconStyles.videoLens} />
  </View>
);

const BrainIcon = () => (
  <View style={iconStyles.brainWrap}>
    <View style={iconStyles.brainLeft} />
    <View style={iconStyles.brainRight} />
  </View>
);

const HomeTabIcon = ({ active }: { active?: boolean }) => (
  <View style={[iconStyles.homeWrap, active && iconStyles.tabActiveCircle]}>
    <View style={iconStyles.homeRoof} />
    <View style={iconStyles.homeBase} />
  </View>
);

const AnalysisTabIcon = () => (
  <View style={iconStyles.analysisWrap}>
    <View style={iconStyles.analysisCircle} />
    <View style={iconStyles.analysisDot} />
  </View>
);

const ClinicsTabIcon = () => (
  <View style={iconStyles.clinicsWrap}>
    <View style={iconStyles.stethoscopeTube} />
    <View style={iconStyles.stethoscopeBell} />
  </View>
);

const ProfileTabIcon = () => (
  <View style={iconStyles.profileWrap}>
    <View style={iconStyles.profileHead} />
    <View style={iconStyles.profileBody} />
  </View>
);

export const PatientDashboardScreen: React.FC<PatientDashboardScreenProps> = ({
  activeTab = 'home',
  onNavigate,
  onStartVideoCall,
  onRunSurvey,
  onRunFaceScan,
  onRunDailyCheck,
}) => {
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<StressSessionItem | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      const res = await fetchDashboardData();
      if (isMounted) {
        setData(res);
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5B8FD9" />
        <Text style={styles.loadingText}>Loading MindPulse Dashboard...</Text>
      </View>
    );
  }

  const { userName, greetingDate, metrics, recentSessions, notifications } = data;
  const displaySessions = showAllSessions ? recentSessions : recentSessions.slice(0, 5);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Green Gradient theme */}
        <View style={styles.headerGradient}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.greetingEyebrow}>Good Morning,</Text>
              <View style={styles.nameRow}>
                <Text style={styles.greetingName}>{userName}</Text>
                <Text style={styles.waveEmoji}>👋</Text>
              </View>
              <Text style={styles.dateSubtext}>{greetingDate}</Text>
            </View>

            <TouchableOpacity
              style={styles.bellButton}
              activeOpacity={0.8}
              onPress={() => setShowNotificationsModal(true)}
            >
              <BellIcon />
              {unreadCount > 0 && <View style={styles.unreadBadge} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Dashboard Rounded Container */}
        <View style={styles.mainContainer}>
          {/* Latest Stress Level Card */}
          <TouchableOpacity
            style={styles.latestStressCard}
            activeOpacity={0.9}
            onPress={() => {
              if (recentSessions.length > 0) {
                setSelectedSession(recentSessions[0]);
              }
            }}
          >
            <View style={styles.latestStressLeft}>
              <Text style={styles.latestStressTitle}>Latest Stress Level</Text>
              <Text style={styles.latestStressValue}>{metrics.latestLevel}</Text>
              <Text style={styles.latestStressTrend}>📈 {metrics.latestTrend}</Text>
            </View>

            <View style={styles.scoreCircleWrap}>
              <Text style={styles.scoreCircleValue}>{metrics.latestScore}</Text>
              <Text style={styles.scoreCircleLabel}>Score</Text>
            </View>
          </TouchableOpacity>

          {/* Quick Actions Header */}
          <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>

          {/* Quick Actions Grid */}
          <View style={styles.quickActionsGrid}>
            {/* 1. Survey */}
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: '#EEEDFE' }]}
              activeOpacity={0.85}
              onPress={onRunSurvey}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#5B6EF5' }]}>
                <ClipboardIcon />
              </View>
              <Text style={[styles.quickActionLabel, { color: '#5B6EF5' }]}>Survey</Text>
            </TouchableOpacity>

            {/* 2. Face Scan */}
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: '#F9F4E5' }]}
              activeOpacity={0.85}
              onPress={onRunFaceScan || (() => onNavigate?.('analysis'))}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#D9B346' }]}>
                <CameraIcon />
              </View>
              <Text style={[styles.quickActionLabel, { color: '#B08B28' }]}>Face Scan</Text>
            </TouchableOpacity>

            {/* 3. Analysis */}
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: '#E6F7F5' }]}
              activeOpacity={0.85}
              onPress={() => onNavigate?.('analysis')}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#38B2AC' }]}>
                <GraphIcon />
              </View>
              <Text style={[styles.quickActionLabel, { color: '#2C7A7B' }]}>Analysis</Text>
            </TouchableOpacity>

            {/* 4. Consult */}
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: '#FDECEF' }]}
              activeOpacity={0.85}
              onPress={() => onNavigate?.('clinics')}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: '#EE7773' }]}>
                <VideoCameraIcon />
              </View>
              <Text style={[styles.quickActionLabel, { color: '#C54E4A' }]}>Consult</Text>
            </TouchableOpacity>
          </View>

          {/* Daily Stress Check Banner */}
          <TouchableOpacity
            style={styles.dailyCheckBanner}
            activeOpacity={0.9}
            onPress={onRunDailyCheck || (() => onNavigate?.('analysis'))}
          >
            <View style={styles.dailyCheckBrainBox}>
              <BrainIcon />
            </View>

            <View style={styles.dailyCheckTextWrap}>
              <Text style={styles.dailyCheckTitle}>Daily Stress Check</Text>
              <Text style={styles.dailyCheckSub}>Survey + Face + HR Analysis</Text>
            </View>

            <View style={styles.dailyCheckArrowCircle}>
              <Text style={styles.dailyCheckArrowText}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Metrics Cards (2 side-by-side) */}
          <View style={styles.metricsRow}>
            {/* Avg Heart Rate */}
            <TouchableOpacity
              style={styles.metricCard}
              activeOpacity={0.85}
              onPress={() => onNavigate?.('analysis')}
            >
              <View style={styles.metricHeaderRow}>
                <Text style={styles.metricIconEmoji}>❤️</Text>
                <Text style={styles.metricTitle}>Avg Heart Rate</Text>
              </View>

              <View style={styles.metricValueRow}>
                <Text style={styles.metricValueNum}>{metrics.avgHeartRate}</Text>
                <Text style={styles.metricUnit}>bpm</Text>
              </View>

              <Text style={[styles.metricSubtext, { color: '#E05C5C' }]}>
                {metrics.avgHeartRateStatus}
              </Text>
            </TouchableOpacity>

            {/* Avg Stress */}
            <TouchableOpacity
              style={styles.metricCard}
              activeOpacity={0.85}
              onPress={() => onNavigate?.('analysis')}
            >
              <View style={styles.metricHeaderRow}>
                <Text style={styles.metricIconEmoji}>📈</Text>
                <Text style={styles.metricTitle}>Avg Stress</Text>
              </View>

              <View style={styles.metricValueRow}>
                <Text style={styles.metricValueNum}>{metrics.avgStressScore}</Text>
                <Text style={styles.metricUnit}>/100</Text>
              </View>

              <Text style={[styles.metricSubtext, { color: '#E08A00' }]}>
                {metrics.avgStressStatus}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recent Sessions Header */}
          <View style={styles.sessionsHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => setShowAllSessions(!showAllSessions)}>
              <Text style={styles.seeAllText}>{showAllSessions ? 'Show less' : 'See all'}</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Sessions List */}
          <View style={styles.sessionsList}>
            {displaySessions.map((session) => {
              const badgeBg =
                session.statusColor === 'pink'
                  ? '#FCE5DE'
                  : session.statusColor === 'yellow'
                  ? '#FFF3CD'
                  : '#D6F5E3';

              const badgeTextColor =
                session.statusColor === 'pink'
                  ? '#E05C5C'
                  : session.statusColor === 'yellow'
                  ? '#E08A00'
                  : '#27AE60';

              return (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionItemCard}
                  activeOpacity={0.85}
                  onPress={() => setSelectedSession(session)}
                >
                  <View style={[styles.sessionScoreBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.sessionScoreBadgeText, { color: badgeTextColor }]}>
                      {session.score}
                    </Text>
                  </View>

                  <View style={styles.sessionTextWrap}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    <Text style={styles.sessionDate}>{session.date}</Text>
                  </View>

                  <View style={[styles.sessionPill, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.sessionPillText, { color: badgeTextColor }]}>
                      {session.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.8}
          onPress={() => onNavigate?.('home')}
        >
          <HomeTabIcon active={activeTab === 'home'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.8}
          onPress={() => onNavigate?.('analysis')}
        >
          <AnalysisTabIcon />
          <Text style={[styles.tabLabel, activeTab === 'analysis' && styles.tabLabelActive]}>
            Analysis
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.8}
          onPress={() => onNavigate?.('clinics')}
        >
          <ClinicsTabIcon />
          <Text style={[styles.tabLabel, activeTab === 'clinics' && styles.tabLabelActive]}>
            Clinics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.8}
          onPress={() => onNavigate?.('profile')}
        >
          <ProfileTabIcon />
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Session Details Modal */}
      {selectedSession && (
        <Modal
          visible={Boolean(selectedSession)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedSession(null)}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalBox}>
              <Text style={modalStyles.modalTitle}>Session Details</Text>
              <Text style={modalStyles.modalScore}>
                Score: {selectedSession.score} / 100 ({selectedSession.status})
              </Text>
              <Text style={modalStyles.modalDate}>{selectedSession.date}</Text>

              {selectedSession.heartRate ? (
                <Text style={modalStyles.modalMeta}>
                  Recorded Heart Rate: {selectedSession.heartRate} bpm
                </Text>
              ) : null}

              {selectedSession.notes ? (
                <View style={modalStyles.notesBox}>
                  <Text style={modalStyles.notesLabel}>Analysis Notes:</Text>
                  <Text style={modalStyles.notesText}>{selectedSession.notes}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={modalStyles.closeButton}
                onPress={() => setSelectedSession(null)}
              >
                <Text style={modalStyles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <Modal
          visible={showNotificationsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNotificationsModal(false)}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalBox}>
              <Text style={modalStyles.modalTitle}>Notifications</Text>

              <ScrollView style={{ maxHeight: 260, marginVertical: 10 }}>
                {notifications.map((n) => (
                  <View key={n.id} style={modalStyles.notifItem}>
                    <Text style={modalStyles.notifTitle}>{n.title}</Text>
                    <Text style={modalStyles.notifBody}>{n.message}</Text>
                    <Text style={modalStyles.notifTime}>{n.time}</Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={modalStyles.closeButton}
                onPress={() => setShowNotificationsModal(false)}
              >
                <Text style={modalStyles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const iconStyles = StyleSheet.create({
  bellWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellTop: {
    width: 4,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  bellBody: {
    width: 14,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  bellClapper: {
    width: 5,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginTop: 1,
  },
  clipboardWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
  },
  clipboardBody: {
    width: 16,
    height: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 3,
  },
  clipboardClip: {
    width: 8,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    position: 'absolute',
    top: -1,
  },
  clipboardLine1: {
    width: 8,
    height: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 6,
  },
  clipboardLine2: {
    width: 8,
    height: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 10,
  },
  cameraWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBody: {
    width: 18,
    height: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  cameraLens: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 2,
    borderColor: '#D9B346',
    position: 'absolute',
  },
  cameraFlash: {
    width: 5,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    position: 'absolute',
    top: 1,
    right: 2,
  },
  graphWrap: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  graphBar: {
    width: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  videoWrap: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBody: {
    width: 12,
    height: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  videoLens: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderTopColor: 'transparent',
    borderBottomWidth: 5,
    borderBottomColor: 'transparent',
    borderLeftWidth: 6,
    borderLeftColor: '#FFFFFF',
    marginLeft: 2,
  },
  brainWrap: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  brainLeft: {
    width: 8,
    height: 14,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  brainRight: {
    width: 8,
    height: 14,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  homeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tabActiveCircle: {
    backgroundColor: '#3575DA',
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
    borderRightWidth: 8,
    borderRightColor: 'transparent',
    borderBottomWidth: 7,
    borderBottomColor: '#FFFFFF',
  },
  homeBase: {
    width: 12,
    height: 9,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  analysisWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  analysisDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  clinicsWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stethoscopeTube: {
    width: 14,
    height: 12,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopWidth: 0,
  },
  stethoscopeBell: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginTop: 1,
  },
  profileWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  profileBody: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: '#FFFFFF',
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#E2F8E2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 85,
  },
  headerGradient: {
    backgroundColor: '#D6F5D6',
    paddingHorizontal: AppSpacing.lg,
    paddingTop: AppSpacing.xl + 10,
    paddingBottom: AppSpacing.xl,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingEyebrow: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B6B4B',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  greetingName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2D1A',
  },
  waveEmoji: {
    fontSize: 22,
    marginLeft: 6,
  },
  dateSubtext: {
    fontSize: 13,
    color: '#5A7B5A',
    marginTop: 4,
    fontWeight: '500',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(134, 169, 134, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05C5C',
  },
  mainContainer: {
    backgroundColor: '#FAF8ED',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -16,
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.lg,
    paddingBottom: AppSpacing.xl,
    gap: AppSpacing.md,
  },
  latestStressCard: {
    backgroundColor: '#FCE5DE',
    borderRadius: 22,
    padding: AppSpacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  latestStressLeft: {
    flex: 1,
  },
  latestStressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  latestStressValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  latestStressTrend: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E05C5C',
    marginTop: 6,
  },
  scoreCircleWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },
  scoreCircleValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E05C5C',
  },
  scoreCircleLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: -2,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  dailyCheckBanner: {
    backgroundColor: '#5B9EF7',
    borderRadius: 22,
    padding: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyCheckBrainBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyCheckTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  dailyCheckTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dailyCheckSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  dailyCheckArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyCheckArrowText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: -2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: AppSpacing.md,
    ...Shadows.small,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricIconEmoji: {
    fontSize: 15,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    gap: 4,
  },
  metricValueNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricUnit: {
    fontSize: 12,
    color: '#64748B',
  },
  metricSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  sessionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#27AE60',
  },
  sessionsList: {
    gap: 10,
  },
  sessionItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.small,
  },
  sessionScoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionScoreBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  sessionTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sessionPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sessionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#5B9EF7',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8ED',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    ...Shadows.small,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B9EF7',
  },
  modalDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  modalMeta: {
    fontSize: 13,
    color: '#334155',
    marginTop: 8,
    fontWeight: '600',
  },
  notesBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  notesText: {
    fontSize: 13,
    color: '#1E293B',
    marginTop: 4,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#5B9EF7',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  notifItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  notifBody: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});
