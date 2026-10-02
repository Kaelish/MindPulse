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

export interface StudentConsultationNote {
  appointmentId: string;
  doctorId: string;
  summary: string;
  observations: string;
  recommendation: string;
  followUp: string | null;
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
    const name = await nameFor(user.id, 'The student');
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

export const fetchConsultationNote = async (
  appointmentId: string,
): Promise<StudentConsultationNote | null> => {
  if (!appointmentId) return null;
  const { data, error } = await supabase
    .from('consultation_notes')
    .select(
      'appointment_id, doctor_id, summary, observations, recommendation, follow_up, updated_at',
    )
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    appointmentId: data.appointment_id,
    doctorId: data.doctor_id,
    summary: data.summary ?? '',
    observations: data.observations ?? '',
    recommendation: data.recommendation ?? '',
    followUp: data.follow_up ?? null,
    updatedAt: data.updated_at ?? null,
  };
};

export const hasConsultationContent = (note: StudentConsultationNote | null): boolean =>
  !!note &&
  [note.summary, note.observations, note.recommendation, note.followUp].some((part) =>
    (part ?? '').trim().length > 0,
  );
