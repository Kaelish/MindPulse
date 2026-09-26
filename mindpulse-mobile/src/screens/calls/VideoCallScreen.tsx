import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import {
  MyBooking,
  fetchMyBookings,
  fetchVideoRoom,
} from '../../services/appointments';

interface VideoCallScreenProps {
  doctorId?: string;
  appointmentId?: string;
  onEndCall?: () => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Awaiting approval',
  awaiting_payment: 'Approved · payment required',
  declined: 'Declined',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Lobby for the appointment's real Jitsi room. The actual call opens in the
 * phone's browser at the deterministic room mindpulse-appt-<appointment id>.
 */
export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({
  doctorId,
  appointmentId,
  onEndCall,
  onNavigateTab,
}) => {
  const [booking, setBooking] = useState<MyBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [openedInBrowser, setOpenedInBrowser] = useState(false);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const all = await fetchMyBookings();
      const byId = appointmentId ? all.find((b) => b.id === appointmentId) : undefined;
      const byDoctor = doctorId ? all.filter((b) => b.doctorId === doctorId) : [];
      const picked =
        byId ??
        byDoctor.find((b) => b.status === 'confirmed') ??
        byDoctor[0] ??
        null;
      setBooking(picked);
      if (!picked) {
        setLoadError('No appointment found for this call.');
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load the appointment for this call.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, doctorId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  const handleJoin = async () => {
    if (!booking || joining) return;
    setJoining(true);
    try {
      const url = await fetchVideoRoom(booking.id, booking.doctorId);
      const supported = await Linking.canOpenURL(url).catch(() => true);
      if (supported === false) {
        throw new Error('This device cannot open the video room link.');
      }
      await Linking.openURL(url);
      setOpenedInBrowser(true);
    } catch (e: any) {
      Alert.alert(
        'Could not open the call',
        e?.message || 'Please check your connection and try again.',
      );
    } finally {
      setJoining(false);
    }
  };

  const initials = (booking?.doctorName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'DR';

  return (
    <View style={styles.root}>
      <View style={styles.lobbyCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#5B6EF5" style={{ marginTop: 16 }} />
        ) : loadError || !booking ? (
          <Text style={styles.lobbyError}>{loadError ?? 'No appointment found for this call.'}</Text>
        ) : (
          <>
            <Text style={styles.lobbyDoctor}>{booking.doctorName}</Text>
            <Text style={styles.lobbySpec}>{booking.specialty}</Text>

            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={15} color="#5B6EF5" />
                <Text style={styles.infoText}>{booking.scheduledFor}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="pricetag-outline" size={15} color="#5B6EF5" />
                <Text style={styles.infoText}>
                  {STATUS_LABELS[booking.status] ?? booking.status} · Fee ₱{booking.fee}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="videocam-outline" size={15} color="#5B6EF5" />
                <Text style={styles.infoText}>Jitsi room · mindpulse-appt-{booking.id.slice(0, 8)}…</Text>
              </View>
            </View>

            {booking.status === 'confirmed' ? (
              openedInBrowser ? (
                <View style={styles.openedBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                  <Text style={styles.openedText}>
                    Your video room is open in the browser. Return here when the session ends.
                  </Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleJoin()}>
                    <Ionicons name="videocam" size={16} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Re-open Video Room</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, joining && { opacity: 0.6 }]}
                  onPress={() => void handleJoin()}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="videocam" size={16} color="#FFF" />
                  )}
                  <Text style={styles.primaryBtnText}>
                    {joining ? 'Opening…' : 'Join Video Call'}
                  </Text>
                </TouchableOpacity>
              )
            ) : (
              <Text style={styles.lockedText}>
                {booking.status === 'awaiting_payment'
                  ? 'Pay the consultation fee in Bookings to unlock this call.'
                  : booking.status === 'declined'
                    ? booking.declineReason
                      ? `This booking was declined: ${booking.declineReason}`
                      : 'This booking was declined.'
                    : 'This call unlocks once the doctor approves your request and you complete the payment.'}
              </Text>
            )}
          </>
        )}

        <TouchableOpacity style={styles.endBtn} onPress={onEndCall}>
          <Ionicons name="call" size={22} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.endBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <BottomTabBar activeTab="clinics" onNavigate={(tab) => onNavigateTab?.(tab)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F3' },
  lobbyCard: {
    flex: 1,
    margin: 16,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E4E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E8ECFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: '#5B6EF5' },
  lobbyDoctor: { fontSize: 19, fontWeight: '800', color: '#1A2E44', textAlign: 'center' },
  lobbySpec: { fontSize: 13, color: '#7A90A8', marginBottom: 8 },
  lobbyError: { fontSize: 13, color: '#B91C1C', textAlign: 'center', marginTop: 12, lineHeight: 19 },
  infoBox: {
    width: '100%',
    backgroundColor: '#F5F7FC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: '#334155', fontWeight: '600', flex: 1 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5B6EF5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  openedBox: { width: '100%', alignItems: 'center', gap: 8, marginTop: 4 },
  openedText: { fontSize: 12, color: '#1E7E43', textAlign: 'center', lineHeight: 18, fontWeight: '600' },
  lockedText: {
    fontSize: 13,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 19,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
    width: '100%',
    marginTop: 14,
  },
  endBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
