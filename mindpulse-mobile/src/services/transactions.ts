import { supabase } from '../supabase/client';
import { ConsultationMode } from './appointments';

export type PaymentMethod = 'card' | 'gcash' | 'maya' | 'cash';
export type PaymentStatus = 'paid' | 'refunded';

export interface TransactionItem {
  id: string;
  createdAt: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  status: PaymentStatus;
  appointmentId: string | null;
  scheduledFor: string | null;
  appointmentStatus: string | null;
  doctorName: string;
  /**
   * How the session happened — drives the receipt's Service row and banner.
   * Payments recorded before migration 0025 were all online bookings, so a
   * missing column maps to 'online'.
   */
  consultationMode: ConsultationMode;
}

interface AppointmentEmbed {
  id: string;
  scheduled_for: string;
  status: string;
  doctor_id: string;
  consultation_mode?: string | null;
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

export const fetchMyTransactions = async (): Promise<TransactionItem[]> => {
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount, method, reference, status, created_at, appointment_id, appointments(id, scheduled_for, status, doctor_id, consultation_mode)',
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PaymentRow[];
  const doctorIds = Array.from(
    new Set(
      rows
        .map((row) => singleAppointment(row.appointments)?.doctor_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const doctorNames = new Map<string, string>();
  if (doctorIds.length > 0) {
    const { data: doctors, error: doctorsError } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name')
      .in('id', doctorIds);
    if (!doctorsError && doctors) {
      (doctors as { id: string; full_name: string | null; first_name: string | null; last_name: string | null }[]).forEach(
        (doctor) => {
          const name =
            doctor.full_name?.trim() ||
            [doctor.first_name, doctor.last_name].filter(Boolean).join(' ').trim();
          if (name) doctorNames.set(doctor.id, name);
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
      appointmentId: row.appointment_id ?? appointment?.id ?? null,
      scheduledFor: appointment?.scheduled_for ?? null,
      appointmentStatus: appointment?.status ?? null,
      doctorName: (appointment && doctorNames.get(appointment.doctor_id)) || 'Clinician',
      consultationMode: appointment?.consultation_mode === 'in_person' ? 'in_person' : 'online',
    };
  });
};
