import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface Props {
  expression: string;
  score: number;
  onBack: () => void;
  onRetry: () => void;
  onFinish: () => void;
}

const EXPR_EMOJI: Record<string, string> = {
  stressed: '😰',
  anxious: '😟',
  sad: '😢',
  neutral: '😐',
  calm: '😌',
  happy: '😄',
};

export const FaceScanResultScreen: React.FC<Props> = ({ expression, score, onBack, onRetry, onFinish }) => {
  const confidencePercent = Math.round(Math.min(1, Math.max(0, score)) * 100);
  const emoji = EXPR_EMOJI[expression] ?? '😐';
  const expressionLabel = expression.charAt(0).toUpperCase() + expression.slice(1);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to face scan instructions">
            <Ionicons name="chevron-back" size={22} color={tone('#6B79F2')} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Face Emotion Analysis</Text>
          <Text style={styles.pageSubtitle}>Demo result — not saved to your stress score</Text>
        </View>

        {/* Emotion Display Card */}
        <View style={styles.heroCard}>
          <View style={styles.gridOverlay}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridLine, { left: `${(i + 1) * 16.6}%` }]} />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: `${(i + 1) * 16.6}%` }]} />
            ))}
          </View>
          
          <Text style={styles.emojiDisplay}>{emoji}</Text>
          
          <View style={styles.resultPill}>
            <Text style={styles.resultPillText}>Sample · Likely {expressionLabel} · {confidencePercent}%</Text>
          </View>
        </View>

        {/* Facial Analysis Output */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="information-circle-outline" size={20} color={tone('#2C3473')} />
              <Text style={styles.cardTitle}>Demo Scan Output</Text>
            </View>
            <View style={styles.analyzedBadge}>
              <Ionicons name="information-circle-outline" size={14} color={tone('#E08A00')} />
              <Text style={styles.analyzedText}>Demo</Text>
            </View>
          </View>

          <View style={styles.blueBox}>
            <Text style={styles.blueBoxTitle}>Sample result:</Text>
            <Text style={styles.blueBoxHighlight}>No camera analysis was performed</Text>
            
            <View style={styles.blueBoxRow}>
              <Text style={styles.blueBoxLabel}>Possible expression:</Text>
              <Text style={styles.blueBoxValueOrange}>{expressionLabel}</Text>
            </View>
            <View style={styles.blueBoxRow}>
              <Text style={styles.blueBoxLabel}>Confidence level:</Text>
              <Text style={styles.blueBoxValue}>{confidencePercent}%</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>ABOUT THIS RESULT</Text>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Sample output for demonstration only</Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Excluded from your saved stress score</Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Real camera analysis can be enabled in a future release</Text>
          </View>

          {/* Emotion Confidence (demo) */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Emotion Confidence (demo)</Text>

            <View style={styles.barRow}>
              <Text style={styles.barEmoji}>{emoji}</Text>
              <Text style={styles.barLabel}>{expressionLabel}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${confidencePercent}%` as `${number}%`, backgroundColor: toneBg('#E87522') },
                  ]}
                />
              </View>
              <Text style={styles.barPercent}>{confidencePercent}%</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.rescanBtn} onPress={onRetry}>
            <Ionicons name="refresh" size={18} color={tone('#6B79F2')} />
            <Text style={styles.rescanText}>Rescan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={onFinish}>
            <Text style={styles.nextText}>Analysis</Text>
            <Ionicons name="arrow-forward" size={18} color={tone('#FFF')} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: toneBg('#FCFBF8') },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },

  topBar: { marginBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: tone('#6B79F2'), fontSize: 16, fontWeight: '600', marginLeft: 2 },

  pageHeader: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  pageSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },

  heroCard: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: toneBg('#11132B'),
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: toneBg('#6B79F2') },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: toneBg('#6B79F2') },
  emojiDisplay: { fontSize: 80, zIndex: 10 },
  resultPill: {
    backgroundColor: toneBg('#FBE9D9'),
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginTop: 16,
    zIndex: 10,
  },
  resultPillText: { color: tone('#E87522'), fontWeight: '800', fontSize: 14 },

  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: toneBg('#EFEFEF'),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: tone('#1A1A1A'), marginLeft: 8 },
  analyzedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#FFF3E0'), paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  analyzedText: { color: tone('#E08A00'), fontSize: 11, fontWeight: '800', marginLeft: 4 },

  blueBox: {
    backgroundColor: toneBg('#F3F8FF'),
    borderColor: toneBg('#4AA0E6'),
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 24,
  },
  blueBoxTitle: { color: tone('#1B5E20'), fontSize: 12, fontWeight: '800', marginBottom: 4 },
  blueBoxHighlight: { color: tone('#4AA0E6'), fontSize: 14, fontWeight: '800', marginBottom: 16 },
  blueBoxRow: { flexDirection: 'row', marginBottom: 4 },
  blueBoxLabel: { color: tone('#888'), fontSize: 12, width: 135 },
  blueBoxValue: { color: tone('#4AA0E6'), fontSize: 12, fontWeight: '800' },
  blueBoxValueOrange: { color: tone('#E87522'), fontSize: 12, fontWeight: '800' },

  sectionLabel: { color: tone('#888'), fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 },
  bulletItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: toneBg('#E87522'), marginRight: 8 },
  bulletText: { color: tone('#666'), fontSize: 13 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  barEmoji: { fontSize: 16, marginRight: 8 },
  barLabel: { fontSize: 12, fontWeight: '600', color: tone('#333'), width: 60 },
  barTrack: { flex: 1, height: 6, backgroundColor: toneBg('#EFEFEF'), borderRadius: 3, marginHorizontal: 12 },
  barFill: { height: '100%', borderRadius: 3 },
  barPercent: { fontSize: 12, color: tone('#888'), width: 30, textAlign: 'right' },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  rescanBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: toneBg('#EEF0FD'),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanText: { color: tone('#6B79F2'), fontWeight: '800', fontSize: 15, marginLeft: 8 },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: toneBg('#9B90FF'),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: tone('#FFF'), fontWeight: '800', fontSize: 15, marginRight: 8 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
