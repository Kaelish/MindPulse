import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PatientDoctorNote,
  fetchConsultationNote,
  hasConsultationContent,
} from '../services/consultationLifecycle';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

interface ConsultationSummaryCardProps {
  appointmentId: string;
}

type LoadState = 'loading' | 'ready';

const has = (value?: string | null): boolean => !!(value && value.trim());

/**
 * The patient's window into this appointment: the short note the doctor
 * explicitly published. The therapy progress note itself is a private
 * clinical record and is never fetched here — the service asks for
 * patient_note through an RPC that cannot return anything else.
 */
export const ConsultationSummaryCard: React.FC<ConsultationSummaryCardProps> = ({
  appointmentId,
}) => {
  const [state, setState] = useState<LoadState>('loading');
  const [note, setNote] = useState<PatientDoctorNote | null>(null);

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
          <Text style={styles.headTitle}>Note from your doctor</Text>
        </View>
        <Text style={styles.pending}>
          Your doctor has not published a note for this appointment yet. Anything they write for
          you will appear here — the rest of their clinical notes stay private with them.
        </Text>
      </View>
    );
  }

  const n = note!;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="document-text-outline" size={15} color={tone('#5B6EF5')} />
        <Text style={styles.headTitle}>Note from your doctor</Text>
      </View>

      {n.sessionDate ? <Text style={styles.meta}>{n.sessionDate}</Text> : null}

      <Text style={styles.value}>{n.patientNote}</Text>

      {n.signature || has(n.psychologist) ? (
        <View style={styles.block}>
          {n.signature ? (
            <Image source={{ uri: n.signature }} style={styles.signature} resizeMode="contain" />
          ) : null}
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
