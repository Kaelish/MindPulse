import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { InAppVideoCall, ensureMediaPermissions } from '../../components/InAppVideoCall';
import {
  MyBooking,
  fetchMyBookings,
  fetchVideoRoom,
} from '../../services/appointments';
import {
  DoctorCallBooking,
  fetchDoctorCallBooking,
  getDoctorVideoRoomUrl,
} from '../../services/doctorConsultations';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface VideoCallScreenProps {
  doctorId?: string;
  appointmentId?: string;
  /** 'doctor' renders the doctor portal variant (tab bar, gating, room logic). */
  role?: 'patient' | 'doctor';
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

interface LobbyView {
  id: string;
  counterpartName: string;
  counterpartSub: string;
  scheduledFor: string;
  status: string;
  declineReason?: string;
  fee: number;
  roomDoctorId?: string;
}

const fromPatientBooking = (booking: MyBooking): LobbyView => ({
  id: booking.id,
  counterpartName: booking.doctorName,
  counterpartSub: booking.specialty,
  scheduledFor: booking.scheduledFor,
  status: booking.status,
  declineReason: booking.declineReason,
  fee: booking.fee,
  roomDoctorId: booking.doctorId,
});

const fromDoctorBooking = (booking: DoctorCallBooking): LobbyView => ({
  id: booking.id,
  counterpartName: booking.counterpartName,
  counterpartSub: booking.specialtyLabel,
  scheduledFor: booking.scheduledFor,
  status: booking.status,
  declineReason: booking.declineReason,
  fee: booking.fee,
});

/**
 * Lobby for the appointment's real Jitsi room. Joining opens the room
 * IN-APP (full-screen WebView) at the deterministic room
 * mindpulse-appt-<appointment id>, so neither side leaves MindPulse.
 * Patients and doctors each get their own variant of the same lobby.
 */
export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({
  doctorId,
  appointmentId,
  role = 'patient',
  onEndCall,
  onNavigateTab,
}) => {
  const isDoctor = role === 'doctor';
  const [booking, setBooking] = useState<LobbyView | null>(null);
  const [doctorBooking, setDoctorBooking] = useState<DoctorCallBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [callUrl, setCallUrl] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isDoctor) {
        if (!appointmentId) {
          setLoadError('No appointment was passed to this call.');
          return;
        }
        const loaded = await fetchDoctorCallBooking(appointmentId);
        setDoctorBooking(loaded);
        setBooking(fromDoctorBooking(loaded));
        return;
      }

      const all = await fetchMyBookings();
      const byId = appointmentId ? all.find((b) => b.id === appointmentId) : undefined;
      const byDoctor = doctorId ? all.filter((b) => b.doctorId === doctorId) : [];
      const picked =
        byId ??
        byDoctor.find((b) => b.status === 'confirmed') ??
        byDoctor[0] ??
        null;
      setBooking(picked ? fromPatientBooking(picked) : null);
      if (!picked) {
        setLoadError('No appointment found for this call.');
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load the appointment for this call.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, doctorId, isDoctor]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  const handleJoin = async () => {
    if (!booking || joining) return;
    setJoining(true);
    try {
      const url = isDoctor
        ? doctorBooking
          ? await getDoctorVideoRoomUrl(doctorBooking)
          : (() => {
              throw new Error('No appointment was passed to this call.');
            })()
        : await fetchVideoRoom(booking.id, booking.roomDoctorId ?? '');
      await ensureMediaPermissions();
      setCallUrl(url);
    } catch (e: any) {
      Alert.alert(
        'Could not open the call',
        e?.message || 'Please check your connection and try again.',
      );
    } finally {
      setJoining(false);
    }
  };

  const initials = (booking?.counterpartName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || (isDoctor ? 'PT' : 'DR');

  const lockedText = () => {
    if (!booking) return '';
    if (isDoctor) {
      return booking.status === 'awaiting_payment'
        ? 'Waiting for the patient to pay the consultation fee to confirm this session.'
        : booking.status === 'scheduled'
          ? 'You have not approved this booking request yet — approve it from Consultations.'
          : booking.status === 'declined'
            ? booking.declineReason
              ? `You declined this booking: ${booking.declineReason}`
              : 'You declined this booking.'
            : 'This call unlocks once the appointment is confirmed.';
    }
    return booking.status === 'awaiting_payment'
      ? 'Pay the consultation fee in Bookings to unlock this call.'
      : booking.status === 'declined'
        ? booking.declineReason
          ? `This booking was declined: ${booking.declineReason}`
          : 'This booking was declined.'
        : 'This call unlocks once the doctor approves your request and you complete the payment.';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* The lobby previously started flush with the top of the window, so on a
          notched phone the avatar and the doctor's name sat under the status bar. */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBack}
          onPress={onEndCall}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={tone('#1A2E44')} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{isDoctor ? 'Patient call lobby' : 'Video call'}</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.lobbyCard}>
        <ScrollView
          contentContainerStyle={styles.lobbyScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={tone('#5B6EF5')} style={{ marginTop: 16 }} />
          ) : loadError || !booking ? (
            <Text style={styles.lobbyError}>{loadError ?? 'No appointment found for this call.'}</Text>
          ) : (
            <>
              <Text style={styles.lobbyDoctor}>{booking.counterpartName}</Text>
              <Text style={styles.lobbySpec}>
                {isDoctor ? `${booking.counterpartSub} · with you` : booking.counterpartSub}
              </Text>

              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={15} color={tone('#5B6EF5')} />
                  <Text style={styles.infoText}>{booking.scheduledFor}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="pricetag-outline" size={15} color={tone('#5B6EF5')} />
                  <Text style={styles.infoText}>
                    {STATUS_LABELS[booking.status] ?? booking.status} · Fee ₱{booking.fee}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="videocam-outline" size={15} color={tone('#5B6EF5')} />
                  <Text style={styles.infoText}>Jitsi room · mindpulse-appt-{booking.id.slice(0, 8)}…</Text>
                </View>
              </View>

              {booking.status === 'confirmed' ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, joining && { opacity: 0.6 }]}
                  onPress={() => void handleJoin()}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color={tone('#FFF')} />
                  ) : (
                    <Ionicons name="videocam" size={16} color={tone('#FFF')} />
                  )}
                  <Text style={styles.primaryBtnText}>
                    {joining ? 'Opening…' : 'Join Video Call'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.lockedText}>{lockedText()}</Text>
              )}
            </>
          )}

          <TouchableOpacity style={styles.endBtn} onPress={onEndCall}>
            <Ionicons name="call" size={22} color={tone('#FFF')} style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.endBtnText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <BottomTabBar
        variant={isDoctor ? 'doctor' : 'patient'}
        activeTab="clinics"
        onNavigate={(tab) => onNavigateTab?.(tab)}
      />

      <InAppVideoCall
        visible={!!callUrl}
        url={callUrl ?? ''}
        title={booking?.counterpartName ?? 'Video call'}
        subtitle={booking?.counterpartSub}
        onClose={() => setCallUrl(null)}
      />
    </SafeAreaView>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: toneBg('#FAF8F3') },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: toneBg('#FFFFFF'),
    borderWidth: 1,
    borderColor: toneBg('#E4E8F0'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: tone('#1A2E44') },
  topSpacer: { width: 36, height: 36 },
  lobbyCard: {
    flex: 1,
    margin: 16,
    marginTop: 8,
    backgroundColor: toneBg('#FFFFFF'),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: toneBg('#E4E8F0'),
    padding: 24,
    overflow: 'hidden',
  },
  lobbyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: toneBg('#E8ECFA'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: tone('#5B6EF5') },
  lobbyDoctor: { fontSize: 19, fontWeight: '800', color: tone('#1A2E44'), textAlign: 'center' },
  lobbySpec: { fontSize: 13, color: tone('#7A90A8'), marginBottom: 8 },
  lobbyError: { fontSize: 13, color: tone('#B91C1C'), textAlign: 'center', marginTop: 12, lineHeight: 19 },
  infoBox: {
    width: '100%',
    backgroundColor: toneBg('#F5F7FC'),
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: tone('#334155'), fontWeight: '600', flex: 1 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: toneBg('#5B6EF5'),
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: tone('#FFF') },
  lockedText: {
    fontSize: 13,
    color: tone('#B45309'),
    textAlign: 'center',
    lineHeight: 19,
    backgroundColor: toneBg('#FEF3C7'),
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: toneBg('#EF4444'),
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
    width: '100%',
    marginTop: 14,
  },
  endBtnText: { fontSize: 14, fontWeight: '800', color: tone('#FFF') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
