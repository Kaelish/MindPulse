import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  Image,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface Props {
  onComplete: (tab?: 'register' | 'login') => void;
  onSignIn: () => void;
}

type OnboardingPage = 'meditate' | 'analysis' | 'welcome';

/* ─────────── Pagination Dots ─────────── */
const Pagination = ({
  active,
  activeColor,
}: {
  active: number;
  activeColor: string;
}) => (
  <View style={styles.pagination}>
    {[0, 1, 2].map((i) => (
      <View
        key={i}
        style={[
          styles.pageDot,
          active === i
            ? [styles.pageDotActive, { backgroundColor: activeColor }]
            : styles.pageDotInactive,
        ]}
      />
    ))}
  </View>
);

/* ─────────── Modality Tiles ─────────── */
const ModalityTiles = () => {
  const tiles = [
    {
      iconName: 'happy-outline' as const,
      label: 'Emotion',
      sub: 'Facial cue analysis',
      iconBg: '#E8E6F7',
      iconColor: '#7B6FD6',
      labelColor: '#7B6FD6',
    },
    {
      iconName: 'heart-outline' as const,
      label: 'Heart Rate',
      sub: 'Biometric tracking',
      iconBg: '#FDECEA',
      iconColor: '#E05C5C',
      labelColor: '#E05C5C',
    },
    {
      iconName: 'grid-outline' as const,
      label: 'Survey',
      sub: 'Mood questionnaire',
      iconBg: '#EAE8F9',
      iconColor: '#6C5FD6',
      labelColor: '#6C5FD6',
    },
    {
      iconName: 'flash-outline' as const,
      label: 'Reaction',
      sub: 'Response time test',
      iconBg: '#FEF0E6',
      iconColor: '#E07A40',
      labelColor: '#E07A40',
    },
  ];
  return (
    <View style={styles.tileGrid}>
      {tiles.map(({ iconName, label, sub, iconBg, iconColor, labelColor }) => (
        <View key={label} style={styles.tile}>
          <View style={[styles.tileIconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
          <Text style={[styles.tileLabel, { color: labelColor }]}>{label}</Text>
          <Text style={styles.tileSub}>{sub}</Text>
        </View>
      ))}
    </View>
  );
};

/* ─────────── Navigator ─────────── */
export const OnboardingNavigator: React.FC<Props> = ({ onComplete, onSignIn }) => {
  const [page, setPage] = useState<OnboardingPage>('meditate');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Auto-advance slides after 3000ms
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (page === 'meditate') {
      timer = setTimeout(() => navigateTo('analysis'), 3000);
    } else if (page === 'analysis') {
      timer = setTimeout(() => navigateTo('welcome'), 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [page]);

  const navigateTo = (next: OnboardingPage | 'auth') => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      if (next === 'auth') {
        onComplete('register');
        return;
      }
      setPage(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  /* ── Slide 1 – Meditate (Purple radial) ── */
  if (page === 'meditate') {
    return (
      <LinearGradient
        colors={['#7B6FEB', '#5245D5', '#4A3DC8']}
        locations={[0, 0.5, 1]}
        style={styles.fill}
      >
        {/* radial glow at top */}
        <View style={styles.purpleGlow} />
        <SafeAreaView style={styles.fill}>
          {/* Skip */}
          <View style={styles.topBar}>
            <Pressable onPress={() => navigateTo('welcome')}>
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
            {/* Illustration */}
            <View style={styles.illustrationWrap}>
              <Image
                source={require('../../../assets/images/meditation.png')}
                style={styles.meditationImg}
                resizeMode="contain"
                fadeDuration={0}
              />
            </View>

            {/* Text */}
            <View style={styles.textBlock}>
              <Text style={styles.headline}>
                Nurture your mind,{'\n'}
                <Text style={styles.purpleAccent}>embrace your journey.</Text>
              </Text>
              <Text style={styles.bodyText}>
                Daily stress check-ins to help you understand{'\n'}
                your mental wellbeing — at your own pace.
              </Text>
            </View>

            <Pagination active={0} activeColor="rgba(255,255,255,0.85)" />
          </Animated.View>

          {/* Tap to advance */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => navigateTo('analysis')}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ── Slide 2 – Analysis (Mint) ── */
  if (page === 'analysis') {
    return (
      <LinearGradient
        colors={['#C5EEE0', '#90D4C0', '#6BBDAA']}
        locations={[0, 0.5, 1]}
        style={styles.fill}
      >
        {/* white radial glow top */}
        <View style={styles.mintGlow} />
        <SafeAreaView style={styles.fill}>
          {/* Skip */}
          <View style={styles.topBar}>
            <Pressable onPress={() => navigateTo('welcome')}>
              <Text style={[styles.skipLabel, { color: 'rgba(0,0,0,0.45)' }]}>Skip</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
            {/* Tiles + plant overlay */}
            <View style={styles.analysisBlock}>
              <ModalityTiles />
              <Image
                source={require('../../../assets/images/plant.png')}
                style={styles.plantImg}
                resizeMode="contain"
              />
            </View>

            {/* Text */}
            <View style={styles.textBlock}>
              <Text style={[styles.headline, { color: tone('#FFFFFF') }]}>
                Multi-modal analysis,{'\n'}
                <Text style={styles.tealAccent}>built for precision.</Text>
              </Text>
              <Text style={[styles.bodyText, { color: 'rgba(255,255,255,0.9)' }]}>
                Fuses your survey, heart rate, facial cues, and{'\n'}
                reaction time into one accurate stress score.
              </Text>
            </View>

            <Pagination active={1} activeColor="#3BBFA0" />
          </Animated.View>

          {/* Tap to advance */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => navigateTo('welcome')}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ── Slide 3 – Wellness Story (Peach) ── */
  return (
    <LinearGradient
      colors={['#F5CEBC', '#E9A882', '#D98055']}
      locations={[0, 0.5, 1]}
      style={styles.fill}
    >
      {/* white radial glow top */}
      <View style={styles.peachGlow} />
      <SafeAreaView style={styles.fill}>
        <Animated.View style={[styles.fill, styles.welcomeContent, { opacity: fadeAnim }]}>

          {/* Book illustration */}
          <View style={styles.bookWrap}>
            <Image
              source={require('../../../assets/images/book.png')}
              style={styles.bookImg}
              resizeMode="contain"
            />
          </View>

          {/* Text */}
          <View style={styles.textBlock}>
            <Text style={[styles.headline, { color: tone('#FFFFFF') }]}>
              Your wellness story,{'\n'}
              <Text style={styles.peachAccent}>starts right here.</Text>
            </Text>
            <Text style={[styles.bodyText, { color: 'rgba(255,255,255,0.88)' }]}>
              Track trends, get recommendations, and{'\n'}
              connect with professionals — all in one place.
            </Text>
          </View>

          <Pagination active={2} activeColor="#C06830" />

          {/* CTA Buttons */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => onComplete('register')}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>Create Account</Text>
            <Text style={styles.createBtnArrow}>›</Text>
          </TouchableOpacity>

          <Pressable onPress={onSignIn} style={styles.signInRow}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

/* ─────────── Styles ─────────── */
const makeStyles = () => StyleSheet.create({
  fill: { flex: 1 },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.2,
  },

  /* Radial glows */
  purpleGlow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mintGlow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  peachGlow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  /* Illustrations */
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  meditationImg: {
    width: 280,
    height: 280,
  },

  /* Analysis slide */
  analysisBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 20,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '88%',
    zIndex: 2,
  },
  tile: {
    width: '46%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    ...Platform.select({
      web: { boxShadow: '0px 2px 10px rgba(0,0,0,0.06)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
    }),
  },
  tileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  tileSub: {
    fontSize: 10,
    color: tone('#9AA0AF'),
  },
  plantImg: {
    position: 'absolute',
    width: 160,
    height: 300,
    right: -10,
    top: -30,
    zIndex: -1,
    opacity: 0.85,
  },

  /* Welcome slide */
  welcomeContent: {
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  bookWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookImg: {
    width: 260,
    height: 220,
  },

  /* Shared text */
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: tone('#FFFFFF'),
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  // These accents sit on slide gradients that never change with the theme, so
  // they must not be lifted either — a light-on-light wash in dark mode.
  purpleAccent: {
    color: '#2B1E80',
    fontWeight: '800',
  },
  tealAccent: {
    color: '#1A6B5A',
    fontWeight: '800',
  },
  peachAccent: {
    color: '#9E4510',
    fontWeight: '800',
  },
  bodyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 21,
  },

  /* Pagination */
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 28,
  },
  pageDot: {
    height: 8,
    borderRadius: 4,
  },
  pageDotActive: {
    width: 22,
  },
  pageDotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  /* CTA */
  createBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: toneBg('#C06830'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      web: { boxShadow: '0px 6px 18px rgba(180,90,30,0.35)' },
      default: {
        shadowColor: '#B45A1E',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      },
    }),
  },
  createBtnText: {
    color: tone('#FFFFFF'),
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  createBtnArrow: {
    color: tone('#FFFFFF'),
    fontSize: 20,
    fontWeight: '400',
    marginLeft: 6,
    marginTop: -1,
  },
  signInRow: {
    alignItems: 'center',
  },
  signInText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  signInLink: {
    // On the fixed gradient (see purpleAccent) — keep the shipped dark value.
    color: '#9E4510',
    fontWeight: '700',
  },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });