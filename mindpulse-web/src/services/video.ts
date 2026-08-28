import { supabase } from '../supabase/client';

export type VideoCallStatus = 'pending' | 'live' | 'ended';

export interface VideoCallSession {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  roomName: string;
  meetingUrl: string;
  status: VideoCallStatus;
  createdAt: string;
}

export interface VideoCallResponse {
  data: VideoCallSession | null;
  error: string | null;
  loading: boolean;
}

export const startDoctorVideoSession = async (
  doctorId: string,
  doctorName: string,
  patientId: string,
  patientName: string,
): Promise<VideoCallResponse> => {
  try {
    const roomName = `mindpulse-${doctorId}-${patientId}-${Date.now()}`;
    const baseUrl =
      process.env.REACT_APP_DAILY_BASE_URL ?? 'https://mindpulse.daily.co';
    const token = process.env.REACT_APP_DAILY_TOKEN ?? 'demo-token';

    const session: VideoCallSession = {
      id: `call-${Date.now()}`,
      patientId,
      patientName,
      doctorId,
      doctorName,
      roomName,
      meetingUrl: `${baseUrl}/${roomName}?token=${encodeURIComponent(token)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const hasSupabaseConfig = Boolean(
      process.env.REACT_APP_SUPABASE_URL &&
        process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY,
    );

    if (hasSupabaseConfig && supabase) {
      const { data, error } = await supabase
        .from('video_sessions')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          room_name: roomName,
          meeting_url: session.meetingUrl,
          status: session.status,
        })
        .select()
        .single();

      if (!error && data) {
        session.id = String(data.id);
        session.status = (data.status ?? session.status) as VideoCallStatus;
        session.createdAt = data.created_at ?? session.createdAt;
      }
    }

    return {
      data: session,
      error: null,
      loading: false,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unable to create the consult session.',
      loading: false,
    };
  }
};
