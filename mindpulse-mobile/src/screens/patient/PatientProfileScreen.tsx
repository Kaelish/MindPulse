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
import { AppSpacing, Shadows } from '../../theme/tokens';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { PlantProgressScreen } from './PlantProgressScreen';
import {
  PatientDashboardData,
  StressSessionItem,
  fetchDashboardData,
} from '../../services/dashboard';

export type ProfileTabSegment = 'profile' | 'history' | 'settings';

interface PatientProfileScreenProps {
  onNavigateHome?: () => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
  onSignOut?: () => void;
  onOpenHealthSetup?: () => void;
}

/* Custom Styled Icons for Profile & Settings */
const ChevronDownIcon = () => (
  <View style={iconStyles.chevronDown} />
);

const ChevronUpIcon = () => (
  <View style={iconStyles.chevronUp} />
);

const ChevronRightIcon = () => (
  <View style={iconStyles.chevronRight} />
);

const BellIconSmall = () => (
  <View style={[iconStyles.iconCircle, { backgroundColor: '#EEEDFE' }]}>
    <Text style={iconStyles.iconEmoji}>🔔</Text>
  </View>
);

const ShieldIconSmall = () => (
  <View style={[iconStyles.iconCircle, { backgroundColor: '#E6F0FA' }]}>
    <Text style={iconStyles.iconEmoji}>🛡️</Text>
  </View>
);

const InfoIconSmall = () => (
  <View style={[iconStyles.iconCircle, { backgroundColor: '#E6F7F5' }]}>
    <Text style={iconStyles.iconEmoji}>ℹ️</Text>
  </View>
);

const BrainIconSmall = () => (
  <View style={[iconStyles.iconCircle, { backgroundColor: '#EEEDFE' }]}>
    <Text style={iconStyles.iconEmoji}>🧠</Text>
  </View>
);

/* Simple SVG-Like Chart Components using React Native Views */
const StressTrendChart = () => {
  const points = [
    { x: 'Mar 15', y: 50 },
    { x: 'Mar 20', y: 22 },
    { x: 'Mar 25', y: 85 },
    { x: 'Mar 28', y: 42 },
    { x: 'Apr 1', y: 68 },
  ];

  return (
    <View style={chartStyles.chartContainer}>
      <Text style={chartStyles.chartTitle}>Stress Score Trend</Text>

      <View style={chartStyles.chartGrid}>
        {/* Y Axis Labels */}
        <View style={chartStyles.yAxis}>
          <Text style={chartStyles.axisLabel}>100</Text>
          <Text style={chartStyles.axisLabel}>75</Text>
          <Text style={chartStyles.axisLabel}>50</Text>
          <Text style={chartStyles.axisLabel}>25</Text>
          <Text style={chartStyles.axisLabel}>0</Text>
        </View>

        {/* Graph Plot Area */}
        <View style={chartStyles.plotArea}>
          <View style={chartStyles.gridLineTop} />
          <View style={chartStyles.gridLineMid} />
          <View style={chartStyles.gridLineBot} />

          {/* Connected Curved Line Simulation with Dots */}
          <View style={chartStyles.dotsRow}>
            {points.map((p, idx) => {
              const bottomPercent = p.y;
              return (
                <View key={idx} style={chartStyles.dotCol}>
                  <View
                    style={[
                      chartStyles.purpleDotPoint,
                      { bottom: `${bottomPercent}%` },
                    ]}
                  >
                    <View style={chartStyles.dotInner} />
                  </View>
                </View>
              );
            })}
          </View>
          <View style={chartStyles.purpleShadeOverlay} />
        </View>
      </View>

      {/* X Axis Labels */}
      <View style={chartStyles.xAxis}>
        {points.map((p, idx) => (
          <Text key={idx} style={chartStyles.axisLabel}>
            {p.x}
          </Text>
        ))}
      </View>
    </View>
  );
};

