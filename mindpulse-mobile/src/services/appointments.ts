import { supabase } from '../supabase/client';
import { loadNotificationPrefs } from './notificationPrefs';

export interface TelehealthClinician {
  id: string;
  name: string;
  specialty: string;
  avatar: string;
  verified: boolean;
  bio: string;
  tags: string[];
  email: string;
  fee: number;
  slots: string[];
}

export type AppointmentState =
  | 'scheduled'
  | 'awaiting_payment'
  | 'declined'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'card' | 'gcash' | 'maya';

export interface BookedAppointment {
  id: string;
  clinicianId: string;
  clinicianName: string;
  specialty: string;
  selectedDate: string; // e.g. "Aug 31, 2026"
  selectedTime: string; // e.g. "3:30 PM"
  createdAt: string;
}

/** One of the patient's appointment rows plus the doctor's current fee. */
export interface MyBooking {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  scheduledFor: string; // "Aug 31, 2026 at 3:30 PM"
  status: AppointmentState;
  declineReason?: string;
  fee: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
}

const requireUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return user;
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const generateRealLifeDates = (): { label: string; dateStr: string }[] => {
  const dates: { label: string; dateStr: string }[] = [];
  const today = new Date();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[d.getDay()];
    dates.push({
      label: dayName,
      dateStr: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    });
  }

  return dates;
};

/**
 * True when the slot's start time has already passed in real time.
 * Formats: dateStr "Oct 2, 2026" (as produced by generateRealLifeDates) and
 * time "5:30 PM". Unknown formats are treated as bookable.
 */
export const isSlotInPast = (dateStr: string, time: string, now: Date = new Date()): boolean => {
  const dateMatch = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return false;

  const monthIdx = MONTHS_SHORT.indexOf(
    dateMatch[1][0].toUpperCase() + dateMatch[1].slice(1, 3).toLowerCase(),
  );
  if (monthIdx < 0) return false;

  let hour = Number(timeMatch[1]) % 12;
  if (timeMatch[3].toLowerCase() === 'pm') hour += 12;
  const slotStart = new Date(
    Number(dateMatch[3]),
    monthIdx,
    Number(dateMatch[2]),
    hour,
    Number(timeMatch[2]),
  );

  return slotStart.getTime() <= now.getTime();
};

const CLINICIAN_SELECT =
  'id, first_name, last_name, full_name, email, doctor_profiles ( specialization, bio, tags, is_verified, consultation_fee, available_slots )';

const DEFAULT_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
];

