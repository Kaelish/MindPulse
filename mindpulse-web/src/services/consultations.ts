import { supabase } from '../supabase/client';
import { requireUserId } from './session';
import { fetchAvatarUrls } from './avatars';

export type ConsultationMode = 'online' | 'in_person';

/** Human labels for the two ways a session can happen. */
export const CONSULTATION_MODE_LABELS: Record<ConsultationMode, string> = {
  online: 'Online (Video Call)',
  in_person: 'Face-to-Face (In-Clinic)',
};

export const consultationModeLabel = (mode?: string | null): string =>
  mode === 'in_person' ? CONSULTATION_MODE_LABELS.in_person : CONSULTATION_MODE_LABELS.online;

export interface WebConsultationItem {
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
  /** How the session happens — defaults to 'online' for rows booked before 0025. */
  consultationMode: ConsultationMode;
}

export interface DoctorAvailability {
  fee: number;
  slots: string[];
  /** Weekday keys ('mon' … 'sun') this doctor accepts bookings on. */
  days: string[];
  /** Specific dates (YYYY-MM-DD) the doctor has off. */
  blockedDates: string[];
}

/** Canonical weekday keys stored in doctor_profiles.available_days. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const ALL_WEEKDAY_KEYS: string[] = [...WEEKDAY_KEYS];

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_DATE_RE = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/;

/** Keeps only valid weekday keys, de-duplicated, in canonical order. */
export const normalizeWeekdays = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [...ALL_WEEKDAY_KEYS];
  const present = new Set(
    raw.map((day) => String(day).trim().toLowerCase()).filter((day) => (WEEKDAY_KEYS as readonly string[]).includes(day)),
  );
  return WEEKDAY_KEYS.filter((day) => present.has(day));
};

/** Parses the display format used everywhere ("Aug 31, 2026") into a local Date. */
export const parseDisplayDate = (dateStr: string): Date | null => {
  const match = DISPLAY_DATE_RE.exec(dateStr.trim());
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  if (month === undefined) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return null;
  return new Date(year, month, day);
};

/** Local-time "YYYY-MM-DD" for a Date (never UTC — would shift day boundaries). */
export const toIsoDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Weekday key ('mon' … 'sun') for a display date, or null when unparseable. */
export const weekdayKeyFor = (dateStr: string): string | null => {
  const date = parseDisplayDate(dateStr);
  return date ? WEEKDAY_KEYS[(date.getDay() + 6) % 7] : null;
};

/**
 * True when patients must not be offered this date: either the weekday is not
 * a working day or the date is one of the doctor's blocked dates (day off).
 * Unparseable dates are treated as available so a format change never locks
 * everyone out of booking.
 */
export const isDateUnavailable = (
  dateStr: string,
  days: string[],
  blockedDates: string[],
): boolean => {
  const weekday = weekdayKeyFor(dateStr);
  if (weekday && !days.includes(weekday)) return true;
  const date = parseDisplayDate(dateStr);
  if (!date) return false;
  return blockedDates.includes(toIsoDate(date));
};

/**
 * True when the slot's start time has already passed in real time.
 * dateStr uses the display format ("Oct 2, 2026") and time the slot format
 * ("5:30 PM"); unknown formats are treated as bookable so a format change can
 * never lock the doctor out of booking. Mirrors the patient app's isSlotInPast
 * so both sides agree on what counts as a past slot.
 */
export const isSlotInPast = (dateStr: string, time: string, now: Date = new Date()): boolean => {
  const date = parseDisplayDate(dateStr);
  const match = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(time.trim());
  if (!date || !match) return false;

  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') hour += 12;
  const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, Number(match[2]));

  return slotStart.getTime() <= now.getTime();
};

export type PaymentMethod = 'card' | 'gcash' | 'maya';

export interface VideoRoom {
  roomName: string;
  meetingUrl: string;
}

export interface WebChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  attachment: {
    url: string | null;
    name: string;
    kind: 'image' | 'document';
  } | null;
  readAt: string | null;
}

export interface WebThreadSummary {
  otherId: string;
  preview: string;
  lastAt: string;
  unreadCount: number;
}

const CHAT_BUCKET = 'chat-attachments';
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_CACHE_MS = 45 * 60 * 1000; // refresh before the 60 min URL expires

