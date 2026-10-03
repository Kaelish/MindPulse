import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { normalizeWeekdays } from './appointments';
import { fetchAvatarUrls } from './avatars';
import {
  ChatAttachment,
  ChatMessageBase,
  ChatThreadSummary,
  PickedAttachment,
  fetchChatThreads,
  markThreadRead,
  mapChatRow,
  uploadChatAttachment,
} from './chat';

export interface DoctorConsultation {
  id: string;
  patientId: string;
  patientName: string;
  studentId: string;
  scheduledTime: string;
  status: 'Scheduled' | 'Awaiting Payment' | 'Declined' | 'Confirmed' | 'Completed' | 'Cancelled';
  rawStatus: 'scheduled' | 'awaiting_payment' | 'declined' | 'confirmed' | 'completed' | 'cancelled';
  declineReason?: string;
  notes?: string;
  avatarInitials: string;
  /** Patient's profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
  patientEmail: string;
}

export interface DoctorAvailability {
  fee: number;
  slots: string[];
  /** Weekday keys ('mon' … 'sun') this doctor accepts bookings on. */
  days: string[];
  /** Specific dates (YYYY-MM-DD) blocked as a day off. */
  blockedDates: string[];
}

export interface DoctorChatMessage extends ChatMessageBase {}

export interface DoctorCallBooking {
  id: string;
  counterpartName: string;
  counterpartId: string;
  specialtyLabel: string;
  scheduledFor: string;
  status: 'scheduled' | 'awaiting_payment' | 'declined' | 'confirmed' | 'completed' | 'cancelled';
  declineReason?: string;
  fee: number;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'PT';

const statusLabel = (status: string): DoctorConsultation['status'] =>
  status === 'awaiting_payment'
    ? 'Awaiting Payment'
    : status === 'declined'
      ? 'Declined'
      : status === 'confirmed'
        ? 'Confirmed'
        : status === 'completed'
          ? 'Completed'
          : status === 'cancelled'
            ? 'Cancelled'
            : 'Scheduled';

/** Statuses that still hold the time slot for this doctor. */
const ACTIVE_STATUSES = ['scheduled', 'awaiting_payment', 'confirmed', 'completed'] as const;

const DEFAULT_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
];

/** Best-effort notification row — a failed notice never blocks the workflow. */
const notifyAppointment = async (userId: string, title: string, message: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, title, message, type: 'appointment' });
  void error;
};

/** This doctor's appointments joined against patient profiles. */
export const fetchDoctorConsultations = async (): Promise<DoctorConsultation[]> => {
  const doctorId = await requireUserId();

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, patient_id, scheduled_for, status, notes, decline_reason, created_at')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (appointments ?? []) as {
    id: string;
    patient_id: string;
    scheduled_for: string | null;
    status: string;
    notes: string | null;
    decline_reason: string | null;
  }[];
  if (!rows.length) return [];

  const patientIds = Array.from(new Set(rows.map((row) => row.patient_id)));
  const { data: patientProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no')
    .in('id', patientIds);
  if (profilesError) throw new Error(profilesError.message);

  const byId = new Map(
    ((patientProfiles ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      student_no: string | null;
    }[]).map((profile) => [profile.id, profile]),
  );
  const avatars = await fetchAvatarUrls(patientIds);

  return rows.map((row) => {
    const profile = byId.get(row.patient_id);
    const name = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown patient'
      : 'Unknown patient';
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: name,
      studentId: profile?.student_no || 'No student no.',
      scheduledTime: row.scheduled_for || 'No date set',
      status: statusLabel(row.status),
      rawStatus: row.status as DoctorConsultation['rawStatus'],
      declineReason: row.decline_reason ?? undefined,
      notes: row.notes ?? undefined,
      avatarInitials: initialsOf(name),
      avatarUrl: avatars.get(row.patient_id) ?? null,
      patientEmail: profile?.email || 'No email',
    };
  });
};

/** Doctor approves the booking; the patient must then pay to confirm it. */
export const approveAppointment = async (item: DoctorConsultation): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'awaiting_payment' })
    .eq('id', item.id)
    .eq('status', 'scheduled');
  if (error) throw new Error(error.message);

  await notifyAppointment(
    item.patientId,
    'Appointment Approved',
    `Your session on ${item.scheduledTime} was approved. Pay the consultation fee to confirm it.`,
  );
};

