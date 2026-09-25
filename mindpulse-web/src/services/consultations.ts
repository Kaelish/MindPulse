import { supabase } from '../supabase/client';
import { requireUserId } from './session';

export interface WebConsultationItem {
  id: string;
  patientId: string;
  patientName: string;
  studentId: string;
  scheduledTime: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  notes?: string;
  avatarInitials: string;
  patientEmail: string;
}

export interface WebChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
}

export interface ManualBookingData {
  patientName: string;
  age: string;
  patientEmail: string;
  notes: string;
  selectedDate: string;
  selectedTime: string;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'PT';

const statusLabel = (status: string): WebConsultationItem['status'] =>
  status === 'completed' ? 'Completed' : status === 'cancelled' ? 'Cancelled' : 'Scheduled';

/** Slot keys ("Aug 31, 2026_3:30 PM") for this doctor's active appointments. */
export const fetchBookedSlotKeys = async (): Promise<Set<string>> => {
  const slotSet = new Set<string>();
  if (!supabase) return slotSet;

  const doctorId = await requireUserId();
  const { data, error } = await supabase
    .from('appointments')
    .select('scheduled_for, status')
    .eq('doctor_id', doctorId)
    .neq('status', 'cancelled');
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
    .select('id, patient_id, scheduled_for, status, notes, created_at')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (appointments ?? []) as {
    id: string;
    patient_id: string;
    scheduled_for: string | null;
    status: string;
    notes: string | null;
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
      notes: row.notes ?? undefined,
      avatarInitials: initialsOf(name),
      patientEmail: profile?.email || 'No email',
    };
  });
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

  const { data: patient, error: patientError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, student_no')
    .ilike('email', booking.patientEmail)
    .maybeSingle();
  if (patientError) throw new Error(patientError.message);
  if (!patient) {
    throw new Error(
      `No MindPulse account matches ${booking.patientEmail}. The patient must register before you can book them.`,
    );
  }

  const scheduledFor = `${booking.selectedDate} at ${booking.selectedTime}`;
  const { data: existing, error: slotError } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('scheduled_for', scheduledFor)
    .neq('status', 'cancelled')
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
    })
    .select('id, patient_id, scheduled_for, status, notes, created_at')
    .single();
  if (insertError) throw new Error(insertError.message);

  const name =
    `${patient.first_name || ''} ${patient.last_name || ''}`.trim() ||
    patient.email ||
    'Unknown patient';
  return {
    id: inserted.id,
    patientId: inserted.patient_id,
    patientName: name,
    studentId: patient.student_no || 'No student no.',
    scheduledTime: inserted.scheduled_for || scheduledFor,
    status: 'Scheduled',
    notes: inserted.notes ?? undefined,
    avatarInitials: initialsOf(name),
    patientEmail: patient.email || booking.patientEmail,
  };
};

export const fetchWebChatMessages = async (
  doctorId: string,
  patientId: string,
): Promise<WebChatMessage[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, text, created_at')
    .eq('clinician_id', doctorId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as { id: string; sender: string; text: string; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      sender: row.sender === 'patient' ? 'patient' : 'doctor',
      text: row.text,
      timestamp: row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now',
    }),
  );
};

export const sendWebChatMessage = async (
  doctorId: string,
  patientId: string,
  text: string,
): Promise<WebChatMessage> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ clinician_id: doctorId, patient_id: patientId, sender: 'doctor', text })
    .select('id, sender, text, created_at')
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    sender: 'doctor',
    text: data.text,
    timestamp: data.created_at
      ? new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now',
  };
};
