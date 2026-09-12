import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';

interface Props {
  onComplete: (tab?: 'register' | 'login') => void;
  onSignIn: () => void;
}

type OnboardingPage = 'splash' | 'meditate' | 'analysis' | 'welcome';

/* ─────────── Splash Logo ─────────── */
const SplashLogo = () => (
  <View style={styles.splashLogoContainer}>
    <View style={styles.splashLogoCircle}>
      <Ionicons name="pulse" size={36} color="#C87850" />
    </View>
    <Text style={styles.splashTitle}>MindPulse</Text>
    <Text style={styles.splashSubtitle}>Your personal stress companion</Text>
    
    <View style={styles.loadingDots}>
      <View style={[styles.dot, { opacity: 0.2 }]} />
      <View style={[styles.dot, { opacity: 0.5 }]} />
      <View style={[styles.dot, { opacity: 1 }]} />
      <View style={[styles.dot, { opacity: 0.5 }]} />
      <View style={[styles.dot, { opacity: 0.2 }]} />
    </View>
  </View>
);

/* ─────────── Pagination ─────────── */
const Pagination = ({ active, total = 3 }: { active: number; total?: number }) => (
  <View style={styles.pagination}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[styles.pageDot, active === i && styles.pageDotActive]}
      />
    ))}
  </View>
);

/* ─────────── Modality Tiles (For Slide 3) ─────────── */
const ModalityTiles = () => (
  <View style={styles.modalityGrid}>
    {[
      { iconName: 'happy-outline' as any, label: 'Emotion', sub: 'Facial cues analysis' },
      { iconName: 'heart-outline' as any, label: 'Heart Rate', sub: 'Biometric tracking' },
      { iconName: 'document-text-outline' as any, label: 'Survey', sub: 'Mood questionnaire' },
      { iconName: 'flash-outline' as any, label: 'Reaction', sub: 'Response time test' },
    ].map(({ iconName, label, sub }) => (
      <View key={label} style={styles.modalityTile}>
        <View style={styles.tileIconWrap}>
          <Ionicons name={iconName} size={24} color="#00A99D" />
        </View>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileSubtitle}>{sub}</Text>
      </View>
    ))}
  </View>
);


/* ─────────── Navigator ─────────── */
export const OnboardingNavigator: React.FC<Props> = ({ onComplete, onSignIn }) => {
  const [page, setPage] = useState<OnboardingPage>('splash');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Auto-advance from splash screen
  useEffect(() => {
    if (page === 'splash') {
      const timer = setTimeout(() => navigateTo('meditate'), 2500);
      return () => clearTimeout(timer);
    }
  }, [page]);

  const navigateTo = (next: OnboardingPage | 'auth') => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      if (next === 'auth') {
        onComplete('register');
        return;
      }
      setPage(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  /* ── Slide 0 – Splash (Cream) ── */
  if (page === 'splash') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.pageBg }]}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <SplashLogo />
        </Animated.View>
      </SafeAreaView>
    );
  }

  /* ── Slide 1 – Meditation (Purple) ── */
  if (page === 'meditate') {
    return (
      <LinearGradient
        colors={[Colors.gradPurpleTop, Colors.gradPurpleBot]}
        style={styles.container}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.topRow}>
            <Pressable style={styles.skipButton} onPress={() => navigateTo('welcome')}>
              <Text style={[styles.skipText, { color: 'rgba(255,255,255,0.5)' }]}>Skip</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <Image 
              source={require('../../../assets/images/meditation.png')} 
              style={styles.illustration}
              resizeMode="contain"
              fadeDuration={0}
            />
            
            <View style={styles.textWrap}>
              <Text style={styles.heading}>
                Nurture your mind,{'\n'}
                <Text style={styles.headingAccentPurple}>embrace your journey.</Text>
              </Text>
              <Text style={styles.description}>
                Daily stress check-ins to help you understand{'\n'}
                your mental wellbeing — at your own pace.
              </Text>
            </View>

            <Pagination active={0} />
          </Animated.View>

          <View style={styles.touchAreaFull}>
            <Pressable style={styles.hiddenNextBtn} onPress={() => navigateTo('analysis')} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ── Slide 2 – Multi-modal analysis (Mint) ── */
  if (page === 'analysis') {
    return (
      <LinearGradient
        colors={[Colors.gradMintTop, Colors.gradMintBot]}
        style={styles.container}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.topRow}>
            <Pressable style={styles.skipButton} onPress={() => navigateTo('welcome')}>
              <Text style={[styles.skipText, { color: 'rgba(0,0,0,0.4)' }]}>Skip</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <View style={styles.analysisIllustrationWrap}>
              <ModalityTiles />
              <Image 
                source={require('../../../assets/images/plant.png')} 
                style={styles.plantIllustration}
                resizeMode="contain"
              />
            </View>

            <View style={styles.textWrap}>
              <Text style={[styles.heading, { color: '#FFFFFF' }]}>
                Multi-modal analysis,{'\n'}
                <Text style={styles.headingAccentTeal}>built for precision.</Text>
              </Text>
              <Text style={[styles.description, { color: 'rgba(255,255,255,0.9)' }]}>
                Fuses your survey, heart rate, facial cues, and{'\n'}
                reaction time into one accurate stress score.
              </Text>
            </View>

            <Pagination active={1} />
          </Animated.View>

          <View style={styles.touchAreaFull}>
            <Pressable style={styles.hiddenNextBtn} onPress={() => navigateTo('welcome')} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ── Slide 3 – Your wellness story (Peach) ── */
  return (
    <LinearGradient
      colors={[Colors.gradPeachTop, Colors.gradPeachBot]}
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, justifyContent: 'center' }]}>
          <Image 
            source={require('../../../assets/images/book.png')} 
            style={styles.bookIllustration}
            resizeMode="contain"
          />

          <View style={styles.textWrap}>
            <Text style={[styles.heading, { color: '#FFFFFF' }]}>
              Your wellness story,{'\n'}
              <Text style={styles.headingAccentPeach}>starts right here.</Text>
            </Text>
            <Text style={[styles.description, { color: 'rgba(255,255,255,0.85)' }]}>
              Track trends, get recommendations, and{'\n'}
              connect with professionals — all in one place.
            </Text>
          </View>

          <Pagination active={2} />

          <Pressable style={styles.createButton} onPress={() => onComplete('register')}>
            <Text style={styles.createButtonText}>Create Account  ›</Text>
          </Pressable>

          <Pressable onPress={onSignIn} hitSlop={Spacing.sm}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