/** Doctor declines the booking — a reason is required (enforced here and in the DB). */
export const declineAppointment = async (item: DoctorConsultation, reason: string): Promise<void> => {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('A reason is required when declining an appointment.');

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'declined', decline_reason: trimmed })
    .eq('id', item.id)
    .eq('status', 'scheduled');
  if (error) throw new Error(error.message);

  await notifyAppointment(
    item.patientId,
    'Appointment Declined',
    `Your session on ${item.scheduledTime} was declined: ${trimmed}`,
  );
};

/** Doctor moves an appointment to a different date/time; the payment stands. */
export const editAppointmentTime = async (
  item: DoctorConsultation,
  dateStr: string,
  timeStr: string,
): Promise<string> => {
  const doctorId = await requireUserId();
  const scheduledFor = `${dateStr} at ${timeStr}`;

  const { data: existing, error: slotError } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('scheduled_for', scheduledFor)
    .in('status', [...ACTIVE_STATUSES])
    .neq('id', item.id)
    .limit(1);
  if (slotError) throw new Error(slotError.message);
  if (existing && existing.length > 0) {
    throw new Error(`That time slot (${scheduledFor}) is already booked.`);
  }

  const { error } = await supabase
    .from('appointments')
    .update({ scheduled_for: scheduledFor })
    .eq('id', item.id);
  if (error) throw new Error(error.message);

  await notifyAppointment(item.patientId, 'Appointment Rescheduled', `Your session was moved to ${scheduledFor}.`);
  return scheduledFor;
};

/** This doctor's consultation fee, offered time slots, and availability. */
export const fetchDoctorAvailability = async (): Promise<DoctorAvailability> => {
  const doctorId = await requireUserId();

  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('consultation_fee, available_slots, available_days, blocked_dates')
    .eq('user_id', doctorId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    fee: data?.consultation_fee != null ? Number(data.consultation_fee) : 500,
    slots:
      Array.isArray(data?.available_slots) && (data!.available_slots as string[]).length > 0
        ? (data!.available_slots as string[])
        : [...DEFAULT_SLOTS],
    days: normalizeWeekdays(data?.available_days),
    blockedDates: Array.isArray(data?.blocked_dates)
      ? (data!.blocked_dates as string[]).map((d) => String(d).trim()).filter(Boolean)
      : [],
  };
};

/** Doctor updates fee, slots, working days, and days off; patients read all four. */
export const saveDoctorAvailability = async (availability: DoctorAvailability): Promise<void> => {
  const doctorId = await requireUserId();
  const fee = Number(availability.fee);
  if (!Number.isFinite(fee) || fee < 0) throw new Error('Enter a valid consultation fee.');
  const slots = availability.slots.map((slot) => slot.trim()).filter(Boolean);
  if (slots.length === 0) throw new Error('Offer at least one time slot.');

  const days = normalizeWeekdays(availability.days);
  if (days.length === 0) throw new Error('Keep at least one working day.');
  const blockedDates = (availability.blockedDates ?? [])
    .map((date) => date.trim())
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));

  const { data: existing, error: lookupError } = await supabase
    .from('doctor_profiles')
    .select('user_id')
    .eq('user_id', doctorId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const payload = {
    consultation_fee: fee,
    available_slots: slots,
    available_days: days,
    blocked_dates: blockedDates,
  };
  const { error } = existing
    ? await supabase.from('doctor_profiles').update(payload).eq('user_id', doctorId)
    : await supabase.from('doctor_profiles').insert({ user_id: doctorId, ...payload });
  if (error) throw new Error(error.message);
};

// ─── Doctor-side messaging ────────────────────────────────────────────────────

/** Per-patient preview + unread counts for the Messages tab list. */
export const fetchDoctorChatThreads = async (): Promise<Map<string, ChatThreadSummary>> => {
  const threads = await fetchChatThreads();
  return new Map(threads.map((thread) => [thread.otherId, thread]));
};

