import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';

interface Props {
  expression: string;
  score: number;
  onRetry: () => void;
  onFinish: () => void;
}

export const FaceScanResultScreen: React.FC<Props> = ({ onRetry, onFinish }) => {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Face Emotion Analysis</Text>
          <Text style={styles.pageSubtitle}>Real-time face emotion detection</Text>
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
          
          <Text style={styles.emojiDisplay}>😰</Text>
          
          <View style={styles.resultPill}>
            <Text style={styles.resultPillText}>Stress Detected • 74% confidence</Text>
          </View>
        </View>

        {/* Facial Analysis Output */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#2C3473" />
              <Text style={styles.cardTitle}>Facial Analysis Output</Text>
            </View>
            <View style={styles.analyzedBadge}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#34C759" />
              <Text style={styles.analyzedText}>Analyzed</Text>
            </View>
          </View>

          <View style={styles.blueBox}>
            <Text style={styles.blueBoxTitle}>Facial indicators detected:</Text>
            <Text style={styles.blueBoxHighlight}>Possible signs of fatigue or tension</Text>
            
            <View style={styles.blueBoxRow}>
              <Text style={styles.blueBoxLabel}>Confidence level:</Text>
              <Text style={styles.blueBoxValue}>74%</Text>
            </View>
            <View style={styles.blueBoxRow}>
              <Text style={styles.blueBoxLabel}>Stress signal:</Text>
              <Text style={styles.blueBoxValueOrange}>Moderate - High</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>DETECTED FACIAL CUES</Text>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Possible signs of fatigue or tension</Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Furrowed brow detected</Text>
          </View>
          <View style={styles.bulletItem}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>Jaw muscle activation noted</Text>
          </View>
        </View>

        {/* Emotion Classification Results */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Emotion Classification Results</Text>
          
          {[
            { label: 'Stressed', emoji: '😰', percent: '49%', color: '#FF5A5F' },
            { label: 'Happy', emoji: '😄', percent: '21%', color: '#34C759' },
            { label: 'Sad', emoji: '😢', percent: '16%', color: '#8E54E9' },
            { label: 'Calm', emoji: '😌', percent: '7%', color: '#5AC8FA' },
            { label: 'Neutral', emoji: '😐', percent: '5%', color: '#E8A359' },
            { label: 'Anxious', emoji: '😟', percent: '2%', color: '#8E8E93' },
          ].map((item, idx) => (
            <View key={idx} style={styles.barRow}>
              <Text style={styles.barEmoji}>{item.emoji}</Text>
              <Text style={styles.barLabel}>{item.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: item.percent as `${number}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={styles.barPercent}>{item.percent}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.rescanBtn} onPress={onRetry}>
            <Ionicons name="refresh" size={18} color="#6B79F2" />
            <Text style={styles.rescanText}>Rescan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={onFinish}>
            <Text style={styles.nextText}>Analysis</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFBF8' },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  
  pageHeader: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  pageSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },

  heroCard: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: '#11132B',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#6B79F2' },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#6B79F2' },
  emojiDisplay: { fontSize: 80, zIndex: 10 },
  resultPill: {
    backgroundColor: '#FBE9D9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginTop: 16,
    zIndex: 10,
  },
  resultPillText: { color: '#E87522', fontWeight: '800', fontSize: 14 },

  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginLeft: 8 },
  analyzedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  analyzedText: { color: '#34C759', fontSize: 11, fontWeight: '800', marginLeft: 4 },

  blueBox: {
    backgroundColor: '#F3F8FF',
    borderColor: '#4AA0E6',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 24,
  },
  blueBoxTitle: { color: '#1B5E20', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  blueBoxHighlight: { color: '#4AA0E6', fontSize: 14, fontWeight: '800', marginBottom: 16 },
  blueBoxRow: { flexDirection: 'row', marginBottom: 4 },
  blueBoxLabel: { color: '#888', fontSize: 12, width: 110 },
  blueBoxValue: { color: '#4AA0E6', fontSize: 12, fontWeight: '800' },
  blueBoxValueOrange: { color: '#E87522', fontSize: 12, fontWeight: '800' },

  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 },
  bulletItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E87522', marginRight: 8 },
  bulletText: { color: '#666', fontSize: 13 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  barEmoji: { fontSize: 16, marginRight: 8 },
  barLabel: { fontSize: 12, fontWeight: '600', color: '#333', width: 60 },
  barTrack: { flex: 1, height: 6, backgroundColor: '#EFEFEF', borderRadius: 3, marginHorizontal: 12 },
  barFill: { height: '100%', borderRadius: 3 },
  barPercent: { fontSize: 12, color: '#888', width: 30, textAlign: 'right' },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  rescanBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#EEF0FD',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanText: { color: '#6B79F2', fontWeight: '800', fontSize: 15, marginLeft: 8 },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#9B90FF',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: '#FFF', fontWeight: '800', fontSize: 15, marginRight: 8 },
});
