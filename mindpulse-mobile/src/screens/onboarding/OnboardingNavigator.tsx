import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';

interface Props {
  onComplete: (tab?: 'register' | 'login') => void;
  onSignIn: () => void;
}

type OnboardingPage = 'meditate' | 'analysis' | 'welcome';

/* ─────────── Illustrations ─────────── */

/** Slide 1 – Meditating person (purple background) */
const MeditationIllustration = () => (
  <View style={styles.meditateWrap}>
    {/* body */}
    <View style={styles.meditateBody} />
    {/* head */}
    <View style={styles.meditateHead}>
      {/* hair */}
      <View style={styles.meditateHair} />
      {/* glasses */}
      <View style={styles.meditateGlasses} />
    </View>
    {/* left arm */}
    <View style={styles.meditateArmLeft} />
    {/* right arm */}
    <View style={styles.meditateArmRight} />
    {/* crossed legs */}
    <View style={styles.meditateLegLeft} />
    <View style={styles.meditateLegRight} />
  </View>
);

/** Slide 2 – Plant + modality tiles */
const ModalityTiles = () => (
  <View style={styles.modalityGrid}>
    {[
      { letter: 'E', label: 'Emotion', sub: 'Facial expression', color: '#8D86E7' },
      { letter: 'H', label: 'Heart Rate', sub: 'Pulse & rhythm', color: '#E98C82' },
      { letter: 'S', label: 'Survey', sub: 'Your answers', color: '#69A6D1' },
      { letter: 'R', label: 'Reaction', sub: 'Response time', color: '#D7A47E' },
    ].map(({ letter, label, sub, color }) => (
      <View key={label} style={styles.modalityTile}>
        <Text style={[styles.tileMark, { backgroundColor: color }]}>{letter}</Text>
        <View>
          <Text style={styles.tileLabel}>{label}</Text>
          <Text style={styles.tileSubtitle}>{sub}</Text>
        </View>
      </View>
    ))}
  </View>
);

const PlantIllustration = () => (
  <View style={styles.plant}>
    <View style={styles.stem} />
    <View style={[styles.leaf, styles.leafLeft]} />
    <View style={[styles.leaf, styles.leafRight]} />
    <View style={[styles.leaf, styles.leafTop]} />
  </View>
);