// The doctor portal polls every 1.5s — cache signed URLs so each poll does not
// re-mint a URL for every attachment already on screen.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** Mints a short-lived signed URL for a stored attachment path. */
const signChatAttachment = async (path: string): Promise<string | null> => {
  if (!supabase) return null;

  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  try {
    const { data, error } = await supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_CACHE_MS });
    return data.signedUrl;
  } catch {
    return null;
  }
};

const formatMessageTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

const mapWebChatRow = async (row: {
  id: string;
  sender: string;
  text: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_kind?: string | null;
  read_at?: string | null;
}): Promise<WebChatMessage> => {
  let attachment: WebChatMessage['attachment'] = null;
  if (row.attachment_url) {
    attachment = {
      url: await signChatAttachment(row.attachment_url),
      name: row.attachment_name || 'Attachment',
      kind: row.attachment_kind === 'image' ? 'image' : 'document',
    };
  }

  return {
    id: String(row.id),
    sender: row.sender === 'patient' ? 'patient' : 'doctor',
    text: row.text || '',
    timestamp: formatMessageTime(row.created_at),
    attachment,
    readAt: row.read_at ?? null,
  };
};

export interface ManualBookingData {
  patientName: string;
  age: string;
  patientEmail: string;
  notes: string;
  selectedDate: string;
  selectedTime: string;
  /** How the session happens — defaults to 'online'. */
  consultationMode: ConsultationMode;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'PT';

const statusLabel = (status: string): WebConsultationItem['status'] =>
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

/** Slot keys ("Aug 31, 2026_3:30 PM") for this doctor's active appointments. */
export const fetchBookedSlotKeys = async (): Promise<Set<string>> => {
  const slotSet = new Set<string>();
  if (!supabase) return slotSet;

  const doctorId = await requireUserId();
  const { data, error } = await supabase
    .from('appointments')
    .select('scheduled_for, status')
    .eq('doctor_id', doctorId)
    .in('status', [...ACTIVE_STATUSES]);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { scheduled_for: string | null; status: string }[]) {
    if (!row.scheduled_for) continue;
    const separatorIndex = row.scheduled_for.lastIndexOf(' at ');
    if (separatorIndex === -1) continue;
    const dateStr = row.scheduled_for.slice(0, separatorIndex);
    const timeStr = row.scheduled_for.slice(separatorIndex + 4);
    slotSet.add(`${dateStr}_${timeStr}`);
  }
  return slotSet;
};

/** This doctor's appointments joined against patient profiles. */
export const fetchWebConsultations = async (): Promise<WebConsultationItem[]> => {
  if (!supabase) return [];
  const doctorId = await requireUserId();

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, patient_id, scheduled_for, status, notes, decline_reason, consultation_mode, created_at')
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
    consultation_mode?: string | null;
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
      studentId: profile?.student_no || 'No patient no.',
      scheduledTime: row.scheduled_for || 'No date set',
      status: statusLabel(row.status),
      rawStatus: row.status as WebConsultationItem['rawStatus'],
      declineReason: row.decline_reason ?? undefined,
      notes: row.notes ?? undefined,
      avatarInitials: initialsOf(name),
      avatarUrl: avatars.get(row.patient_id) ?? null,
      patientEmail: profile?.email || 'No email',
      consultationMode: row.consultation_mode === 'in_person' ? 'in_person' : 'online',
    };
  });
};

/** A patient account a walk-in booking will attach to, matched by email. */
export interface PatientAccountMatch {
  id: string;
  name: string;
  email: string;
  studentNo: string | null;
}

/** Escapes LIKE wildcards so "john_doe@…" matches that address, not "johnDoe@…". */
const escapeEmailPattern = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/**
 * Finds the account a walk-in booking attaches to, matched case-insensitively
 * by email. Returns null when no account uses the email — shared by the
 * Step-1 pre-check and the booking itself so both always give the same answer.
 * (appointments.patient_id is a required foreign key, so a booking can only
 * ever point at an account that exists.)
 */
export const findPatientAccountByEmail = async (
  email: string,
): Promise<PatientAccountMatch | null> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const trimmed = email.trim();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no')
    .ilike('email', escapeEmailPattern(trimmed))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    student_no: string | null;
  };
  return {
    id: row.id,
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    email: row.email || trimmed,
    studentNo: row.student_no,
  };
};

