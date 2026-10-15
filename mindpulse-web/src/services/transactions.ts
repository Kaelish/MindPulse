import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { fetchAvatarUrls } from './avatars';

export type PaymentMethod = 'card' | 'gcash' | 'maya' | 'cash';
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
  cash: 'Cash',
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

/** Bookings a walk-in payment can be recorded against (not yet paid/confirmed). */
export interface PayableAppointment {
  id: string;
  patientName: string;
  /** Raw ISO timestamp, or null when the slot has no date yet. */
  scheduledTime: string | null;
  rawStatus: string;
}

export const fetchPayableAppointments = async (): Promise<PayableAppointment[]> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const doctorId = await requireUserId();

  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, scheduled_for, status')
    .eq('doctor_id', doctorId)
    .in('status', ['scheduled', 'awaiting_payment'])
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    patient_id: string;
    scheduled_for: string | null;
    status: string;
  }[];
  if (!rows.length) return [];

  const patientIds = Array.from(new Set(rows.map((row) => row.patient_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name')
    .in('id', patientIds);
  const names = new Map<string, string>();
  for (const profile of (profiles ?? []) as {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
  }[]) {
    const name =
      profile.full_name?.trim() ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    if (name) names.set(profile.id, name);
  }

  return rows.map((row) => ({
    id: row.id,
    patientName: names.get(row.patient_id) || 'Patient',
    scheduledTime: row.scheduled_for,
    rawStatus: row.status,
  }));
};

/**
 * Records a walk-in payment for one of this doctor's bookings and confirms
 * the appointment. Guarded in SQL (record_walkin_payment) so a doctor can
 * only ever record a payment for their own, still-unpaid booking.
 */
export const recordWalkInPayment = async (
  appointmentId: string,
  amount: number,
  method: PaymentMethod,
): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('record_walkin_payment', {
    p_appointment_id: appointmentId,
    p_amount: amount,
    p_method: method,
  });
  if (error) throw new Error(error.message);
};