const toClinician = (row: any): TelehealthClinician => {
  const embedded = Array.isArray(row.doctor_profiles) ? row.doctor_profiles[0] : row.doctor_profiles;
  const baseName =
    `${row.full_name || ''}`.trim() ||
    `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
    row.email ||
    'Clinician';
  const displayName = /^dr\.?\s/i.test(baseName) ? baseName : `Dr. ${baseName}`;
  const nameParts = displayName.split(/\s+/);
  const avatar =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

  return {
    id: String(row.id),
    name: displayName,
    specialty: embedded?.specialization || 'Mental Health Professional',
    avatar,
    verified: Boolean(embedded?.is_verified),
    bio: embedded?.bio || 'No bio provided yet.',
    tags: Array.isArray(embedded?.tags) ? embedded.tags : [],
    email: row.email || '',
    fee: embedded?.consultation_fee != null ? Number(embedded.consultation_fee) : 500,
    slots:
      Array.isArray(embedded?.available_slots) && embedded.available_slots.length > 0
        ? embedded.available_slots
        : [...DEFAULT_SLOTS],
  };
};

export const fetchClinicians = async (): Promise<TelehealthClinician[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(CLINICIAN_SELECT)
    .eq('role', 'doctor')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(toClinician);
};

export const fetchClinicianById = async (id: string): Promise<TelehealthClinician | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(CLINICIAN_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? toClinician(data) : null;
};

// The Messages tab talks to the doctor of the patient's most recent appointment.
export const fetchConversationClinician = async (): Promise<TelehealthClinician | null> => {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('appointments')
    .select('doctor_id, created_at')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.length === 0) {
    return null;
  }
  return fetchClinicianById(data[0].doctor_id);
};

export const fetchBookedSlotKeys = async (doctorId: string): Promise<Set<string>> => {
  await requireUser();

  // Scoped per clinician: RLS only returns rows the caller owns, so this is
  // "my active bookings with this clinician". Cross-patient conflicts are
  // resolved on the clinician's dashboard.
  const { data, error } = await supabase
    .from('appointments')
    .select('scheduled_for')
    .eq('doctor_id', doctorId)
    .in('status', ['scheduled', 'awaiting_payment', 'confirmed']);

  if (error) {
    throw new Error(error.message);
  }

  // Rows are written by saveBookedAppointment as "<date> at <time>".
  const slotSet = new Set<string>();
  (data ?? []).forEach((row: any) => {
    const parts = String(row.scheduled_for || '').split(' at ');
    if (parts.length === 2 && parts[0] && parts[1]) {
      slotSet.add(`${parts[0]}_${parts[1]}`);
    }
  });
  return slotSet;
};

export const saveBookedAppointment = async (
  appointment: Omit<BookedAppointment, 'id' | 'createdAt'>,
): Promise<BookedAppointment> => {
  const user = await requireUser();

  const { data: inserted, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: user.id,
      doctor_id: appointment.clinicianId,
      scheduled_for: `${appointment.selectedDate} at ${appointment.selectedTime}`,
      status: 'scheduled',
      notes: `Booked session with ${appointment.clinicianName}`,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Could not book the appointment. Please try again.');
  }

  // Non-critical: a notification failure must not undo a booked appointment.
  // The patient's own notice honours their appointment-reminder preference;
  // the doctor's notice is always written and filtered on their own device.
  const prefs = await loadNotificationPrefs();
  if (prefs.appointmentReminders) {
    const { error: patientNoticeError } = await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Appointment Requested',
      message: `Your request for ${appointment.selectedDate} at ${appointment.selectedTime} with ${appointment.clinicianName} was sent for approval.`,
      type: 'appointment',
    });
    void patientNoticeError;
  }

  const { error: doctorNoticeError } = await supabase.from('notifications').insert({
    user_id: appointment.clinicianId,
    title: 'New Appointment Request',
    message: `A student requested a session on ${appointment.selectedDate} at ${appointment.selectedTime}. Approve or decline it from the Consultations page.`,
    type: 'appointment',
  });
  void doctorNoticeError;

  const row: any = inserted;
  return {
    id: String(row.id),
    ...appointment,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
};

export const fetchChatMessages = async (clinicianId: string): Promise<ChatMessage[]> => {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('patient_id', user.id)
    .eq('clinician_id', clinicianId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    sender: row.sender === 'doctor' ? 'doctor' : 'patient',
    text: row.text,
    timestamp: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now',
  }));
};

// The mobile app is the patient app: messages are always sent as the patient.
export const sendChatMessage = async (
  clinicianId: string,
  text: string,
): Promise<ChatMessage> => {
  const user = await requireUser();

  const { data: inserted, error } = await supabase
    .from('chat_messages')
    .insert({
      patient_id: user.id,
      clinician_id: clinicianId,
      sender: 'patient',
      text,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Could not send the message. Please try again.');
  }

  const row: any = inserted;
  return {
    id: String(row.id),
    sender: 'patient',
    text: row.text,
    timestamp: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now',
  };
};

// ─── My bookings (patient side of the telehealth workflow) ───────────────────

export const fetchMyBookings = async (): Promise<MyBooking[]> => {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('appointments')
    .select('id, doctor_id, scheduled_for, status, decline_reason, created_at')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const doctorIds = Array.from(new Set(rows.map((row) => String(row.doctor_id))));
  const { data: doctors, error: doctorsError } = await supabase
    .from('profiles')
    .select(CLINICIAN_SELECT)
    .in('id', doctorIds);
  if (doctorsError) {
    throw new Error(doctorsError.message);
  }
  const doctorById = new Map<string, any>();
  (doctors ?? []).forEach((doc) => doctorById.set(String(doc.id), doc));

  return rows.map((row) => {
    const doc = doctorById.get(String(row.doctor_id));
    const clinician = doc ? toClinician(doc) : null;
    return {
      id: String(row.id),
      doctorId: String(row.doctor_id),
      doctorName: clinician?.name ?? 'Clinician',
      specialty: clinician?.specialty ?? 'Mental Health Professional',
      scheduledFor: String(row.scheduled_for || ''),
      status: (row.status ?? 'scheduled') as AppointmentState,
      declineReason: row.decline_reason ?? undefined,
      fee: clinician?.fee ?? 500,
      createdAt: row.created_at ?? new Date().toISOString(),
    } satisfies MyBooking;
  });
};

/**
 * Deterministic Jitsi room per appointment — the patient and the doctor always
 * meet in the same room (mindpulse-appt-<appointment id>).
 */
export const fetchVideoRoom = async (appointmentId: string, doctorId: string): Promise<string> => {
  const user = await requireUser();
  const roomName = `mindpulse-appt-${appointmentId}`;
  const meetingUrl = `https://meet.jit.si/${roomName}`;

  const { data: existing, error: lookupError } = await supabase
    .from('video_sessions')
    .select('room_name, meeting_url')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.meeting_url || existing?.room_name) {
    return existing.meeting_url || `https://meet.jit.si/${existing.room_name}`;
  }

  const { error } = await supabase.from('video_sessions').insert({
    patient_id: user.id,
    doctor_id: doctorId,
    appointment_id: appointmentId,
    room_name: roomName,
    meeting_url: meetingUrl,
    status: 'pending',
  });
  if (error) {
    const { data: again } = await supabase
      .from('video_sessions')
      .select('room_name, meeting_url')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (again?.meeting_url || again?.room_name) {
      return again.meeting_url || `https://meet.jit.si/${again.room_name}`;
    }
    throw new Error(error.message);
  }
  return meetingUrl;
};