/**
 * Books a consultation for an existing MindPulse account (matched by email).
 * Throws when Supabase errors, the account is missing, or the slot is taken.
 */
export const saveDoctorScheduleAppointment = async (
  booking: ManualBookingData,
): Promise<WebConsultationItem> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const doctorId = await requireUserId();

  const patient = await findPatientAccountByEmail(booking.patientEmail);
  if (!patient) {
    throw new Error(
      `No MindPulse account matches ${booking.patientEmail}. The patient must register before you can book them.`,
    );
  }

  // Never book a slot whose start time has already passed (same rule the
  // patient app applies — this is the authority, the UI is only the mirror).
  if (isSlotInPast(booking.selectedDate, booking.selectedTime)) {
    throw new Error('That time slot has already passed. Pick a later one.');
  }

  const scheduledFor = `${booking.selectedDate} at ${booking.selectedTime}`;
  const { data: existing, error: slotError } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('scheduled_for', scheduledFor)
    .in('status', [...ACTIVE_STATUSES])
    .limit(1);
  if (slotError) throw new Error(slotError.message);
  if (existing && existing.length > 0) {
    throw new Error(`That time slot (${scheduledFor}) is already booked.`);
  }

  const noteParts = [
    booking.age ? `Age ${booking.age}.` : null,
    booking.notes || null,
  ].filter(Boolean);
  const notes = noteParts.length ? `Walk-in booking. ${noteParts.join(' ')}` : null;

  const { data: inserted, error: insertError } = await supabase
    .from('appointments')
    .insert({
      patient_id: patient.id,
      doctor_id: doctorId,
      scheduled_for: scheduledFor,
      status: 'scheduled',
      notes,
      consultation_mode: booking.consultationMode === 'in_person' ? 'in_person' : 'online',
    })
    .select('id, patient_id, scheduled_for, status, notes, consultation_mode, created_at')
    .single();
  if (insertError) throw new Error(insertError.message);

  const name = patient.name || patient.email || 'Unknown patient';
  return {
    id: inserted.id,
    patientId: inserted.patient_id,
    patientName: name,
    studentId: patient.studentNo || 'No patient no.',
    scheduledTime: inserted.scheduled_for || scheduledFor,
    status: 'Scheduled',
    rawStatus: 'scheduled',
    notes: inserted.notes ?? undefined,
    avatarInitials: initialsOf(name),
    avatarUrl: null,
    patientEmail: patient.email,
    consultationMode:
      (inserted as { consultation_mode?: string | null }).consultation_mode === 'in_person'
        ? 'in_person'
        : 'online',
  };
};

export const fetchWebChatMessages = async (
  doctorId: string,
  patientId: string,
): Promise<WebChatMessage[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('clinician_id', doctorId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return Promise.all((data ?? []).map((row: any) => mapWebChatRow(row)));
};

export const sendWebChatMessage = async (
  doctorId: string,
  patientId: string,
  text: string,
  picked?: { file: File; name: string; kind: 'image' | 'document' } | null,
): Promise<WebChatMessage> => {
  if (!supabase) throw new Error('Supabase is not configured.');

  let stored: { path: string; name: string; kind: 'image' | 'document' } | null = null;
  if (picked) {
    const path = `${patientId}/${doctorId}/${Date.now()}_${picked.name.replace(/[^\w.-]+/g, '_').slice(-80)}`;
    const { error: uploadError } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(path, picked.file, { contentType: picked.file.type || 'application/octet-stream', upsert: false });
    if (uploadError) throw new Error(uploadError.message || 'The file could not be uploaded.');
    stored = { path, name: picked.name, kind: picked.kind };
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

  return mapWebChatRow(data as any);
};

/** Preview + unread badge for each of the doctor's conversations. */
export const fetchWebChatThreads = async (): Promise<WebThreadSummary[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('chat_threads');
  if (error) throw new Error(error.message);

  return ((data ?? []) as {
    other_id: string;
    last_text: string | null;
    last_attachment_kind: string | null;
    last_attachment_name: string | null;
    last_at: string;
    unread_count: number;
  }[]).map((row) => {
    const text = (row.last_text || '').trim();
    const preview = text
      ? text
      : row.last_attachment_kind === 'image'
        ? '📷 Photo'
        : row.last_attachment_kind === 'document'
          ? `📎 ${row.last_attachment_name || 'Document'}`
          : 'No messages yet — say hello.';
    return {
      otherId: String(row.other_id),
      preview,
      lastAt: row.last_at,
      unreadCount: Number(row.unread_count || 0),
    };
  });
};

/** Marks every message received from this patient as read (best effort). */
export const markWebThreadRead = async (patientId: string): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.rpc('mark_chat_read', { p_other: patientId });
  void error; // receipts are cosmetic — never block the conversation
};

/** Best-effort notification row — a failed notice never blocks the workflow. */
const notifyAppointment = async (
  userId: string,
  title: string,
  message: string,
): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, title, message, type: 'appointment' });
  void error;
};

