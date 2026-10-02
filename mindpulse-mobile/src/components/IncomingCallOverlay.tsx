import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadNotificationPrefs } from '../services/notificationPrefs';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

interface IncomingCallOverlayProps {
  visible: boolean;
  doctorName: string;
  onJoin: () => void;
  onDecline: () => void;
}

const RING_PATTERN = [0, 600, 550];
const RING_REPEAT_MS = 1700;

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  visible,
  doctorName,
  onJoin,
  onDecline,
}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const [vibrationOn, setVibrationOn] = useState(true);

  useEffect(() => {
    void loadNotificationPrefs().then((prefs) => setVibrationOn(prefs.vibrationEnabled));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    let vibrate: ReturnType<typeof setInterval> | null = null;
    if (vibrationOn) {
      Vibration.vibrate(RING_PATTERN);
      vibrate = setInterval(() => Vibration.vibrate(RING_PATTERN), RING_REPEAT_MS);
    }

    return () => {
      loop.stop();
      pulse.setValue(0);
      if (vibrate) clearInterval(vibrate);
      Vibration.cancel();
    };
  }, [visible, vibrationOn, pulse]);

  const initials =
    doctorName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DR';

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.body}>
            <Text style={styles.kicker}>Incoming video consultation</Text>

            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>

            <Text style={styles.name}>{doctorName}</Text>
            <Text style={styles.hint}>is calling you now</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline} accessibilityLabel="Decline call">
              <Ionicons name="call" size={24} color={tone('#FFF')} style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.actionText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.joinBtn}
              onPress={onJoin}
              accessibilityLabel="Join call"
            >
              <Ionicons name="videocam" size={24} color={tone('#FFF')} />
              <Text style={styles.actionText}>Join now</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0B1B33' },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#8FA8C8',
    marginBottom: 22,
  },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  pulseRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#5B6EF5',
  },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: toneBg('#FFFFFF'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: tone('#5B6EF5') },
  name: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  hint: { fontSize: 14, color: '#8FA8C8', marginTop: 10, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 14 },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    borderRadius: 18,
    paddingVertical: 18,
  },
  joinBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#22C55E',
    borderRadius: 18,
    paddingVertical: 18,
  },
  actionText: { fontSize: 15, fontWeight: '800', color: tone('#FFF') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
