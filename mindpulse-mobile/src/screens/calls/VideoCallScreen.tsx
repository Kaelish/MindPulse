import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import {
  TelehealthClinician,
  fetchClinicianById,
} from '../../services/appointments';

interface VideoCallScreenProps {
  doctorId?: string;
  onEndCall?: () => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

// ── Animated recording timer ──
const CallTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const dot = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(dot, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(dot, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    blink.start();
    return () => { clearInterval(timer); blink.stop(); };
  }, [dot]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={styles.timerBadge}>
      <Animated.View style={[styles.timerDot, { opacity: dot }]} />
      <Text style={styles.timerText}>{mm}:{ss}</Text>
    </View>
  );
};

// ── Doctor avatar ──
const DoctorAvatar = ({ name }: { name: string }) => {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatarCircle}>
        <Ionicons name="person" size={32} color="#8B9ED4" />
      </View>
    </View>
  );
};

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({
  doctorId,
  onEndCall,
  onNavigateTab,
}) => {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [inChat, setInChat] = useState(false);
  const [activeTab] = useState<'home' | 'analysis' | 'clinics' | 'profile'>('clinics');

  const [clinician, setClinician] = useState<TelehealthClinician | null>(null);
  const [clinicianLoading, setClinicianLoading] = useState(true);
  const [clinicianError, setClinicianError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!doctorId) {
        if (isMounted) {
          setClinicianError('No clinician selected for this call.');
          setClinicianLoading(false);
        }
        return;
      }
      try {
        const found = await fetchClinicianById(doctorId);
        if (isMounted) {
          if (found) setClinician(found);
          else setClinicianError('Clinician not found.');
        }
      } catch (e: any) {
        if (isMounted) setClinicianError(e?.message || 'Could not load clinician details.');
      } finally {
        if (isMounted) setClinicianLoading(false);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, [doctorId]);

  const doctorName = clinician?.name;
  const doctorSpecialty = clinician?.specialty;

  return (
    <View style={styles.root}>
      {/* ── Remote video area (grey placeholder) ── */}
      <View style={styles.remoteVideo}>
        {/* Recording timer top-left */}
        <CallTimer />

        {/* Local video PiP — top-right placeholder */}
        <View style={styles.localPip}>
          <Ionicons name="person" size={22} color="#B0B8C8" />
        </View>
      </View>

      {/* ── Doctor info ── */}
      <View style={styles.doctorInfo}>
        <DoctorAvatar name={doctorName ?? ''} />
        {clinicianLoading ? (
          <ActivityIndicator size="small" color="#7A90A8" />
        ) : clinicianError ? (
          <Text style={styles.doctorSpecialty}>{clinicianError}</Text>
        ) : (
          <>
            <Text style={styles.doctorName}>{doctorName}</Text>
            <Text style={styles.doctorSpecialty}>{doctorSpecialty}</Text>
          </>
        )}
      </View>

      {/* ── Control bar ── */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]}
          onPress={() => setMuted(v => !v)}
        >
          <Ionicons
            name={muted ? 'mic-off' : 'mic'}
            size={22}
            color={muted ? '#FFF' : '#6B7A99'}
          />
          <Text style={[styles.ctrlLabel, muted && { color: '#FFF' }]}>Mute</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={onEndCall}>
          <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.endCallLabel}>End</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, cameraOff && styles.ctrlBtnActive]}
          onPress={() => setCameraOff(v => !v)}
        >
          <Ionicons
            name={cameraOff ? 'videocam-off' : 'videocam'}
            size={22}
            color={cameraOff ? '#FFF' : '#6B7A99'}
          />
          <Text style={[styles.ctrlLabel, cameraOff && { color: '#FFF' }]}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, inChat && styles.ctrlBtnBlue]}
          onPress={() => setInChat(v => !v)}
        >
          <Ionicons
            name="chatbubble-outline"
            size={22}
            color={inChat ? '#FFF' : '#6B7A99'}
          />
          <Text style={[styles.ctrlLabel, inChat && { color: '#FFF' }]}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom Tab ── */}
      <BottomTabBar activeTab={activeTab} onNavigate={tab => onNavigateTab?.(tab)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },

  /* Remote video placeholder */
  remoteVideo: {
    flex: 1,
    backgroundColor: '#E2E6EE',
    margin: 16,
    marginTop: 20,
    borderRadius: 20,
    position: 'relative',
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Recording timer */
  timerBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  timerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Local PiP */
  localPip: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 72,
    height: 90,
    backgroundColor: '#C8CDD8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },

  /* Doctor info */
  doctorInfo: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  avatarWrap: {
    marginBottom: 10,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8ECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A2E44',
    marginBottom: 3,
  },
  doctorSpecialty: {
    fontSize: 13,
    color: '#7A90A8',
  },

  /* Control bar */
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  ctrlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ctrlBtnActive: {
    backgroundColor: '#EF4444',
  },
  ctrlBtnBlue: {
    backgroundColor: '#4A90D9',
  },
  ctrlLabel: {
    fontSize: 10,
    color: '#6B7A99',
    fontWeight: '600',
    marginTop: 2,
  },
  endCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  endCallLabel: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '700',
    marginTop: 2,
  },
});