const HeartRateTrendChart = () => {
  const points = [
    { x: 'Mar 15', y: 76 },
    { x: 'Mar 20', y: 64 },
    { x: 'Mar 25', y: 94 },
    { x: 'Mar 28', y: 72 },
    { x: 'Apr 1', y: 88 },
  ];

  return (
    <View style={chartStyles.chartContainer}>
      <Text style={chartStyles.chartTitle}>Heart Rate History (BPM)</Text>

      <View style={chartStyles.chartGrid}>
        {/* Y Axis Labels */}
        <View style={chartStyles.yAxis}>
          <Text style={chartStyles.axisLabel}>120</Text>
          <Text style={chartStyles.axisLabel}>90</Text>
          <Text style={chartStyles.axisLabel}>70</Text>
          <Text style={chartStyles.axisLabel}>50</Text>
        </View>

        {/* Graph Plot Area */}
        <View style={chartStyles.plotArea}>
          <View style={chartStyles.gridLineTop} />
          <View style={chartStyles.gridLineMid} />
          <View style={chartStyles.gridLineBot} />

          {/* Connected Curved Line Simulation with Dots */}
          <View style={chartStyles.dotsRow}>
            {points.map((p, idx) => {
              // Scale Y value 50..120 to percentage 0..100
              const bottomPercent = Math.max(0, Math.min(100, ((p.y - 50) / 70) * 100));
              return (
                <View key={idx} style={chartStyles.dotCol}>
                  <View
                    style={[
                      chartStyles.redDotPoint,
                      { bottom: `${bottomPercent}%` },
                    ]}
                  >
                    <View style={chartStyles.dotInner} />
                  </View>
                </View>
              );
            })}
          </View>
          <View style={chartStyles.redShadeOverlay} />
        </View>
      </View>

      {/* X Axis Labels */}
      <View style={chartStyles.xAxis}>
        {points.map((p, idx) => (
          <Text key={idx} style={chartStyles.axisLabel}>
            {p.x}
          </Text>
        ))}
      </View>
    </View>
  );
};

