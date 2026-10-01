import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface Props {
  onComplete: (expression: string, confidence: number) => void;
  onBack: () => void;
}

export const FaceScanCameraScreen: React.FC<Props> = ({ onComplete, onBack }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Demo mode: simulate scan progress (no camera is opened, no model runs)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Fixed sample result for the demo — never persisted to the assessment record
          onComplete('stressed', 0.74);
          return 100;
        }
        return prev + 2;
      });
    }, 60); // approx 3 seconds total

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Face Emotion Analysis</Text>
        <Text style={styles.pageSubtitle}>Demo scan — camera analysis is not enabled yet</Text>
      </View>

      <View style={styles.content}>
        {/* Fake Camera / Scanning Box */}
        <View style={styles.cameraContainer}>
          {/* Grid Background */}
          <View style={styles.gridOverlay}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridLine, { left: `${(i + 1) * 16.6}%` }]} />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: `${(i + 1) * 16.6}%` }]} />
            ))}
          </View>

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>DEMO</Text>
            </View>
            <View style={styles.aiBadge}>
              <Ionicons name="flash" size={12} color={tone('#FFF')} />
              <Text style={styles.aiText}>SAMPLE</Text>
            </View>
          </View>

          {/* Scan Graphic (Mock) */}
          <View style={styles.scanGraphicWrap}>
            {/* Corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Mock Face */}
            <View style={styles.mockFace} />
            <View style={styles.mockShoulders} />

            {/* Scanning Laser Line */}
            <View style={[styles.laserLine, { top: `${Math.max(10, progress)}%` }]} />
          </View>

          {/* Progress Bar under camera frame */}
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Processing Info */}
        <View style={styles.processingCard}>
          <MaterialCommunityIcons name="line-scan" size={24} color={tone('#6B79F2')} />
          <View style={styles.processingTextWrap}>
            <Text style={styles.processingTitle}>Running demo scan...</Text>
            <Text style={styles.processingSub}>{progress}% processed</Text>
          </View>
        </View>

        <Text style={styles.statusText}>Demo in progress — no camera is used</Text>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: toneBg('#FCFBF8') },
  pageHeader: { alignItems: 'center', marginTop: 32, marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  pageSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },

  content: { flex: 1, paddingHorizontal: Spacing.lg, alignItems: 'center' },
  cameraContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: toneBg('#11132B'),
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
  },
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: toneBg('#6B79F2') },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: toneBg('#6B79F2') },

  badgesRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, zIndex: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#E08A00'), paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: toneBg('#FFF'), marginRight: 4 },
  liveText: { color: tone('#FFF'), fontSize: 11, fontWeight: '800' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#9B90FF'), paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  aiText: { color: tone('#FFF'), fontSize: 11, fontWeight: '800', marginLeft: 4 },

  scanGraphicWrap: {
    position: 'absolute',
    top: '20%', bottom: '20%', left: '25%', right: '25%',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: toneBg('#00E676'), borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  mockFace: { width: 70, height: 85, backgroundColor: toneBg('#FAD5C5'), borderRadius: 35, zIndex: 2 },
  mockShoulders: { width: 110, height: 20, backgroundColor: toneBg('#5D9CEC'), borderTopLeftRadius: 40, borderTopRightRadius: 40, marginTop: -5, zIndex: 1 },

  laserLine: {
    position: 'absolute',
    left: -20, right: -20,
    height: 2,
    backgroundColor: toneBg('#FF3B30'),
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    zIndex: 10,
  },

  progressBarWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressBarFill: { height: '100%', backgroundColor: toneBg('#9B90FF') },

  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: toneBg('#EAEBFF'),
    borderRadius: Radius.lg,
    padding: Spacing.md,
    width: '100%',
    marginBottom: 24,
  },
  processingTextWrap: { marginLeft: 12 },
  processingTitle: { color: tone('#2C3473'), fontSize: 15, fontWeight: '700' },
  processingSub: { color: tone('#7E84B8'), fontSize: 13, marginTop: 2 },

  statusText: { color: tone('#2C3473'), fontSize: 16, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
