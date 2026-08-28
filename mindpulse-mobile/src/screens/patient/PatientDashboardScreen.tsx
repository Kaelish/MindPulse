import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppRadius, AppSpacing, AppTypography, Shadows } from '../../theme/tokens';
import { Appointment, PatientProfile, VideoCallSession } from '../../types/supabase';

interface PatientDashboardScreenProps {
  onStartVideoCall?: () => void;
}

const mockProfile: PatientProfile = {
  id: 'p-101',
  full_name: 'Sarah Johnson',
  email: 'sarah.johnson@email.com',
  phone: '+1 (415) 555-0102',
  avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
};

const mockAppointments: Appointment[] = [
  {
    id: 'appt-1',
    patient_id: 'p-101',
    doctor_id: 'd-201',
    scheduled_for: '2026-08-28T09:30:00.000Z',
    status: 'confirmed',
    notes: 'Follow-up on stress review',
  },
  {
    id: 'appt-2',
    patient_id: 'p-101',
    doctor_id: 'd-202',
    scheduled_for: '2026-08-29T15:00:00.000Z',
    status: 'scheduled',
    notes: 'Nutrition and sleep check-in',
  },
];

const mockCallSession: VideoCallSession = {
  id: 'call-1',
  appointment_id: 'appt-1',
  patient_id: 'p-101',
  doctor_id: 'd-201',
  room_name: 'mindpulse-call-101',
  status: 'pending',
  started_at: '2026-08-28T09:15:00.000Z',
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const PatientDashboardScreen: React.FC<PatientDashboardScreenProps> = ({
  onStartVideoCall,
}) => {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callSession, setCallSession] = useState<VideoCallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        await new Promise<void>(resolve => {
          setTimeout(resolve, 700);
        });

        if (!isMounted) {
          return;
        }

        setProfile(mockProfile);
        setAppointments(mockAppointments);
        setCallSession(mockCallSession);
      } catch (err) {
        if (isMounted) {
          setError('Unable to load your dashboard right now. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const nextAppointment = useMemo(
    () => appointments.find(item => item.status !== 'completed') ?? null,
    [appointments],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            setTimeout(() => {
              setProfile(mockProfile);
              setAppointments(mockAppointments);
              setCallSession(mockCallSession);
              setLoading(false);
            }, 500);
          }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Welcome back</Text>
          <Text style={styles.heading}>{profile?.full_name ?? 'Patient'}</Text>
        </View>
        <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.85}>
          <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) ?? 'P'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.primaryCard}>
        <Text style={styles.primaryLabel}>Care overview</Text>
        <Text style={styles.scoreValue}>81</Text>
        <Text style={styles.scoreMeta}>Stress resilience score</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>3</Text>
            <Text style={styles.metricLabel}>Sessions</Text>
          </View>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>2</Text>
            <Text style={styles.metricLabel}>Goals</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Next appointment</Text>
        <TouchableOpacity>
          <Text style={styles.linkText}>View all</Text>
        </TouchableOpacity>
      </View>

      {nextAppointment ? (
        <View style={styles.appointmentCard}>
          <View style={styles.appointmentHeader}>
            <Text style={styles.appointmentDoctor}>Dr. Alicia Romero</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{nextAppointment.status}</Text>
            </View>
          </View>
          <Text style={styles.appointmentTime}>{formatDate(nextAppointment.scheduled_for)}</Text>
          <Text style={styles.appointmentNotes}>{nextAppointment.notes}</Text>
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Join call</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>No upcoming appointment scheduled.</Text>
        </View>
      )}

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>📹</Text>
          <Text style={styles.actionLabel}>Video call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionLabel}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Messages</Text>
        </TouchableOpacity>
      </View>

      {callSession ? (
        <View style={styles.callCard}>
          <Text style={styles.callTitle}>Live session ready</Text>
          <Text style={styles.callMeta}>Room: {callSession.room_name}</Text>
          <Text style={styles.callMeta}>Status: {callSession.status}</Text>
          <TouchableOpacity style={styles.callButton} onPress={onStartVideoCall}>
            <Text style={styles.callButtonText}>Start video consultation</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  content: {
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.xl,
    paddingBottom: AppSpacing.xxl,
    gap: AppSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...AppTypography.caption,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  heading: {
    ...AppTypography.h1,
    color: Colors.textPrimary,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.small,
  },
  avatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  primaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: AppRadius.xl,
    padding: AppSpacing.lg,
    ...Shadows.small,
  },
  primaryLabel: {
    ...AppTypography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    marginTop: 8,
  },
  scoreMeta: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    marginTop: AppSpacing.lg,
  },
  metricBlock: {
    flex: 1,
    backgroundColor: '#F5F7FF',
    borderRadius: AppRadius.md,
    padding: AppSpacing.md,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: AppSpacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  appointmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: AppRadius.lg,
    padding: AppSpacing.lg,
    ...Shadows.small,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentDoctor: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusPill: {
    backgroundColor: '#D6F5E3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: AppRadius.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27AE60',
    textTransform: 'capitalize',
  },
  appointmentTime: {
    color: Colors.textSecondary,
    marginTop: 10,
    fontSize: 14,
  },
  appointmentNotes: {
    color: Colors.textPrimary,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    marginTop: AppSpacing.md,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: AppRadius.md,
    backgroundColor: '#F3F5F9',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: AppRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontWeight: '700',
    color: Colors.white,
  },
  placeholderCard: {
    backgroundColor: Colors.surface,
    borderRadius: AppRadius.md,
    padding: AppSpacing.lg,
    minHeight: 80,
    justifyContent: 'center',
    ...Shadows.small,
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: AppRadius.md,
    paddingVertical: AppSpacing.md,
    paddingHorizontal: AppSpacing.sm,
    alignItems: 'center',
    ...Shadows.small,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    marginTop: AppSpacing.sm,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  callCard: {
    backgroundColor: '#EAF3FB',
    borderRadius: AppRadius.lg,
    padding: AppSpacing.lg,
    ...Shadows.small,
  },
  callTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  callMeta: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  callButton: {
    marginTop: AppSpacing.md,
    backgroundColor: Colors.primary,
    borderRadius: AppRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pageBg,
    padding: AppSpacing.xl,
  },
  loadingText: {
    marginTop: AppSpacing.md,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: AppSpacing.sm,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: AppSpacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: AppRadius.md,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