export const fetchDoctorChatMessages = async (patientId: string): Promise<DoctorChatMessage[]> => {
  const doctorId = await requireUserId();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('clinician_id', doctorId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return Promise.all((data ?? []).map((row: any) => mapChatRow(row)));
};

export const sendDoctorChatMessage = async (
  patientId: string,
  text: string,
  picked?: PickedAttachment | null,
): Promise<DoctorChatMessage> => {
  const doctorId = await requireUserId();

  let stored: { path: string; name: string; kind: ChatAttachment['kind'] } | null = null;
  if (picked) {
    stored = await uploadChatAttachment(patientId, doctorId, picked);
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      clinician_id: doctorId,
      patient_id: patientId,
      sender: 'doctor',
      text: text || '',
      attachment_url: stored?.path ?? null,
      attachment_name: stored?.name ?? null,
      attachment_kind: stored?.kind ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  return mapChatRow(data as any);
};

/** Marks every message received from this patient as read. */
export const markDoctorThreadRead = async (patientId: string): Promise<void> => {
  await markThreadRead(patientId);
};

// ─── Video call lobby data ────────────────────────────────────────────────────

/**
 * Everything the mobile call lobby needs when the signed-in DOCTOR joins:
 * the appointment, the patient's display name, and the doctor's own fee.
 */
export const fetchDoctorCallBooking = async (appointmentId: string): Promise<DoctorCallBooking> => {
  const doctorId = await requireUserId();

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, scheduled_for, status, decline_reason')
    .eq('id', appointmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!appointment) throw new Error('No appointment found for this call.');

  const [{ data: patient }, { data: doctorProfile }] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', appointment.patient_id)
      .maybeSingle(),
    supabase
      .from('doctor_profiles')
      .select('specialization, consultation_fee')
      .eq('user_id', doctorId)
      .maybeSingle(),
  ]);

  const patientName = patient
    ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.email || 'Unknown patient'
    : 'Unknown patient';

  return {
    id: String(appointment.id),
    counterpartId: String(appointment.patient_id),
    counterpartName: patientName,
    specialtyLabel: doctorProfile?.specialization || 'Telehealth Consultation',
    scheduledFor: String(appointment.scheduled_for || ''),
    status: appointment.status as DoctorCallBooking['status'],
    declineReason: appointment.decline_reason ?? undefined,
    fee: doctorProfile?.consultation_fee != null ? Number(doctorProfile.consultation_fee) : 500,
  };
};

/**
 * Deterministic Jitsi room per appointment — both sides compute the same URL,
 * so the patient and the doctor always meet in the same room.
 */
export const getDoctorVideoRoomUrl = async (booking: DoctorCallBooking): Promise<string> => {
  const doctorId = await requireUserId();
  const roomName = `mindpulse-appt-${booking.id}`;
  const meetingUrl = `https://meet.jit.si/${roomName}`;

  const { data: existing, error: lookupError } = await supabase
    .from('video_sessions')
    .select('room_name, meeting_url')
    .eq('appointment_id', booking.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.meeting_url || existing?.room_name) {
    return existing.meeting_url || `https://meet.jit.si/${existing.room_name}`;
  }

  const { error } = await supabase.from('video_sessions').insert({
    patient_id: booking.counterpartId,
    doctor_id: doctorId,
    appointment_id: booking.id,
    room_name: roomName,
    meeting_url: meetingUrl,
    status: 'pending',
  });
  if (error) {
    const { data: again } = await supabase
      .from('video_sessions')
      .select('room_name, meeting_url')
      .eq('appointment_id', booking.id)
      .maybeSingle();
    if (again?.meeting_url || again?.room_name) {
      return again.meeting_url || `https://meet.jit.si/${again.room_name}`;
    }
    throw new Error(error.message);
  }
  return meetingUrl;
};

// ─── Realtime refreshes (doctor side) ────────────────────────────────────────

/** Fires whenever any of this doctor's appointments change (bookings, payments, edits). */
export const subscribeToDoctorAppointments = async (onChange: () => void): Promise<() => void> => {
  const doctorId = await requireUserId();
  const channel = supabase
    .channel(`doctor-appointments-${doctorId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};

/** Fires whenever this doctor's messages change (new message or read receipt). */
export const subscribeToDoctorMessages = async (onChange: () => void): Promise<() => void> => {
  const doctorId = await requireUserId();
  const channel = supabase
    .channel(`doctor-messages-${doctorId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_messages', filter: `clinician_id=eq.${doctorId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};