/**
 * Mock online payment: records a paid payment, flips the appointment to
 * confirmed (a DB guard requires the payment row to exist first), notifies the
 * doctor, and returns the shared video room URL.
 */
export const payForAppointment = async (
  booking: MyBooking,
  method: PaymentMethod,
): Promise<string> => {
  const user = await requireUser();

  // Idempotency: a retry after a half-failed attempt must not double-charge.
  const { data: prior, error: priorError } = await supabase
    .from('payments')
    .select('id')
    .eq('appointment_id', booking.id)
    .eq('status', 'paid')
    .limit(1);
  if (priorError) throw new Error(priorError.message);

  if (!prior || prior.length === 0) {
    const reference = `MP-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const { data: payment, error: payError } = await supabase
      .from('payments')
      .insert({
        appointment_id: booking.id,
        patient_id: user.id,
        amount: booking.fee,
        method,
        reference,
      })
      .select('id')
      .single();
    if (payError || !payment) {
      throw new Error(payError?.message || 'The payment could not be processed. Please try again.');
    }
  }

  const { error: confirmError } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', booking.id)
    .eq('status', 'awaiting_payment');
  if (confirmError) {
    throw new Error(confirmError.message || 'Your payment was recorded but confirmation failed.');
  }

  const { error: noticeError } = await supabase.from('notifications').insert({
    user_id: booking.doctorId,
    title: 'Payment Received',
    message: `Payment received for the session on ${booking.scheduledFor}. The appointment is confirmed.`,
    type: 'appointment',
  });
  void noticeError;

  return fetchVideoRoom(booking.id, booking.doctorId);
};

// ─── Realtime refreshes ──────────────────────────────────────────────────────

/** Fires whenever this patient's appointments change (approval, decline, edits). */
export const subscribeToMyAppointments = async (
  onChange: () => void,
): Promise<() => void> => {
  const user = await requireUser();
  const channel = supabase
    .channel(`my-appointments-${user.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};

/** Fires whenever a new message lands in this patient's inbox. */
export const subscribeToMyMessages = async (onChange: () => void): Promise<() => void> => {
  const user = await requireUser();
  const channel = supabase
    .channel(`my-messages-${user.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `patient_id=eq.${user.id}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};
