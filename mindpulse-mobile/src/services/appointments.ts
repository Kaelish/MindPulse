import { supabase } from '../supabase/client';
import { requireUser } from './session';
import { loadNotificationPrefs } from './notificationPrefs';
import { fetchAvatarUrls } from './avatars';
import {
  ChatAttachment,
  ChatMessageBase,
  ChatThreadSummary,
  PickedAttachment,
  fetchChatThreads,
  formatThreadTime,
  markThreadRead,
  mapChatRow,
  previewLabelFor,
  uploadChatAttachment,
} from './chat';

export interface TelehealthClinician {
  id: string;
  name: string;
  specialty: string;
  avatar: string;
  /** Profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
  verified: boolean;
  bio: string;
  tags: string[];
  email: string;
  fee: number;
  slots: string[];
  /** Weekday keys ('mon' … 'sun') the doctor accepts bookings on. */
  availableDays: string[];
  /** Specific dates (YYYY-MM-DD) the doctor has blocked as a day off. */
  blockedDates: string[];
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
  /** Doctor's profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
  scheduledFor: string; // "Aug 31, 2026 at 3:30 PM"
  status: AppointmentState;
  declineReason?: string;
  fee: number;
  createdAt: string;
}

export interface ChatMessage extends ChatMessageBase {}

/** One row of the patient's conversation list (Messages tab). */
export interface PatientConversation {
  clinicianId: string;
  clinician: TelehealthClinician | null;
  preview: string;
  lastAt: string;
  unreadCount: number;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const generateRealLifeDates = (): { label: string; dateStr: string }[] => {
  const dates: { label: string; dateStr: string }[] = [];
  const today = new Date();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // 7 days so every weekday shows up even when a doctor only works one day.
  for (let i = 0; i < 7; i++) {
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
  'id, first_name, last_name, full_name, email, doctor_profiles ( specialization, bio, tags, is_verified, consultation_fee, available_slots, available_days, blocked_dates )';

const DEFAULT_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
];

const DEFAULT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Keeps only valid weekday keys, de-duplicated, in canonical order. */
export const normalizeWeekdays = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [...DEFAULT_DAYS];
  const present = new Set(
    raw.map((day) => String(day).trim().toLowerCase()).filter((day) => (WEEKDAY_KEYS as readonly string[]).includes(day)),
  );
  return WEEKDAY_KEYS.filter((day) => present.has(day));
};

/** Parses the display format used everywhere ("Aug 31, 2026") into a local Date. */
export const parseDisplayDate = (dateStr: string): Date | null => {
  const match = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(dateStr.trim());
  if (!match) return null;
  const monthIdx = MONTHS_SHORT.indexOf(
    match[1][0].toUpperCase() + match[1].slice(1, 3).toLowerCase(),
  );
  if (monthIdx < 0) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return null;
  return new Date(year, monthIdx, day);
};

/** Local-time "YYYY-MM-DD" for a Date (never UTC — that would shift the day). */
export const toIsoDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * True when the patient must not be offered this date: the weekday is not one
 * of the doctor's working days or the date is one of their blocked days off.
 * Unparseable dates stay bookable so a format change never locks everyone out.
 */
export const isDateUnavailable = (
  dateStr: string,
  availableDays: string[],
  blockedDates: string[],
): boolean => {
  const date = parseDisplayDate(dateStr);
  if (!date) return false;
  const weekday = WEEKDAY_KEYS[(date.getDay() + 6) % 7];
  if (availableDays.length > 0 && !availableDays.includes(weekday)) return true;
  return blockedDates.includes(toIsoDate(date));
};

const toClinician = (row: any, avatarUrl: string | null = null): TelehealthClinician => {
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
    avatarUrl,
    verified: Boolean(embedded?.is_verified),
    bio: embedded?.bio || 'No bio provided yet.',
    tags: Array.isArray(embedded?.tags) ? embedded.tags : [],
    email: row.email || '',
    fee: embedded?.consultation_fee != null ? Number(embedded.consultation_fee) : 500,
    slots:
      Array.isArray(embedded?.available_slots) && embedded.available_slots.length > 0
        ? embedded.available_slots
        : [...DEFAULT_SLOTS],
    availableDays: normalizeWeekdays(embedded?.available_days),
    blockedDates: Array.isArray(embedded?.blocked_dates)
      ? (embedded.blocked_dates as string[]).map((d) => String(d).trim()).filter(Boolean)
      : [],
  };
};

/** One verified clinician listed under the result screen's "Find Nearby Psych Clinics" card. */
export interface PanelDoctor {
  id: string;
  name: string;
  specialty: string;
  contactNumber: string;
  /** Profile photo; null when unset (or migration 0017 not applied). */
  avatarUrl: string | null;
}

/**
 * Verified doctors a patient can reach out to. RLS already hides unverified
 * `doctor_profiles` rows, but a doctor whose profile embed is filtered out
 * comes back with a null embed — those are dropped explicitly too.
 */
export const fetchDoctorPanel = async (limit = 4): Promise<PanelDoctor[]> => {
  await requireUser();

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, full_name, email, doctor_profiles ( specialization, contact_number, is_verified )',
    )
    .eq('role', 'doctor')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const panel: PanelDoctor[] = [];
  for (const row of (data ?? []) as any[]) {
    const embedded = Array.isArray(row.doctor_profiles) ? row.doctor_profiles[0] : row.doctor_profiles;
    if (!embedded || embedded.is_verified !== true) continue;

    const baseName =
      `${row.full_name || ''}`.trim() ||
      `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
      row.email ||
      'Clinician';
    panel.push({
      id: String(row.id),
      name: /^dr\.?\s/i.test(baseName) ? baseName : `Dr. ${baseName}`,
      specialty: embedded.specialization || 'Mental Health Professional',
      contactNumber: (embedded.contact_number || '').trim(),
      avatarUrl: null,
    });
    if (panel.length >= limit) break;
  }

  const avatars = await fetchAvatarUrls(panel.map((doc) => doc.id));
  for (const doc of panel) doc.avatarUrl = avatars.get(doc.id) ?? null;
  return panel;
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
  const rows = (data ?? []) as any[];
  const avatars = await fetchAvatarUrls(rows.map((row) => String(row.id)));
  return rows.map((row) => toClinician(row, avatars.get(String(row.id)) ?? null));
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
  if (!data) return null;
  const avatars = await fetchAvatarUrls([id]);
  return toClinician(data, avatars.get(id) ?? null);
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

  return Promise.all((data ?? []).map((row: any) => mapChatRow(row)));
};

// The mobile app is the patient app: messages are always sent as the patient.
export const sendChatMessage = async (
  clinicianId: string,
  text: string,
  picked?: PickedAttachment | null,
): Promise<ChatMessage> => {
  const user = await requireUser();

  let stored: { path: string; name: string; kind: ChatAttachment['kind'] } | null = null;
  if (picked) {
    stored = await uploadChatAttachment(user.id, clinicianId, picked);
  }

  const { data: inserted, error } = await supabase
    .from('chat_messages')
    .insert({
      patient_id: user.id,
      clinician_id: clinicianId,
      sender: 'patient',
      text: text || '',
      attachment_url: stored?.path ?? null,
      attachment_name: stored?.name ?? null,
      attachment_kind: stored?.kind ?? null,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Could not send the message. Please try again.');
  }

  return mapChatRow(inserted as any);
};

/**
 * The patient's conversation list: every clinician they have an appointment
 * with or an existing thread with, most recent first, with preview + unread.
 */
export const fetchPatientConversations = async (): Promise<PatientConversation[]> => {
  const user = await requireUser();

  const [{ data: threadRows, error: threadError }, { data: appointmentRows, error: appointmentError }] =
    await Promise.all([
      supabase.rpc('chat_threads'),
      supabase.from('appointments').select('doctor_id').eq('patient_id', user.id),
    ]);
  if (threadError) throw new Error(threadError.message);
  if (appointmentError) throw new Error(appointmentError.message);

  const threads = new Map<string, ChatThreadSummary>();
  for (const raw of (threadRows ?? []) as any[]) {
    threads.set(String(raw.other_id), {
      otherId: String(raw.other_id),
      lastText: raw.last_text || '',
      lastSender: raw.last_sender === 'patient' || raw.last_sender === 'doctor' ? raw.last_sender : null,
      lastAttachmentKind:
        raw.last_attachment_kind === 'image' || raw.last_attachment_kind === 'document'
          ? raw.last_attachment_kind
          : null,
      lastAttachmentName: raw.last_attachment_name ?? null,
      lastAt: raw.last_at,
      unreadCount: Number(raw.unread_count || 0),
    });
  }

  // Appointments without messages still deserve a (empty) conversation row.
  const clinicianIds = new Set<string>(threads.keys());
  for (const row of (appointmentRows ?? []) as { doctor_id: string }[]) {
    clinicianIds.add(String(row.doctor_id));
  }
  if (clinicianIds.size === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(CLINICIAN_SELECT)
    .in('id', [...clinicianIds]);
  if (profilesError) throw new Error(profilesError.message);

  const clinicianRows = (profiles ?? []) as any[];
  const avatars = await fetchAvatarUrls(clinicianRows.map((row) => String(row.id)));
  const cliniciansById = new Map(
    clinicianRows.map((row) => [String(row.id), toClinician(row, avatars.get(String(row.id)) ?? null)]),
  );

  return [...clinicianIds]
    .map((clinicianId): PatientConversation => {
      const thread = threads.get(clinicianId);
      return {
        clinicianId,
        clinician: cliniciansById.get(clinicianId) ?? null,
        preview: thread
          ? previewLabelFor(thread.lastText, thread.lastAttachmentKind, thread.lastAttachmentName)
          : 'No messages yet — say hello.',
        lastAt: thread?.lastAt ?? '',
        unreadCount: thread?.unreadCount ?? 0,
      };
    })
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
};

/** Marks every message received from this clinician as read. */
export const markConversationRead = async (clinicianId: string): Promise<void> => {
  await markThreadRead(clinicianId);
};

export const formatConversationTime = formatThreadTime;

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
  const avatars = await fetchAvatarUrls(doctorIds);

  return rows.map((row) => {
    const doc = doctorById.get(String(row.doctor_id));
    const clinician = doc ? toClinician(doc) : null;
    return {
      id: String(row.id),
      doctorId: String(row.doctor_id),
      doctorName: clinician?.name ?? 'Clinician',
      specialty: clinician?.specialty ?? 'Mental Health Professional',
      avatarUrl: avatars.get(String(row.doctor_id)) ?? null,
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
export interface PayResult {
  /** Shared Jitsi room for the confirmed appointment. */
  roomUrl: string;
  /** Payment reference shown on the receipt (MP-…). */
  reference: string;
}

export const payForAppointment = async (
  booking: MyBooking,
  method: PaymentMethod,
): Promise<PayResult> => {
  const user = await requireUser();
  let reference = '';

  // Idempotency: a retry after a half-failed attempt must not double-charge.
  const { data: prior, error: priorError } = await supabase
    .from('payments')
    .select('id, reference')
    .eq('appointment_id', booking.id)
    .eq('status', 'paid')
    .limit(1);
  if (priorError) throw new Error(priorError.message);

  if (!prior || prior.length === 0) {
    reference = `MP-${Date.now().toString(36).toUpperCase()}-${Math.random()
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
  } else {
    // Already recorded (retry path) — reuse the original reference so the
    // receipt always matches the row in `payments`.
    reference = (prior[0] as { reference: string }).reference ?? '';
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

  return { roomUrl: await fetchVideoRoom(booking.id, booking.doctorId), reference };
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

/** Fires whenever this patient's messages change (new message or read receipt). */
export const subscribeToMyMessages = async (onChange: () => void): Promise<() => void> => {
  const user = await requireUser();
  const channel = supabase
    .channel(`my-messages-${user.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_messages', filter: `patient_id=eq.${user.id}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};