/* ─────────── Styles ─────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Top row */
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    height: 50,
  },

  /* Skip */
  skipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Content area */
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 40,
  },
  
  /* Text wrapper for consistent spacing */
  textWrap: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    minHeight: 120,
  },

  /* Illustrations */
  illustration: {
    width: 280,
    height: 300,
    marginBottom: Spacing.sm,
    backgroundColor: 'transparent',
  },
  analysisIllustrationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 280,
    position: 'relative',
  },
  plantIllustration: {
    position: 'absolute',
    width: 140,
    height: 280,
    right: -20,
    zIndex: -1,
    opacity: 0.8,
  },
  bookIllustration: {
    width: 280,
    height: 200,
    marginBottom: 40,
  },

  /* Modality Tiles */
  modalityGrid: {
    width: '90%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  modalityTile: {
    width: '46%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' },
      default: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }
    }),
    elevation: 2,
  },
  tileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileIcon: {
    fontSize: 16,
  },
  tileLabel: { color: Colors.primaryDark, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  tileSubtitle: { color: Colors.textSecondary, fontSize: 9, textAlign: 'center' },

  /* ── Shared text ── */
  heading: {
    color: '#FFFFFF',
    textAlign: 'center',
    ...Typography.h2,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  headingAccentPurple: { color: '#27116B' },
  headingAccentTeal: { color: '#225B50' },
  headingAccentPeach: { color: '#A85020' },
  
  description: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    ...Typography.body2,
    marginTop: Spacing.md,
    lineHeight: 22,
  },

  /* ── Pagination ── */
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
    marginBottom: 40,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pageDotActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  /* Invisible touch layer to progress to next slide via tap anywhere */
  touchAreaFull: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  hiddenNextBtn: {
    flex: 1,
  },

  /* ── Splash Logo ── */
  splashLogoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#C87850',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  splashTitle: {
    color: '#DABBAF',
    ...Typography.h2,
    letterSpacing: 0,
    marginBottom: 4,
  },
  splashSubtitle: {
    color: '#8A9996',
    ...Typography.caption,
    fontSize: 12,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 60,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DABBAF',
  },

  /* ── CTA buttons (slide 3) ── */
  createButton: {
    width: '100%',
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.btnOrange,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      web: { boxShadow: `0px 6px 16px rgba(219, 141, 98, 0.4)` },
      default: { shadowColor: Colors.btnOrange, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }
    }),
    elevation: 8,
    zIndex: 11, // above invisible touch area
  },
  createButtonText: {
    color: Colors.white,
    ...Typography.button,
  },
  signInText: {
    color: 'rgba(255,255,255,0.8)',
    ...Typography.body2,
    marginTop: Spacing.xl,
    zIndex: 11,
  },
  signInAccent: {
    color: '#A85020',
    fontWeight: '800',
  },
});