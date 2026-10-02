import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  StudentConsultationNote,
  fetchConsultationNote,
  hasConsultationContent,
} from '../services/consultationLifecycle';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

interface ConsultationSummaryCardProps {
  appointmentId: string;
}

type LoadState = 'loading' | 'ready';

export const ConsultationSummaryCard: React.FC<ConsultationSummaryCardProps> = ({
  appointmentId,
}) => {
  const [state, setState] = useState<LoadState>('loading');
  const [note, setNote] = useState<StudentConsultationNote | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await fetchConsultationNote(appointmentId).catch(() => null);
      if (cancelled) return;
      setNote(loaded);
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  if (state === 'loading') {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={tone('#5B6EF5')} />
      </View>
    );
  }

  if (!hasConsultationContent(note)) {
    return (
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Ionicons name="document-text-outline" size={15} color={tone('#5B6EF5')} />
          <Text style={styles.headTitle}>Consultation summary</Text>
        </View>
        <Text style={styles.pending}>
          Your doctor has not added a summary for this consultation yet. It will appear here
          once they write it.
        </Text>
      </View>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Session summary', value: note!.summary },
    { label: 'Observations', value: note!.observations },
    { label: 'Recommendation', value: note!.recommendation },
    { label: 'Follow-up', value: note!.followUp ?? '' },
  ].filter((row) => row.value.trim().length > 0);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="document-text-outline" size={15} color={tone('#5B6EF5')} />
        <Text style={styles.headTitle}>Consultation summary</Text>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.block}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: toneBg('#F5F7FC'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: toneBg('#E4E8F0'),
    padding: 14,
    marginTop: 6,
    gap: 10,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headTitle: { fontSize: 13.5, fontWeight: '800', color: tone('#1A2E44') },
  pending: { fontSize: 12.5, lineHeight: 18, color: tone('#64748B') },
  block: { gap: 3 },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: tone('#7A90A8'),
  },
  value: { fontSize: 13, lineHeight: 19, color: tone('#334155') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
