import { useState } from 'react';
import { VideoRoom, WebConsultationItem, ensureVideoSession } from '../services/consultations';

interface JitsiCallPanelProps {
  appointment: WebConsultationItem;
  onBack?: () => void;
}

/**
 * Real Jitsi call for an appointment. Both parties get the same deterministic
 * room (mindpulse-appt-<appointment id>), so they always meet in one place.
 */
export const JitsiCallPanel = ({ appointment, onBack }: JitsiCallPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<VideoRoom | null>(null);

  const startCall = async () => {
    try {
      setLoading(true);
      setError(null);
      setRoom(await ensureVideoSession(appointment));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the video call.');
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <div className="panel-header">
      <h2>Video consultation</h2>
      {onBack ? (
        <button type="button" className="text-button" onClick={onBack}>
          Back to chat
        </button>
      ) : null}
    </div>
  );

  if (appointment.rawStatus !== 'confirmed') {
    return (
      <section className="panel call-panel" aria-label="Video consultation">
        {header}
        <div className="call-card">
          <div className="call-main-label">Call locked</div>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
            The video room opens once this appointment is confirmed
            {appointment.rawStatus === 'awaiting_payment'
              ? ' — the patient has not paid the consultation fee yet.'
              : appointment.rawStatus === 'declined'
                ? ' — this booking was declined.'
                : ' — approve the booking and wait for payment first.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel call-panel" aria-label="Video consultation">
      {header}
      <div className="call-card" style={{ width: '100%' }}>
        <div className="call-title-row">
          <div className="call-badge">●</div>
          <div>
            <div className="call-main-label">Live care session</div>
            <div className="call-sub-label">
              {appointment.patientName} · {appointment.scheduledTime}
            </div>
          </div>
        </div>

        {room ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <div className="call-room">Room: {room.roomName}</div>
            <iframe
              className="jitsi-frame"
              src={room.meetingUrl}
              title="Jitsi meeting"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
            />
            <a className="link-button" href={room.meetingUrl} target="_blank" rel="noreferrer">
              Open meeting in a new tab
            </a>
          </div>
        ) : (
          <>
            <div className="call-metric">Ready to connect</div>
            <button
              type="button"
              className="primary-button"
              onClick={() => void startCall()}
              disabled={loading}
            >
              {loading ? 'Starting call…' : 'Start video call'}
            </button>
          </>
        )}

        {error ? <div className="error-inline">{error}</div> : null}
      </div>
    </section>
  );
};
