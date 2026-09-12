import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { PrimaryButton } from '../../components/PrimaryButton';

interface Props {
  expression: string;
  score: number;
  onFinish: () => void;
  onRetry: () => void;
}

export const FaceScanResultScreen: React.FC<Props> = ({ expression, score, onFinish, onRetry }) => {
  // Map expression to user-friendly terminology and emojis
  const expressionMap: Record<string, { label: string, emoji: string, color: string, desc: string }> = {
    happy: { label: 'Happy / Relaxed', emoji: '😊', color: '#27AE60', desc: 'Your facial muscles indicate a relaxed and positive state.' },
    neutral: { label: 'Neutral / Calm', emoji: '😐', color: '#4A90D9', desc: 'Your facial muscles are resting naturally.' },
    sad: { label: 'Sad / Fatigued', emoji: '😔', color: '#7C4DCC', desc: 'We detected signs of fatigue or low mood in your expression.' },
    angry: { label: 'Tense / Stressed', emoji: '😠', color: '#E05C5C', desc: 'We detected tension and stress micro-expressions.' },
    fearful: { label: 'Anxious', emoji: '😨', color: '#E08A00', desc: 'We detected signs of anxiety in your facial muscles.' },
    disgusted: { label: 'Tense', emoji: '😖', color: '#E05C5C', desc: 'We detected strong facial tension.' },
    surprised: { label: 'Alert', emoji: '😲', color: '#F5C15E', desc: 'Your expression shows high alertness.' },
  };

  const result = expressionMap[expression.toLowerCase()] || expressionMap.neutral;
  const confidencePercent = Math.round(score * 100);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Analysis Complete</Text>
        
        <View style={styles.card}>
          <View style={[styles.emojiCircle, { backgroundColor: result.color + '20' }]}>
            <Text style={styles.emoji}>{result.emoji}</Text>
          </View>
          
          <Text style={[styles.resultLabel, { color: result.color }]}>
            {result.label}
          </Text>
          
          <Text style={styles.confidence}>
            {confidencePercent}% Confidence
          </Text>
          
          <Text style={styles.desc}>
            {result.desc}
          </Text>
        </View>

      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <PrimaryButton label="Save to Dashboard" onPress={onFinish} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(0,0,0,0.08)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }
    }),
  },
  emojiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emoji: {
    fontSize: 50,
  },
  resultLabel: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  confidence: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  desc: {
    fontSize: 16,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  retryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  retryText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
});