export const PatientProfileScreen: React.FC<PatientProfileScreenProps> = ({
  onNavigateTab,
  onSignOut,
  onOpenHealthSetup,
}) => {
  const [activeSegment, setActiveSegment] = useState<ProfileTabSegment>('history');
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>('s-101');
  const [infoModalTitle, setInfoModalTitle] = useState<string | null>(null);
  const [infoModalMessage, setInfoModalMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const res = await fetchDashboardData();
      if (isMounted) {
        setData(res);
        setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5B8FD9" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  const { userName, userEmail, userInitials, metrics, recentSessions } = data;

  const toggleExpand = (id: string) => {
    setExpandedSessionId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Card Container */}
        <View style={styles.topHeaderCard}>
          {/* User Info Row */}
          <View style={styles.userRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>

            <View style={styles.userTextWrap}>
              <Text style={styles.userNameText}>{userName}</Text>
              <Text style={styles.userEmailText}>{userEmail}</Text>
            </View>
          </View>

          {/* 3 Summary Statistics Cards Side-by-Side */}
          <View style={styles.statsRow}>
            {/* 1. Assessments */}
            <View style={[styles.statCard, { backgroundColor: '#EEEDFE' }]}>
              <Text style={[styles.statLabel, { color: '#5B6EF5' }]}>Assessments</Text>
              <Text style={[styles.statValue, { color: '#5B6EF5' }]}>
                {metrics.totalAssessments}
              </Text>
            </View>

            {/* 2. Average Stress */}
            <View style={[styles.statCard, { backgroundColor: '#F9F4E5' }]}>
              <Text style={[styles.statLabel, { color: '#B08B28' }]}>Average Stress</Text>
              <Text style={[styles.statValue, { color: '#B08B28' }]}>
                {metrics.avgStressScore}/100
              </Text>
            </View>

            {/* 3. Average HR */}
            <View style={[styles.statCard, { backgroundColor: '#E6F7F5' }]}>
              <Text style={[styles.statLabel, { color: '#2C7A7B' }]}>Average HR</Text>
              <Text style={[styles.statValue, { color: '#2C7A7B' }]}>
                {metrics.avgHeartRate} bpm
              </Text>
            </View>
          </View>

          {/* Tab Segment Switcher */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentItem,
                activeSegment === 'profile' && styles.segmentItemActive,
              ]}
              onPress={() => setActiveSegment('profile')}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'profile' && styles.segmentTextActive,
                ]}
              >
                My Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentItem,
                activeSegment === 'history' && styles.segmentItemActive,
              ]}
              onPress={() => setActiveSegment('history')}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'history' && styles.segmentTextActive,
                ]}
              >
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentItem,
                activeSegment === 'settings' && styles.segmentItemActive,
              ]}
              onPress={() => setActiveSegment('settings')}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'settings' && styles.segmentTextActive,
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Body View */}
        {activeSegment === 'history' ? (
          /* HISTORY TAB CONTENT */
          <View style={styles.tabBody}>
            {/* Stress Score Trend Chart */}
            <StressTrendChart />

            {/* Heart Rate History Chart */}
            <HeartRateTrendChart />

            {/* ALL SESSIONS Section */}
            <Text style={styles.sectionHeaderTitle}>ALL SESSIONS</Text>

            <View style={styles.sessionsList}>
              {recentSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;

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
                  <View key={session.id} style={styles.sessionCardOuter}>
                    {/* Collapsed Header Bar */}
                    <TouchableOpacity
                      style={styles.sessionHeaderRow}
                      activeOpacity={0.85}
                      onPress={() => toggleExpand(session.id)}
                    >
                      <View style={[styles.sessionScoreBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.sessionScoreBadgeText, { color: badgeTextColor }]}>
                          {session.score}
                        </Text>
                      </View>

                      <View style={styles.sessionTitleWrap}>
                        <View style={styles.sessionTitleRow}>
                          <Text style={styles.sessionTitleText}>{session.title}</Text>
                          <View style={[styles.sessionPill, { backgroundColor: badgeBg }]}>
                            <Text style={[styles.sessionPillText, { color: badgeTextColor }]}>
                              {session.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.sessionDateText}>📅 {session.date}</Text>
                      </View>

                      <View style={styles.chevronWrap}>
                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </View>
                    </TouchableOpacity>

                    {/* Expanded Session Detail Box (Matching Image 2) */}
                    {isExpanded && (
                      <View style={styles.expandedDetailBox}>
                        {/* 4 Grid Sub-metrics */}
                        <View style={styles.expandedGrid}>
                          {/* 1. Survey Score */}
                          <View style={styles.gridMetricCard}>
                            <Text style={styles.gridMetricIcon}>🌐</Text>
                            <View>
                              <Text style={styles.gridMetricLabel}>Survey Score</Text>
                              <Text style={[styles.gridMetricValue, { color: '#5B6EF5' }]}>
                                {session.surveyScore ?? session.score}/100
                              </Text>
                            </View>
                          </View>

                          {/* 2. Heart Rate */}
                          <View style={styles.gridMetricCard}>
                            <Text style={styles.gridMetricIcon}>❤️</Text>
                            <View>
                              <Text style={styles.gridMetricLabel}>Heart Rate</Text>
                              <Text style={[styles.gridMetricValue, { color: '#E05C5C' }]}>
                                {session.heartRate ?? 88} bpm
                              </Text>
                            </View>
                          </View>

                          {/* 3. Emotion */}
                          <View style={styles.gridMetricCard}>
                            <Text style={styles.gridMetricIcon}>😃</Text>
                            <View>
                              <Text style={styles.gridMetricLabel}>Emotion</Text>
                              <Text style={[styles.gridMetricValue, { color: '#3B82F6' }]}>
                                {session.emotion ?? 'Anxious'}
                              </Text>
                            </View>
                          </View>

                          {/* 4. Reaction */}
                          <View style={styles.gridMetricCard}>
                            <Text style={styles.gridMetricIcon}>⚡</Text>
                            <View>
                              <Text style={styles.gridMetricLabel}>Reaction</Text>
                              <Text style={[styles.gridMetricValue, { color: '#D97706' }]}>
                                {session.reactionTimeMs ?? 430}ms
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Overall Score Track */}
                        <View style={styles.overallTrackWrap}>
                          <View style={styles.overallHeaderRow}>
                            <Text style={styles.overallLabel}>Overall Score</Text>
                            <Text style={styles.overallValue}>{session.score}/100</Text>
                          </View>
                          <View style={styles.overallTrackBg}>
                            <View
                              style={[
                                styles.overallTrackFill,
                                { width: `${session.score}%`, backgroundColor: badgeTextColor },
                              ]}
                            />
                          </View>
                        </View>

                        {/* Face scan confidence */}
                        <Text style={styles.confidenceText}>
                          Face scan confidence: <Text style={styles.confidenceHighlight}>{session.faceConfidencePercent ?? 71}%</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : activeSegment === 'settings' ? (
          /* SETTINGS TAB CONTENT (Matching Image 1 Right) */
          <View style={styles.tabBody}>
            {/* APP Section */}
            <Text style={styles.sectionHeaderTitle}>APP</Text>
            <View style={styles.settingsGroupCard}>
              {/* Notifications */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  setInfoModalTitle('Notification Settings');
                  setInfoModalMessage('Daily reminders are enabled. Notifications will trigger after 5:00 PM.');
                }}
              >
                <BellIconSmall />
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Notifications</Text>
                  <Text style={styles.settingSub}>Daily reminders</Text>
                </View>
                <ChevronRightIcon />
              </TouchableOpacity>

              <View style={styles.settingDivider} />

              {/* Privacy & Data */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  setInfoModalTitle('Privacy & Data Policy');
                  setInfoModalMessage('Your health biometric data is encrypted end-to-end and stored securely on Supabase servers.');
                }}
              >
                <ShieldIconSmall />
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Privacy & Data</Text>
                  <Text style={styles.settingSub}>View data policy</Text>
                </View>
                <ChevronRightIcon />
              </TouchableOpacity>

              <View style={styles.settingDivider} />

              {/* About MindPulse */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  setInfoModalTitle('About MindPulse');
                  setInfoModalMessage('MindPulse AI v1.0.0 – Comprehensive mobile stress monitoring and clinical assessment suite.');
                }}
              >
                <InfoIconSmall />
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>About MindPulse</Text>
                  <Text style={styles.settingSub}>Version 1.0.0</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ACCOUNT Section */}
            <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>ACCOUNT</Text>
            <View style={styles.settingsGroupCard}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  onOpenHealthSetup?.();
                }}
              >
                <BrainIconSmall />
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Health Background</Text>
                  <Text style={styles.settingSub}>Update your health profile</Text>
                </View>
                <ChevronRightIcon />
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.signOutButton}
              activeOpacity={0.85}
              onPress={onSignOut}
            >
              <Text style={styles.signOutText}>↳ Sign Out</Text>
            </TouchableOpacity>

            {/* Disclaimer Footer */}
            <Text style={styles.disclaimerText}>
              MindPulse v1.0.0 · For educational purposes only. This app does not replace professional medical advice.
            </Text>
          </View>
        ) : (
          /* MY PROFILE TAB CONTENT */
          <PlantProgressScreen onBack={() => setActiveSegment('history')} />
        )}
      </ScrollView>

      {/* Settings Info Modal */}
      {infoModalTitle && (
        <Modal
          visible={Boolean(infoModalTitle)}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoModalTitle(null)}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalBox}>
              <Text style={modalStyles.modalTitle}>{infoModalTitle}</Text>
              <Text style={modalStyles.modalBody}>{infoModalMessage}</Text>
              <TouchableOpacity
                style={modalStyles.closeButton}
                onPress={() => setInfoModalTitle(null)}
              >
                <Text style={modalStyles.closeButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const iconStyles = StyleSheet.create({
  chevronDown: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#94A3B8',
    transform: [{ rotate: '45deg' }],
  },
  chevronUp: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: '#94A3B8',
    transform: [{ rotate: '45deg' }],
    marginTop: 4,
  },
  chevronRight: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: '#CBD5E1',
    transform: [{ rotate: '45deg' }],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 16,
  },
});

