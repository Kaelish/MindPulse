import { supabase } from '../supabase/client';
import { requireUser } from './session';

export interface IncomingCall {
  sessionId: string;
  appointmentId: string;
  doctorId: string;
  roomName: string;
  meetingUrl: string;
  startedAt: string | null;
}

/**
 * The only thing on this appointment a patient is allowed to read: the short
 * "Note for the patient" the doctor published. The therapy progress note
 * itself (presenting problem, session content, observations, MSE, risk,
 * clinical impressions, plan, scan) never leaves the doctor's side — patients
 * have no SELECT on consultation_notes at all, and this comes back through
 * the get_patient_consultation_note RPC.
 */
export interface PatientDoctorNote {
  appointmentId: string;
  doctorId: string;
  /** Published note written for the patient. */
  patientNote: string;
  /** Psychologist who signed it, for the signature block. */
  psychologist: string;
  sessionDate: string;
  signature: string | null;
  signedAt: string | null;
  updatedAt: string | null;
}

const toIncomingCall = (row: Record<string, any>): IncomingCall => ({
  sessionId: String(row.id ?? ''),
  appointmentId: String(row.appointment_id ?? ''),
  doctorId: String(row.doctor_id ?? ''),
  roomName: String(row.room_name ?? ''),
  meetingUrl:
    row.meeting_url || (row.room_name ? `https://meet.jit.si/${row.room_name}` : ''),
  startedAt: row.started_at ?? null,
});

export const getActiveIncomingCall = async (): Promise<IncomingCall | null> => {
  try {
    const user = await requireUser();
    const { data, error } = await supabase
      .from('video_sessions')
      .select('id, appointment_id, doctor_id, room_name, meeting_url, started_at, status')
      .eq('patient_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const call = toIncomingCall(data);
    return call.appointmentId ? call : null;
  } catch {
    return null;
  }
};

export const subscribeToIncomingCall = async (
  onChange: (call: IncomingCall, status: string) => void,
): Promise<() => void> => {
  const user = await requireUser();
  const channel = supabase
    .channel(`incoming-call-${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'video_sessions',
        filter: `patient_id=eq.${user.id}`,
      },
      (payload) => {
        const row = payload.new as Record<string, any> | null;
        if (!row) return;
        const status = String(row.status ?? '');
        const call = toIncomingCall(row);
        if (!call.appointmentId) return;
        onChange(call, status);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};

const nameFor = async (userId: string, fallback: string): Promise<string> => {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name')
      .eq('id', userId)
      .maybeSingle();
    const full = (data?.full_name ?? '').trim();
    if (full) return full;
    const joined = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
    if (joined) return joined;
  } catch {
  }
  return fallback;
};

export const fetchCallerDisplayName = (doctorId: string): Promise<string> =>
  nameFor(doctorId, 'Your doctor');

export const declineIncomingCall = async (call: IncomingCall): Promise<void> => {
  try {
    const user = await requireUser();
    const name = await nameFor(user.id, 'The patient');
    const { error } = await supabase.from('notifications').insert({
      user_id: call.doctorId,
      title: 'Call not answered',
      message: `${name} did not answer the video consultation. Start the call again when you are ready.`,
      type: 'appointment',
    });
    void error;
  } catch {
  }
};

// Patient read path for the note: a narrow RPC, not the table. It returns
// patient_note only when the doctor published it — otherwise an empty result.
export const fetchConsultationNote = async (
  appointmentId: string,
): Promise<PatientDoctorNote | null> => {
  if (!appointmentId) return null;
  const { data, error } = await supabase
    .rpc('get_patient_consultation_note', { p_appointment_id: appointmentId })
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, any>;
  return {
    appointmentId: String(row.appointment_id ?? appointmentId),
    doctorId: String(row.doctor_id ?? ''),
    patientNote: String(row.patient_note ?? ''),
    psychologist: String(row.psychologist ?? ''),
    sessionDate: String(row.session_date ?? ''),
    signature: row.signature ?? null,
    signedAt: row.signed_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
};

export const hasConsultationContent = (note: PatientDoctorNote | null): boolean =>
  !!note && (note.patientNote ?? '').trim().length > 0;
