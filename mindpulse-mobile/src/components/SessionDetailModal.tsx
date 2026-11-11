import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { StressSessionItem } from '../services/dashboard';
import { supabase } from '../supabase/client';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

interface SessionDetailModalProps {
  visible: boolean;
  session: StressSessionItem | null;
  onClose: () => void;
}

const levelPalette = (status: StressSessionItem['status']) => {
  if (status === 'Low') return { bg: toneBg('#D6F5E3'), color: tone('#27AE60'), label: 'Low' };
  if (status === 'Moderate') return { bg: toneBg('#FFF3CD'), color: tone('#E08A00'), label: 'Moderate' };
  return { bg: toneBg('#FFD6D6'), color: tone('#E05C5C'), label: 'High' };
};

const formatTime = (iso?: string): string | null => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatReactionTime = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;

interface AnswerItem {
  text: string;
  label: string;
  value: number;
}

const readAnswerItems = (source: unknown): AnswerItem[] => {
  if (!source || typeof source !== 'object') return [];
  const items = (source as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .filter(
      (item): item is AnswerItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { text?: unknown }).text === 'string' &&
        typeof (item as { label?: unknown }).label === 'string' &&
        typeof (item as { value?: unknown }).value === 'number',
    )
    .map((item) => ({ text: item.text, label: item.label, value: item.value }));
};

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  visible, session, onClose,
}) => {
  const lp = session ? levelPalette(session.status) : null;
  const time = session ? formatTime(session.createdAt) : null;
  const [answerItems, setAnswerItems] = useState<AnswerItem[]>([]);

  useEffect(() => {
    setAnswerItems([]);
    if (!visible || !session) return;
    const embedded = readAnswerItems((session as unknown as { survey_answers?: unknown }).survey_answers);
    if (embedded.length > 0) {
      setAnswerItems(embedded);
      return;
    }
    let cancelled = false;
    const loadAnswers = async () => {
      try {
        const { data } = await supabase
          .from('stress_sessions')
          .select('survey_answers')
          .eq('id', session.id)
          .maybeSingle();
        if (cancelled) return;
        setAnswerItems(readAnswerItems((data as { survey_answers?: unknown } | null)?.survey_answers));
      } catch {
        if (!cancelled) setAnswerItems([]);
      }
    };
    void loadAnswers();
    return () => {
      cancelled = true;
    };
  }, [visible, session]);

  const metrics: { icon: any; label: string; value: string; color: string; bg: string }[] = [];
  if (session) {
    if (typeof session.heartRate === 'number') {
      metrics.push({ icon: 'heart', label: 'Heart Rate', value: `${session.heartRate} bpm`, color: tone('#E05C5C'), bg: toneBg('#FFD6D6') });
    }
    if (typeof session.surveyScore === 'number') {
      metrics.push({ icon: 'clipboard', label: 'Survey Score', value: `${session.surveyScore}`, color: tone('#5B6EF5'), bg: toneBg('#EEEDFE') });
    }
    if (session.emotion) {
      const emotionValue = session.emotion.charAt(0).toUpperCase() + session.emotion.slice(1);
      metrics.push({ icon: 'happy-outline', label: 'Detected Emotion', value: emotionValue, color: tone('#8353E2'), bg: toneBg('#F0E8FB') });
    }
    if (typeof session.reactionTimeMs === 'number') {
      metrics.push({ icon: 'flash-outline', label: 'Reaction Time', value: formatReactionTime(session.reactionTimeMs), color: tone('#2C7A7B'), bg: toneBg('#E6F7F5') });
    }
    if (typeof session.faceConfidencePercent === 'number') {
      metrics.push({ icon: 'scan-outline', label: 'Face Confidence', value: `${session.faceConfidencePercent}%`, color: tone('#E08A00'), bg: toneBg('#FFF3CD') });
    }
  }

  return (
    <Modal visible={visible && !!session} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── HEADER ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="stats-chart" size={18} color={tone('#5B6EF5')} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Session Details</Text>
                <Text style={styles.headerSub}>Assessment summary & metrics</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeIcon}>
              <Ionicons name="close" size={18} color={tone('#64748B')} />
            </Pressable>
          </View>

          {session && lp && (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* ── SCORE SUMMARY ── */}
              <View style={styles.summaryCard}>
                <View style={[styles.scoreCircle, { backgroundColor: lp.bg }]}>
                  <Text style={[styles.scoreValue, { color: lp.color }]}>{session.score}</Text>
                  <Text style={[styles.scoreOutOf, { color: lp.color }]}>/100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.levelBadge, { backgroundColor: lp.bg }]}>
                    <Text style={[styles.levelBadgeText, { color: lp.color }]}>{lp.label} Stress</Text>
                  </View>
                  <Text style={styles.summaryDate}>{session.date}</Text>
                  {time && <Text style={styles.summaryTime}>{time}</Text>}
                </View>
              </View>

              {/* ── METRICS BREAKDOWN ── */}
              <Text style={styles.sectionLabel}>METRICS BREAKDOWN</Text>
              {metrics.length === 0 ? (
                <Text style={styles.emptyText}>
                  No additional metrics were recorded for this session.
                </Text>
              ) : (
                <View style={styles.metricGrid}>
                  {metrics.map(m => (
                    <View key={m.label} style={styles.metricCell}>
                      <View style={[styles.metricIconBox, { backgroundColor: m.bg }]}>
                        <Ionicons name={m.icon} size={14} color={m.color} />
                      </View>
                      <Text style={styles.metricLabel}>{m.label}</Text>
                      <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {answerItems.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>ANSWERS</Text>
                  <View style={styles.answerList}>
                    {answerItems.map((item, index) => (
                      <View key={`${item.text}-${index}`} style={styles.answerRow}>
                        <View style={styles.answerIndexBox}>
                          <Text style={styles.answerIndexText}>{index + 1}</Text>
                        </View>
                        <View style={styles.answerBody}>
                          <Text style={styles.answerText}>{item.text}</Text>
                          <View style={styles.answerMeta}>
                            <Text style={styles.answerLabel}>{item.label}</Text>
                            <Text style={styles.answerValue}>{item.value}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* ── NOTES ── */}
              {session.notes ? (
                <>
                  <Text style={styles.sectionLabel}>ANALYSIS NOTES</Text>
                  <View style={styles.notesCard}>
                    <Text style={styles.notesText}>{session.notes}</Text>
                  </View>
                </>
              ) : null}

              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
              <View style={{ height: 16 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: toneBg('#FAF8F3'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: { width: 36, height: 4, backgroundColor: toneBg('#CBD5E1'), borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: toneBg('#EEEDFE'), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: toneBg('#E2E8F0'), alignItems: 'center', justifyContent: 'center' },

  scroll: { maxHeight: 560 },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  scoreCircle: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  scoreValue: { fontSize: 24, fontWeight: '900' },
  scoreOutOf: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  levelBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  levelBadgeText: { fontSize: 12, fontWeight: '800' },
  summaryDate: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', marginTop: 8 },
  summaryTime: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.textHint, fontStyle: 'italic' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCell: {
    width: '47.5%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 4,
  },
  metricIconBox: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  metricLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  metricValue: { fontSize: 15, fontWeight: '800' },

  notesCard: { backgroundColor: toneBg('#EEEDFE'), borderRadius: 14, padding: 14 },
  notesText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },

  answerList: { gap: 10 },
  answerRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  answerIndexBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: toneBg('#EEEDFE'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  answerIndexText: { fontSize: 12, fontWeight: '800', color: tone('#5B6EF5') },
  answerBody: { flex: 1, gap: 6 },
  answerText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  answerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  answerLabel: { fontSize: 13, fontWeight: '700', color: tone('#5B6EF5'), flex: 1 },
  answerValue: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  closeBtn: { marginTop: 20, height: 50, borderRadius: 14, backgroundColor: toneBg('#5B6EF5'), alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: tone('#FFF'), fontWeight: '800', fontSize: 15 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
