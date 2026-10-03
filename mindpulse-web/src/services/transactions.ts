import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { fetchAvatarUrls } from './avatars';

export type PaymentMethod = 'card' | 'gcash' | 'maya';
export type PaymentStatus = 'paid' | 'refunded';

export interface DoctorTransactionItem {
  id: string;
  createdAt: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  status: PaymentStatus;
  appointmentId: string;
  scheduledFor: string | null;
  appointmentStatus: string | null;
  patientName: string;
  /** Patient's profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
}

interface AppointmentEmbed {
  id: string;
  scheduled_for: string;
  status: string;
  patient_id: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  reference: string;
  status: string;
  created_at: string;
  appointment_id: string;
  appointments: AppointmentEmbed | AppointmentEmbed[] | null;
}

const singleAppointment = (
  embed: PaymentRow['appointments'],
): AppointmentEmbed | null => {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  gcash: 'GCash',
  maya: 'Maya',
};

export const formatTransactionDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

export const formatTransactionAmount = (value: number): string =>
  `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Payments for this doctor's appointments. RLS on `payments` already scopes
 * the rows to appointments owned by the signed-in doctor, so no extra filter
 * is needed — the query only has to join the appointment for its patient.
 */
export const fetchDoctorTransactions = async (): Promise<DoctorTransactionItem[]> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  await requireUserId();

  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount, method, reference, status, created_at, appointment_id, appointments(id, scheduled_for, status, patient_id)',
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PaymentRow[];
  const patientIds = Array.from(
    new Set(
      rows
        .map((row) => singleAppointment(row.appointments)?.patient_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const patientNames = new Map<string, string>();
  const avatars = patientIds.length > 0 ? await fetchAvatarUrls(patientIds) : new Map();
  if (patientIds.length > 0) {
    const { data: patients, error: patientsError } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name')
      .in('id', patientIds);
    if (!patientsError && patients) {
      (patients as { id: string; full_name: string | null; first_name: string | null; last_name: string | null }[]).forEach(
        (patient) => {
          const name =
            patient.full_name?.trim() ||
            [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim();
          if (name) patientNames.set(patient.id, name);
        },
      );
    }
  }

  return rows.map((row) => {
    const appointment = singleAppointment(row.appointments);
    return {
      id: row.id,
      createdAt: row.created_at,
      amount: Number(row.amount),
      method: row.method as PaymentMethod,
      reference: row.reference,
      status: row.status as PaymentStatus,
      appointmentId: row.appointment_id,
      scheduledFor: appointment?.scheduled_for ?? null,
      appointmentStatus: appointment?.status ?? null,
      patientName: (appointment && patientNames.get(appointment.patient_id)) || 'Patient',
      avatarUrl: (appointment && avatars.get(appointment.patient_id)) ?? null,
    };
  });
};