/** Doctor approves the booking; the patient must then pay to confirm it. */
export const approveAppointment = async (item: WebConsultationItem): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
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
export const declineAppointment = async (
  item: WebConsultationItem,
  reason: string,
): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
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
  item: WebConsultationItem,
  dateStr: string,
  timeStr: string,
): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured.');
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

  await notifyAppointment(
    item.patientId,
    'Appointment Rescheduled',
    `Your session was moved to ${scheduledFor}.`,
  );
  return scheduledFor;
};

const DEFAULT_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
];

/** This doctor's consultation fee, offered time slots and working days. */
export const fetchDoctorAvailability = async (): Promise<DoctorAvailability> => {
  if (!supabase) return { fee: 500, slots: [...DEFAULT_SLOTS], days: [...ALL_WEEKDAY_KEYS], blockedDates: [] };
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
      ? (data!.blocked_dates as string[]).map((d) => String(d).trim()).filter((d) => ISO_DATE_RE.test(d))
      : [],
  };
};

/** Doctor updates their fee, offered slots and availability; the mobile booking grid reads all four. */
export const saveDoctorAvailability = async (availability: DoctorAvailability): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const doctorId = await requireUserId();
  const fee = Number(availability.fee);
  if (!Number.isFinite(fee) || fee < 0) throw new Error('Enter a valid consultation fee.');
  const slots = availability.slots.map((slot) => slot.trim()).filter(Boolean);
  if (slots.length === 0) throw new Error('Offer at least one time slot.');
  const days = normalizeWeekdays(availability.days);
  if (days.length === 0) throw new Error('Pick at least one working day.');
  const blockedDates = Array.from(
    new Set(
      (availability.blockedDates ?? [])
        .map((date) => String(date).trim())
        .filter((date) => ISO_DATE_RE.test(date)),
    ),
  ).sort();

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

/**
 * Deterministic Jitsi room per appointment — both sides compute the same URL,
 * so the patient and the doctor always meet in the same room.
 */
export const ensureVideoSession = async (item: WebConsultationItem): Promise<VideoRoom> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const doctorId = await requireUserId();
  const roomName = `mindpulse-appt-${item.id}`;
  const meetingUrl = `https://meet.jit.si/${roomName}`;

  const { data: existing, error: lookupError } = await supabase
    .from('video_sessions')
    .select('room_name, meeting_url')
    .eq('appointment_id', item.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing?.room_name) {
    return {
      roomName: existing.room_name,
      meetingUrl: existing.meeting_url || `https://meet.jit.si/${existing.room_name}`,
    };
  }

  const { error } = await supabase.from('video_sessions').insert({
    patient_id: item.patientId,
    doctor_id: doctorId,
    appointment_id: item.id,
    room_name: roomName,
    meeting_url: meetingUrl,
    status: 'pending',
  });
  if (error) {
    const { data: again } = await supabase
      .from('video_sessions')
      .select('room_name, meeting_url')
      .eq('appointment_id', item.id)
      .maybeSingle();
    if (again?.room_name) {
      return {
        roomName: again.room_name,
        meetingUrl: again.meeting_url || `https://meet.jit.si/${again.room_name}`,
      };
    }
    throw new Error(error.message);
  }

  return { roomName, meetingUrl };
};

