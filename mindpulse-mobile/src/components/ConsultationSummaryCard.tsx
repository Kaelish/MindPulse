import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
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

const has = (value?: string | null): boolean => !!(value && value.trim());

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
          Your doctor has not shared a consultation summary for this appointment. Notes stay
          private with your doctor unless they choose to share them with you.
        </Text>
      </View>
    );
  }

  const n = note!;
  const rows: { label: string; value: string }[] = [
    { label: 'Presenting problem', value: n.presentingProblem },
    { label: 'Session content', value: n.sessionContent },
    { label: 'Interventions', value: n.interventions },
    { label: 'Client response', value: n.clientResponse },
    { label: 'Plan for next session', value: n.planNextSession },
    { label: 'Return to clinic', value: n.returnToClinic },
  ].filter((row) => has(row.value));

  // Legacy notes (written before the therapy progress note format) fall back
  // to the old four labels when the new sections are empty.
  if (rows.length === 0) {
    rows.push(
      { label: 'Session summary', value: n.summary },
      { label: 'Observations', value: n.observations },
      { label: 'Recommendation', value: n.recommendation },
      { label: 'Follow-up', value: n.followUp ?? '' },
    );
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (!has(rows[i].value)) rows.splice(i, 1);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="document-text-outline" size={15} color={tone('#5B6EF5')} />
        <Text style={styles.headTitle}>Consultation summary</Text>
      </View>

      {n.sessionDate || n.durationMinutes != null ? (
        <Text style={styles.meta}>
          {n.sessionDate}
          {n.sessionDate && n.durationMinutes != null ? ' · ' : ''}
          {n.durationMinutes != null ? `${n.durationMinutes} minutes` : ''}
        </Text>
      ) : null}

      {rows.map((row) => (
        <View key={row.label} style={styles.block}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}

      {n.signature ? (
        <View style={styles.block}>
          <Text style={styles.label}>Signed by</Text>
          <Image source={{ uri: n.signature }} style={styles.signature} resizeMode="contain" />
          {has(n.psychologist) ? <Text style={styles.signName}>{n.psychologist}</Text> : null}
        </View>
      ) : null}
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
  meta: { fontSize: 11.5, color: tone('#7A90A8') },
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
  signature: { width: '100%', height: 56, backgroundColor: '#fff', borderRadius: 8 },
  signName: { fontSize: 12, color: tone('#334155') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
