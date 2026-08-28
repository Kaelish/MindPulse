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
  onComplete: () => void;
  onSignIn: () => void;
}

type OnboardingPage = 'analysis' | 'welcome';

const ModalityTiles = () => (
  <View style={styles.modalityGrid}>
    <View style={styles.modalityTile}>
      <Text style={[styles.tileMark, styles.surveyMark]}>E</Text>
      <View>
        <Text style={styles.tileLabel}>Emotion</Text>
        <Text style={styles.tileSubtitle}>facial cues</Text>
      </View>
    </View>
    <View style={styles.modalityTile}>
      <Text style={[styles.tileMark, styles.faceMark]}>F</Text>
      <View>
        <Text style={styles.tileLabel}>Heart rate</Text>
        <Text style={styles.tileSubtitle}>pulse data</Text>
      </View>
    </View>
    <View style={styles.modalityTile}>
      <Text style={[styles.tileMark, styles.voiceMark]}>V</Text>
      <View>
        <Text style={styles.tileLabel}>Survey</Text>
        <Text style={styles.tileSubtitle}>your answers</Text>
      </View>
    </View>
    <View style={styles.modalityTile}>
      <Text style={[styles.tileMark, styles.reactionMark]}>R</Text>
      <View>
        <Text style={styles.tileLabel}>Reaction</Text>
        <Text style={styles.tileSubtitle}>response time</Text>
      </View>
    </View>
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

const JournalIllustration = () => (
  <View style={styles.journal}>
    <View style={styles.journalPage} />
    <View style={styles.journalSpine} />
    <View style={styles.journalLeaf} />
  </View>
);

const Pagination = ({ active }: { active: number }) => (
  <View style={styles.pagination}>
    <View style={[styles.pageDot, active === 0 && styles.pageDotActive]} />
    <View style={[styles.pageDot, active === 1 && styles.pageDotActive]} />
    <View style={[styles.pageDot, active === 2 && styles.pageDotActive]} />
  </View>
);

export const OnboardingNavigator: React.FC<Props> = ({ onComplete, onSignIn }) => {
  const [page, setPage] = useState<OnboardingPage>('analysis');

  if (page === 'analysis') {
    return (
      <SafeAreaView style={[styles.container, styles.analysisBackground]}>
        <Pressable style={styles.skipButton} onPress={() => setPage('welcome')}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={styles.content}>
          <PlantIllustration />
          <ModalityTiles />
          <Text style={styles.heading}>Multi-modal analysis{`\n`}built for precision.</Text>
          <Text style={styles.description}>
            Fuses your survey, heart rate, facial cues, and{`\n`}
            reaction time into one accurate stress score.
          </Text>
          <Pagination active={0} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, styles.welcomeBackground]}>
      <View style={styles.content}>
        <JournalIllustration />
        <Text style={styles.heading}>Your wellness story,{`\n`}starts right here.</Text>
        <Text style={styles.description}>
          Track trends, get recommendations, and{`\n`}
          connect with professionals, all in one place.
        </Text>
        <Pagination active={1} />
        <Pressable style={styles.createButton} onPress={onComplete}>
          <Text style={styles.createButtonText}>Create Account</Text>
          <Text style={styles.buttonArrow}>›</Text>
        </Pressable>
        <Pressable onPress={onSignIn} hitSlop={Spacing.sm}>
          <Text style={styles.signInText}>Already have an account? <Text style={styles.signInAccent}>Sign in</Text></Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  analysisBackground: {
    backgroundColor: '#B9E8DD',
  },
  welcomeBackground: {
    backgroundColor: '#F8C09A',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  skipText: {
    color: '#456C68',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 34,
  },
  plant: {
    width: 120,
    height: 125,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
  },
  stem: {
    width: 3,
    height: 92,
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
  leafLeft: {
    left: 30,
    bottom: 39,
    transform: [{ rotate: '-28deg' }],
  },
  leafRight: {
    right: 27,
    bottom: 61,
    transform: [{ rotate: '28deg' }],
  },
  leafTop: {
    right: 43,
    top: 8,
    transform: [{ rotate: '65deg' }],
  },
  modalityGrid: {
    width: '78%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: 55,
  },
  modalityTile: {
    width: '46%',
    minHeight: 42,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  tileMark: {
    width: 13,
    height: 13,
    borderRadius: 3,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '800',
    color: Colors.white,
    paddingTop: 2,
  },
  surveyMark: { backgroundColor: '#8D86E7' },
  faceMark: { backgroundColor: '#E98C82' },
  voiceMark: { backgroundColor: '#69A6D1' },
  reactionMark: { backgroundColor: '#D7A47E' },
  tileLabel: {
    color: '#657C77',
    fontSize: 8,
    fontWeight: '600',
  },
  tileSubtitle: {
    color: '#9AAFA9',
    fontSize: 5,
    marginTop: 1,
  },
  heading: {
    color: '#FFFDF8',
    textAlign: 'center',
    ...Typography.h2,
    fontSize: 17,
    lineHeight: 22,
  },
  description: {
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    ...Typography.caption,
    marginTop: Spacing.md,
  },
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
  journal: {
    width: 125,
    height: 92,
    marginTop: 42,
    marginBottom: 55,
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
  createButton: {
    width: '88%',
    height: 43,
    borderRadius: Radius.sm,
    backgroundColor: '#D98543',
    marginTop: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  createButtonText: {
    color: Colors.white,
    ...Typography.button,
    fontSize: 12,
  },
  buttonArrow: {
    color: Colors.white,
    fontSize: 22,
    lineHeight: 18,
    marginLeft: Spacing.sm,
  },
  signInText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    marginTop: Spacing.sm,
  },
  signInAccent: {
    color: '#FFFDF8',
    fontWeight: '700',
  },
});