export interface ConsultationNote {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  /** Legacy roll-up fields — kept in sync on save so old readers keep working. */
  summary: string;
  observations: string;
  recommendation: string;
  followUp: string | null;
  /** Therapy progress note — header. */
  sessionDate: string;
  sessionLocation: string;
  durationMinutes: number | null;
  clientName: string;
  clientDob: string;
  psychologist: string;
  /** Therapy progress note — sections. */
  presentingProblem: string;
  sessionContent: string;
  interventions: string;
  clientResponse: string;
  therapistObservations: string;
  mentalStatusExam: string;
  riskAssessment: string;
  diagnosticImpressions: string;
  planNextSession: string;
  returnToClinic: string;
  /** Drawn signature (data URL) + scanned handwritten note attachment. */
  signature: string | null;
  signedAt: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  /**
   * The one part of this record the patient may ever read: a short general
   * note written for them. Published only when patientNotePublished is true,
   * and read through get_patient_consultation_note() — never from this row.
   */
  patientNote: string;
  patientNotePublished: boolean;
  /** Legacy flag from before the note became doctor-only. Kept for old rows. */
  sharedWithPatient: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const NOTE_COLUMNS =
  'appointment_id, doctor_id, patient_id, summary, observations, recommendation, follow_up, ' +
  'session_date, session_location, duration_minutes, client_name, client_dob, psychologist, ' +
  'presenting_problem, session_content, interventions, client_response, therapist_observations, ' +
  'mental_status_exam, risk_assessment, diagnostic_impressions, plan_next_session, return_to_clinic, ' +
  'signature, signed_at, attachment_path, attachment_name, patient_note, patient_note_published, ' +
  'shared_with_patient, created_at, updated_at';

type ConsultationNoteRow = {
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  summary: string | null;
  observations: string | null;
  recommendation: string | null;
  follow_up: string | null;
  session_date: string | null;
  session_location: string | null;
  duration_minutes: number | null;
  client_name: string | null;
  client_dob: string | null;
  psychologist: string | null;
  presenting_problem: string | null;
  session_content: string | null;
  interventions: string | null;
  client_response: string | null;
  therapist_observations: string | null;
  mental_status_exam: string | null;
  risk_assessment: string | null;
  diagnostic_impressions: string | null;
  plan_next_session: string | null;
  return_to_clinic: string | null;
  signature: string | null;
  signed_at: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  patient_note: string | null;
  patient_note_published: boolean | null;
  shared_with_patient: boolean | null;
  created_at?: string;
  updated_at?: string | null;
};

const mapConsultationNoteRow = (row: ConsultationNoteRow): ConsultationNote => ({
  appointmentId: row.appointment_id,
  doctorId: row.doctor_id,
  patientId: row.patient_id,
  summary: row.summary ?? '',
  observations: row.observations ?? '',
  recommendation: row.recommendation ?? '',
  followUp: row.follow_up ?? null,
  sessionDate: row.session_date ?? '',
  sessionLocation: row.session_location ?? 'Virtual (Teleconsultation)',
  durationMinutes: row.duration_minutes ?? null,
  clientName: row.client_name ?? '',
  clientDob: row.client_dob ?? '',
  psychologist: row.psychologist ?? '',
  presentingProblem: row.presenting_problem ?? '',
  sessionContent: row.session_content ?? '',
  interventions: row.interventions ?? '',
  clientResponse: row.client_response ?? '',
  therapistObservations: row.therapist_observations ?? '',
  mentalStatusExam: row.mental_status_exam ?? '',
  riskAssessment: row.risk_assessment ?? '',
  diagnosticImpressions: row.diagnostic_impressions ?? '',
  planNextSession: row.plan_next_session ?? '',
  returnToClinic: row.return_to_clinic ?? '',
  signature: row.signature ?? null,
  signedAt: row.signed_at ?? null,
  attachmentPath: row.attachment_path ?? null,
  attachmentName: row.attachment_name ?? null,
  patientNote: row.patient_note ?? '',
  patientNotePublished: !!row.patient_note_published,
  sharedWithPatient: !!row.shared_with_patient,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? undefined,
});

/** True when a therapy-progress-note row (or a legacy row) has any content. */
export const consultationNoteHasContent = (
  note: Pick<
    ConsultationNote,
    | 'summary'
    | 'observations'
    | 'recommendation'
    | 'followUp'
    | 'presentingProblem'
    | 'sessionContent'
    | 'interventions'
    | 'clientResponse'
    | 'therapistObservations'
    | 'mentalStatusExam'
    | 'riskAssessment'
    | 'diagnosticImpressions'
    | 'planNextSession'
    | 'returnToClinic'
  > | null,
): boolean =>
  !!note &&
  [
    note.presentingProblem,
    note.sessionContent,
    note.interventions,
    note.clientResponse,
    note.therapistObservations,
    note.mentalStatusExam,
    note.riskAssessment,
    note.diagnosticImpressions,
    note.planNextSession,
    note.returnToClinic,
    note.summary,
    note.observations,
    note.recommendation,
    note.followUp,
  ].some((part) => (part ?? '').trim().length > 0);

/** Consultation duration in whole minutes, from the video session timestamps. */
export const fetchConsultationDurationMinutes = async (
  appointmentId: string,
): Promise<number | null> => {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('video_sessions')
      .select('started_at, ended_at')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.started_at) return null;
    const start = new Date(data.started_at).getTime();
    const end = data.ended_at ? new Date(data.ended_at).getTime() : Date.now();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return Math.max(1, Math.round((end - start) / 60000));
  } catch {
    return null;
  }
};