const chartStyles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: AppSpacing.md,
    marginBottom: AppSpacing.md,
    ...Shadows.small,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  chartGrid: {
    flexDirection: 'row',
    height: 140,
  },
  yAxis: {
    width: 32,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  axisLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  plotArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-between',
    position: 'relative',
  },
  gridLineTop: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
  },
  gridLineMid: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
  },
  gridLineBot: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dotCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  purpleDotPoint: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#5B6EF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redDotPoint: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E05C5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  purpleShadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(91, 110, 245, 0.08)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  redShadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(224, 92, 92, 0.08)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 32,
    marginTop: 8,
    paddingHorizontal: 10,
  },
});

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 85,
  },
  topHeaderCard: {
    backgroundColor: '#FAF8ED',
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.xl,
    paddingBottom: AppSpacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#EBB294',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userTextWrap: {
    marginLeft: 14,
  },
  userNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  userEmailText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: AppSpacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    padding: 4,
    marginTop: AppSpacing.md,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#5B6EF5',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  tabBody: {
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.sm,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 10,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sessionsList: {
    gap: 12,
  },
  sessionCardOuter: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...Shadows.small,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  sessionScoreBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionScoreBadgeText: {
    fontSize: 17,
    fontWeight: '800',
  },
  sessionTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  sessionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sessionPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sessionDateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  chevronWrap: {
    paddingHorizontal: 8,
  },
  expandedDetailBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridMetricCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridMetricIcon: {
    fontSize: 18,
  },
  gridMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  gridMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  overallTrackWrap: {
    marginTop: 14,
  },
  overallHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  overallLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  overallValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E05C5C',
  },
  overallTrackBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  overallTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '500',
  },
  confidenceHighlight: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  settingsGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 4,
    ...Shadows.small,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },
  signOutButton: {
    backgroundColor: '#FDECEF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E05C5C',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: 16,
  },
  myProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: AppSpacing.lg,
    ...Shadows.small,
  },
  myProfileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  profileField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  editProfileButton: {
    marginTop: 14,
    backgroundColor: '#5B6EF5',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
  },
  tabIconEmoji: {
    fontSize: 18,
    opacity: 0.8,
  },
  tabLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
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
  modalBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginVertical: 10,
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: '#5B6EF5',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