/** Slide 3 – Journal / book */
const JournalIllustration = () => (
  <View style={styles.journal}>
    <View style={styles.journalPage} />
    <View style={styles.journalSpine} />
    <View style={styles.journalLeaf} />
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

/* ─────────── Navigator ─────────── */
export const OnboardingNavigator: React.FC<Props> = ({ onComplete, onSignIn }) => {
  const [page, setPage] = useState<OnboardingPage>('meditate');

  /* ── Slide 1 – Meditation (purple gradient) ── */
  if (page === 'meditate') {
    return (
      <SafeAreaView style={[styles.container, styles.meditateBackground]}>
        <Pressable style={styles.skipButton} onPress={() => setPage('welcome')}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={styles.content}>
          <MeditationIllustration />
          <Text style={styles.heading}>
            Nurture your mind,{'\n'}
            <Text style={styles.headingAccent}>embrace your journey.</Text>
          </Text>
          <Text style={styles.description}>
            Daily stress check-ins to help you understand{'\n'}
            your mental wellbeing — at your own pace.
          </Text>
          <Pagination active={0} />
        </View>

        {/* Tap anywhere to advance */}
        <Pressable
          style={styles.nextTouchArea}
          onPress={() => setPage('analysis')}
        />
      </SafeAreaView>
    );
  }

  /* ── Slide 2 – Multi-modal analysis (teal) ── */
  if (page === 'analysis') {
    return (
      <SafeAreaView style={[styles.container, styles.analysisBackground]}>
        <Pressable style={styles.skipButton} onPress={() => setPage('welcome')}>
          <Text style={[styles.skipText, { color: '#456C68' }]}>Skip</Text>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.analysisIllustrationWrap}>
            <PlantIllustration />
            <ModalityTiles />
          </View>
          <Text style={[styles.heading, { color: '#FFFDF8' }]}>
            Multi-modal analysis,{'\n'}
            <Text style={styles.headingAccentTeal}>built for precision.</Text>
          </Text>
          <Text style={[styles.description, { color: 'rgba(255,255,255,0.82)' }]}>
            Fuses your survey, heart rate, facial cues, and{'\n'}
            reaction time into one accurate stress score.
          </Text>
          <Pagination active={1} />
        </View>

        <Pressable
          style={styles.nextTouchArea}
          onPress={() => setPage('welcome')}
        />
      </SafeAreaView>
    );
  }

  /* ── Slide 3 – Your wellness story (peach) ── */
  return (
    <SafeAreaView style={[styles.container, styles.welcomeBackground]}>
      <View style={styles.content}>
        <JournalIllustration />
        <Text style={[styles.heading, { color: '#3B1F0A' }]}>
          Your wellness story,{'\n'}
          <Text style={styles.headingAccentPeach}>starts right here.</Text>
        </Text>
        <Text style={[styles.description, { color: 'rgba(59,31,10,0.65)' }]}>
          Track trends, get recommendations, and{'\n'}
          connect with professionals — all in one place.
        </Text>
        <Pagination active={2} />

        <Pressable style={styles.createButton} onPress={() => onComplete('register')}>
          <Text style={styles.createButtonText}>Create Account</Text>
          <Text style={styles.buttonArrow}>›</Text>
        </Pressable>

        <Pressable onPress={onSignIn} hitSlop={Spacing.sm}>
          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text style={styles.signInAccent}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

/* ─────────── Styles ─────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Backgrounds */
  meditateBackground: {
    backgroundColor: '#7C5CBF',
  },
  analysisBackground: {
    backgroundColor: '#B9E8DD',
  },
  welcomeBackground: {
    backgroundColor: '#F8C09A',
  },

  /* Skip */
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  skipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Content area */
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 20,
  },

  /* Invisible tap-to-next overlay */
  nextTouchArea: {
    ...StyleSheet.absoluteFill,
    top: 60,
    bottom: 0,
    zIndex: -1,
  },

  /* ── Slide 1: Meditation ── */
  meditateWrap: {
    width: 140,
    height: 170,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 28,
  },
  meditateBody: {
    width: 80,
    height: 60,
    backgroundColor: '#3B2B6B',
    borderRadius: 20,
    position: 'absolute',
    bottom: 30,
  },
  meditateHead: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#C68B6B',
    position: 'absolute',
    top: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  meditateHair: {
    position: 'absolute',
    top: 0,
    width: 42,
    height: 18,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
  },
  meditateGlasses: {
    position: 'absolute',
    top: 22,
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(80,50,20,0.4)',
  },
  meditateArmLeft: {
    position: 'absolute',
    left: 10,
    bottom: 40,
    width: 36,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B2B6B',
    transform: [{ rotate: '20deg' }],
  },
  meditateArmRight: {
    position: 'absolute',
    right: 10,
    bottom: 40,
    width: 36,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B2B6B',
    transform: [{ rotate: '-20deg' }],
  },
  meditateLegLeft: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C68B6B',
    transform: [{ rotate: '15deg' }],
  },
  meditateLegRight: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C68B6B',
    transform: [{ rotate: '-15deg' }],
  },

  /* ── Slide 2: Analysis ── */
  analysisIllustrationWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  plant: {
    width: 120,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  stem: {
    width: 3,
    height: 80,
    backgroundColor: '#718C62',
    transform: [{ rotate: '8deg' }],
  },
  leaf: {
    position: 'absolute',
    width: 28,
    height: 14,
    borderRadius: Radius.full,
    backgroundColor: '#88A978',
  },
  leafLeft: { left: 30, bottom: 32, transform: [{ rotate: '-28deg' }] },
  leafRight: { right: 27, bottom: 50, transform: [{ rotate: '28deg' }] },
  leafTop: { right: 43, top: 8, transform: [{ rotate: '65deg' }] },

  modalityGrid: {
    width: '80%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: 40,
  },
  modalityTile: {
    width: '46%',
    minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
  },
  tileMark: {
    width: 14,
    height: 14,
    borderRadius: 3,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '800',
    color: Colors.white,
    paddingTop: 2,
  },
  tileLabel: { color: '#657C77', fontSize: 8, fontWeight: '600' },
  tileSubtitle: { color: '#9AAFA9', fontSize: 5, marginTop: 1 },

  /* ── Slide 3: Welcome ── */
  journal: {
    width: 125,
    height: 92,
    marginTop: 32,
    marginBottom: 48,
    transform: [{ rotate: '-8deg' }],
  },
  journalPage: {
    position: 'absolute',
    width: 105,
    height: 70,
    left: 10,
    top: 8,
    borderWidth: 2,
    borderColor: '#80583D',
    borderRadius: 5,
    backgroundColor: '#FFF3DE',
  },
  journalSpine: {
    position: 'absolute',
    width: 3,
    height: 66,
    left: 62,
    top: 10,
    backgroundColor: '#B98259',
    transform: [{ rotate: '7deg' }],
  },
  journalLeaf: {
    position: 'absolute',
    width: 22,
    height: 11,
    borderRadius: Radius.full,
    backgroundColor: '#D87D3F',
    left: 47,
    top: 0,
    transform: [{ rotate: '-35deg' }],
  },

  /* ── Shared text ── */
  heading: {
    color: '#FFFDF8',
    textAlign: 'center',
    ...Typography.h2,
    fontSize: 18,
    lineHeight: 24,
  },
  headingAccent: {
    color: '#FFE066',
  },
  headingAccentTeal: {
    color: '#D4F5EC',
  },
  headingAccentPeach: {
    color: '#C45E1A',
  },
  description: {
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    ...Typography.caption,
    marginTop: Spacing.md,
    lineHeight: 18,
  },

  /* ── Pagination ── */
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.lg,
  },
  pageDot: {
    width: 5,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  pageDotActive: {
    width: 18,
    backgroundColor: '#D88953',
  },

  /* ── CTA buttons (slide 3) ── */
  createButton: {
    width: '88%',
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: '#D98543',
    marginTop: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  createButtonText: {
    color: Colors.white,
    ...Typography.button,
    fontSize: 14,
  },
  buttonArrow: {
    color: Colors.white,
    fontSize: 24,
    lineHeight: 22,
  },
  signInText: {
    color: 'rgba(59,31,10,0.65)',
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  signInAccent: {
    color: '#C45E1A',
    fontWeight: '700',
  },
});