/** Signed-in doctor's display name, used to prefill the note header. */
export const fetchCurrentDoctorDisplayName = async (): Promise<string> => {
  if (!supabase) return '';
  try {
    const doctorId = await requireUserId();
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name')
      .eq('id', doctorId)
      .maybeSingle();
    const full = (data?.full_name ?? '').trim();
    if (full) return full;
    return [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
  } catch {
    return '';
  }
};

const CONSULTATION_DOCS_BUCKET = 'consultation-docs';
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Uploads a scanned/photographed handwritten note; returns the storage path. */
export const uploadConsultationAttachment = async (
  item: WebConsultationItem,
  file: File,
): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('That file is larger than 15 MB. Please attach a smaller scan or photo.');
  }
  const doctorId = await requireUserId();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = `${item.patientId}/${doctorId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from(CONSULTATION_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return path;
};

const ATTACHMENT_URL_TTL_SECONDS = 600;

/** Best-effort delete of an uploaded scan (used when the doctor removes it). */
export const removeConsultationAttachment = async (storagePath: string): Promise<void> => {
  if (!supabase || !storagePath) return;
  try {
    await supabase.storage.from(CONSULTATION_DOCS_BUCKET).remove([storagePath]);
  } catch {
    /* the row no longer references it — orphan cleanup is not critical */
  }
};

export const createConsultationAttachmentUrl = async (storagePath: string): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage
    .from(CONSULTATION_DOCS_BUCKET)
    .createSignedUrl(storagePath, ATTACHMENT_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open the attachment.');
  return data.signedUrl;
};

/**
 * Flip the publication of the doctor's "Note for the patient". Only this one
 * field ever becomes readable by the patient (through the
 * get_patient_consultation_note RPC) — the progress note itself stays private
 * to the doctor and the clinic administrators. Publishing notifies the
 * patient; taking it back down sends nothing.
 * Returns the refreshed note so callers can update local state.
 */
export const setPatientNotePublication = async (
  appointmentId: string,
  published: boolean,
): Promise<ConsultationNote> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('consultation_notes')
    .update({ patient_note_published: published, updated_at: new Date().toISOString() })
    .eq('appointment_id', appointmentId)
    .select(NOTE_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'The publication setting could not be saved.');

  if (published) {
    const row = data as unknown as ConsultationNoteRow;
    const noticeError = await supabase.from('notifications').insert({
      user_id: row.patient_id,
      title: 'A note from your doctor',
      message: 'Your doctor has published a note for you. Open the booking to read it.',
      type: 'appointment',
    });
    void noticeError;
  }

  return mapConsultationNoteRow(data as unknown as ConsultationNoteRow);
};

export const startVideoConsultation = async (item: WebConsultationItem): Promise<VideoRoom> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const room = await ensureVideoSession(item);

  const { error: statusError } = await supabase
    .from('video_sessions')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('appointment_id', item.id)
    .neq('status', 'ended');
  if (statusError) throw new Error(statusError.message);

  const { error: noticeError } = await supabase.from('notifications').insert({
    user_id: item.patientId,
    title: 'Your doctor is calling',
    message: 'The doctor has started your video consultation. Tap Join now to enter the room.',
    type: 'appointment',
  });
  void noticeError;

  return room;
};

export const endVideoConsultation = async (item: WebConsultationItem): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('end_video_consultation', {
    p_appointment_id: item.id,
  });
  if (error) throw new Error(error.message);
};

export const fetchConsultationNote = async (appointmentId: string): Promise<ConsultationNote | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('consultation_notes')
    .select(NOTE_COLUMNS)
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapConsultationNoteRow(data as unknown as ConsultationNoteRow);
};

export interface ConsultationNoteDraft {
  /** Therapy progress note — header. */
  sessionDate: string;
  sessionLocation: string;
  durationMinutes: number | null;
  clientName: string;
  clientDob: string;
  psychologist: string;
  /** Sections. */
  presentingProblem: string;
  sessionContent: string;
  interventions: string;
  clientResponse: string;
  therapistObservations: string;
  mentalStatusExam: string;
  riskAssessment: string;
  diagnosticImpressions: string;
  planNextSession: string;
  returnToClinic: string;
  /** Drawn signature data URL and/or scanned-note attachment path. */
  signature: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  /** The short general note written FOR the patient (never the progress note). */
  patientNote: string;
  /** FALSE (default) = draft, doctor-only. TRUE = the patient may read it. */
  patientNotePublished: boolean;
}

export const fetchDoctorConsultationNotes = async (): Promise<ConsultationNote[]> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  await requireUserId();
  const { data, error } = await supabase
    .from('consultation_notes')
    .select(NOTE_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ConsultationNoteRow[]).map(mapConsultationNoteRow);
};

export const saveConsultationNote = async (
  item: WebConsultationItem,
  draft: ConsultationNoteDraft,
): Promise<ConsultationNote> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const doctorId = await requireUserId();
  const trim = (value: string | null | undefined) => (value ?? '').trim();
  const presentingProblem = trim(draft.presentingProblem);
  const sessionContent = trim(draft.sessionContent);
  const patientNote = trim(draft.patientNote);

  // Publication state before this save — used to notify the patient only when
  // the note is published for the first time, not on every edit.
  const { data: prior } = await supabase
    .from('consultation_notes')
    .select('patient_note_published')
    .eq('appointment_id', item.id)
    .maybeSingle();
  const wasPublished = !!prior?.patient_note_published;

  // Legacy roll-ups: keep the old 4 columns meaningful for readers that have
  // not been migrated yet (admin records, older clients).
  const legacySummary = [presentingProblem, sessionContent].filter(Boolean).join('\n\n');

  const payload = {
    appointment_id: item.id,
    doctor_id: doctorId,
    patient_id: item.patientId,
    summary: legacySummary,
    observations: trim(draft.therapistObservations),
    recommendation: trim(draft.planNextSession),
    follow_up: trim(draft.returnToClinic) || null,
    session_date: trim(draft.sessionDate),
    session_location: trim(draft.sessionLocation) || 'Virtual (Teleconsultation)',
    duration_minutes: draft.durationMinutes,
    client_name: trim(draft.clientName) || item.patientName,
    client_dob: trim(draft.clientDob),
    psychologist: trim(draft.psychologist),
    presenting_problem: presentingProblem,
    session_content: sessionContent,
    interventions: trim(draft.interventions),
    client_response: trim(draft.clientResponse),
    therapist_observations: trim(draft.therapistObservations),
    mental_status_exam: trim(draft.mentalStatusExam),
    risk_assessment: trim(draft.riskAssessment),
    diagnostic_impressions: trim(draft.diagnosticImpressions),
    plan_next_session: trim(draft.planNextSession),
    return_to_clinic: trim(draft.returnToClinic),
    signature: draft.signature,
    signed_at: draft.signature ? new Date().toISOString() : null,
    attachment_path: draft.attachmentPath,
    attachment_name: draft.attachmentName,
    patient_note: patientNote,
    patient_note_published: !!draft.patientNotePublished && patientNote.length > 0,
    shared_with_patient: false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('consultation_notes')
    .upsert(payload, { onConflict: 'appointment_id' })
    .select(NOTE_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'The note could not be saved.');
  const note = mapConsultationNoteRow(data as unknown as ConsultationNoteRow);
  if (note.patientNotePublished && !wasPublished) {
    const noticeError = await supabase.from('notifications').insert({
      user_id: item.patientId,
      title: 'A note from your doctor',
      message: 'Your doctor has published a note for you. Open the booking to read it.',
      type: 'appointment',
    });
    void noticeError;
  }
  return note;
};
