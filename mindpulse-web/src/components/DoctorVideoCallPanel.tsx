import { useState } from 'react';
import { startDoctorVideoSession } from '../services/video';

interface DoctorVideoCallPanelProps {
  patientId?: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
}

export const DoctorVideoCallPanel = ({
  patientId = 'patient-456',
  patientName = 'Sarah Johnson',
  doctorId = 'doctor-123',
  doctorName = 'Dr. Chen',
}: DoctorVideoCallPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);

  const handleStartCall = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await startDoctorVideoSession(
        doctorId,
        doctorName,
        patientId,
        patientName,
      );

      if (result.error || !result.data) {
        throw new Error(result.error ?? 'Unable to start the doctor video call.');
      }

      setSessionUrl(result.data.meetingUrl);
      setRoomName(result.data.roomName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel call-panel" aria-label="Doctor video call panel">
      <div className="panel-header">
        <h2>Video consultation</h2>
        <button type="button" className="text-button">
          Join queue
        </button>
      </div>

      <div className="call-card">
        <div className="call-title-row">
          <div className="call-badge">●</div>
          <div>
            <div className="call-main-label">Live care session</div>
            <div className="call-sub-label">{patientName}</div>
          </div>
        </div>

        <div className="call-metric">Ready to connect</div>

        {roomName ? (
          <div className="call-room">Room: {roomName}</div>
        ) : null}

        {sessionUrl ? (
          <a className="link-button" href={sessionUrl} target="_blank" rel="noreferrer">
            Open meeting link
          </a>
        ) : (
          <button type="button" className="primary-button" onClick={handleStartCall} disabled={loading}>
            {loading ? 'Starting call...' : 'Start video call'}
          </button>
        )}

        {error ? <div className="error-inline">{error}</div> : null}
      </div>
    </section>
  );
};
