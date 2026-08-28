import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { AppRadius, AppSpacing, AppTypography, Shadows } from '../../theme/tokens';
import { CallSessionPayload, launchDoctorVideoCall } from '../../services/video';

interface VideoCallScreenProps {
  doctorId: string;
  patientId: string;
  onEndCall?: () => void;
}

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({
  doctorId,
  patientId,
  onEndCall,
}) => {
  const [session, setSession] = useState<CallSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await launchDoctorVideoCall(doctorId, patientId);
        setSession(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start the call.');
      } finally {
        setLoading(false);
      }
    };

    void initializeCall();
  }, [doctorId, patientId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to patient call...</Text>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Call unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'Unable to create the meeting room.'}</Text>
        <TouchableOpacity style={styles.actionButton} onPress={onEndCall}>
          <Text style={styles.actionButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.videoStage}>
        <View style={styles.remoteCard}>
          <Text style={styles.remoteLabel}>Patient video</Text>
          <Text style={styles.remoteName}>Sarah Johnson</Text>
        </View>

        <View style={styles.localCard}>
          <Text style={styles.localLabel}>You</Text>
          <Text style={styles.localName}>Dr. Chen</Text>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <Text style={styles.stateLabel}>Call status</Text>
        <Text style={styles.statusText}>Connecting to room: {session.roomName}</Text>
        <Text style={styles.metaText}>Meeting URL: {session.meetingUrl}</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Mute</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.endButton]} onPress={onEndCall}>
            <Text style={styles.actionButtonText}>End call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: AppSpacing.lg,
    justifyContent: 'space-between',
  },
  loadingText: {
    marginTop: AppSpacing.md,
    color: Colors.white,
    fontSize: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  errorText: {
    marginTop: AppSpacing.sm,
    color: '#D6E3FF',
    textAlign: 'center',
  },
  videoStage: {
    flex: 1,
    minHeight: 420,
    borderRadius: AppRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#111827',
    position: 'relative',
    ...Shadows.medium,
  },
  remoteCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteLabel: {
    color: '#D6E3FF',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
  remoteName: {
    marginTop: AppSpacing.sm,
    color: Colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  localCard: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 120,
    height: 150,
    backgroundColor: '#2F6FED',
    borderRadius: AppRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  localLabel: {
    color: '#EAF2FF',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  localName: {
    marginTop: AppSpacing.sm,
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  bottomPanel: {
    backgroundColor: '#111827',
    borderRadius: AppRadius.xl,
    padding: AppSpacing.lg,
    marginTop: AppSpacing.md,
  },
  stateLabel: {
    ...AppTypography.label,
    color: '#9DB8FF',
    textTransform: 'uppercase',
  },
  statusText: {
    marginTop: AppSpacing.sm,
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  metaText: {
    marginTop: AppSpacing.sm,
    color: '#D6E3FF',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
    marginTop: AppSpacing.lg,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: AppRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.white,
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: AppRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButton: {
    backgroundColor: '#D95D5D',
  },
  actionButtonText: {
    fontWeight: '700',
    color: Colors.white,
  },
});
