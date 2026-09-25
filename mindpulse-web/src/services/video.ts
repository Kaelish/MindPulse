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
    const baseUrl = process.env.REACT_APP_DAILY_BASE_URL;
    const token = process.env.REACT_APP_DAILY_TOKEN;
    if (!baseUrl || !token) {
      throw new Error(
        'Video calling is not configured. Set REACT_APP_DAILY_BASE_URL and REACT_APP_DAILY_TOKEN in .env.',
      );
    }
    if (!supabase) {
      throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY.');
    }

    const roomName = `mindpulse-${doctorId.slice(0, 8)}-${patientId.slice(0, 8)}-${Date.now()}`;
    const meetingUrl = `${baseUrl}/${roomName}?token=${encodeURIComponent(token)}`;

    const { data, error } = await supabase
      .from('video_sessions')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        room_name: roomName,
        meeting_url: meetingUrl,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const session: VideoCallSession = {
      id: String(data.id),
      patientId,
      patientName,
      doctorId,
      doctorName,
      roomName: data.room_name ?? roomName,
      meetingUrl: data.meeting_url ?? meetingUrl,
      status: (data.status ?? 'pending') as VideoCallStatus,
      createdAt: data.created_at ?? new Date().toISOString(),
    };

    return { data: session, error: null, loading: false };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unable to create the consult session.',
      loading: false,
    };
  }
};
