import { useEffect, useState } from 'react';
import { VideoRoom, WebConsultationItem, ensureVideoSession } from '../services/consultations';

interface JitsiCallPanelProps {
  appointment: WebConsultationItem;
  onBack?: () => void;
}

interface WebRtcProbe {
  origin: string;
  /** `undefined` means the browser never reported it — that is NOT "insecure". */
  secure: boolean | undefined;
  hasPeer: boolean;
  hasMedia: boolean;
  /** Only false when we can positively prove the embed will fail. */
  canEmbed: boolean;
}

/**
 * Browsers treat an https iframe as a secure context only when EVERY ancestor
 * is secure too. On a plain http:// origin (LAN IP, hostname, deployed host)
 * meet.jit.si loads inside a non-secure context, `navigator.mediaDevices` is
 * hidden there, and Jitsi serves its own black "WebRTC is not available" page.
 *
 * `isSecureContext === false` is the only thing that counts as insecure: a
 * browser that never implemented it (`undefined`) must not be misreported as
 * broken, or we would hide a perfectly good embed.
 */
const probeWebRtc = (): WebRtcProbe => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { origin: '', secure: undefined, hasPeer: false, hasMedia: false, canEmbed: false };
  }
  const secure = window.isSecureContext;
  const hasPeer =
    typeof (window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection === 'function';
  const hasMedia = Boolean(navigator.mediaDevices);
  return {
    origin: window.location.origin,
    secure,
    hasPeer,
    hasMedia,
    canEmbed: secure !== false && hasPeer && hasMedia,
  };
};

/** One-line readout so a screenshot of a failure is conclusive. */
const probeSummary = (p: WebRtcProbe): string =>
  [
    p.origin || '(unknown origin)',
    `secure context: ${p.secure === undefined ? 'not reported' : p.secure ? 'yes' : 'NO'}`,
    `RTCPeerConnection: ${p.hasPeer ? 'yes' : 'no'}`,
    `mediaDevices: ${p.hasMedia ? 'yes' : 'no'}`,
  ].join('  ·  ');


/**
 * Real Jitsi call for an appointment. Both parties get the same deterministic
 * room (mindpulse-appt-<appointment id>), so they always meet in one place.
 */
export const JitsiCallPanel = ({ appointment, onBack }: JitsiCallPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<VideoRoom | null>(null);
  const [probe, setProbe] = useState<WebRtcProbe | null>(null);

  useEffect(() => {
    setProbe(probeWebRtc());
  }, []);

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
          <div className="call-room-block">
            <div className="call-room">Room: {room.roomName}</div>

            {/* The join action is deliberately first: it works whether or not the
                browser lets us embed the player further down, so the call is
                never out of reach. */}
            <a
              className="primary-button jitsi-tab-link"
              href={room.meetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              {probe && !probe.canEmbed ? 'Join video call (opens in a new tab)' : 'Open meeting in a new tab'}
            </a>

            {probe === null ? (
              <div className="jitsi-frame jitsi-frame-loading">Checking this browser…</div>
            ) : probe.canEmbed ? (
              <iframe
                className="jitsi-frame"
                src={room.meetingUrl}
                title="Jitsi meeting"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
              />
            ) : (
              <div className="jitsi-fallback" role="status">
                <div className="jitsi-fallback-title">The call opens in a new tab from here</div>
                <p className="jitsi-fallback-text">
                  {probe.secure === false
                    ? 'This browser will not hand camera and microphone access to an embedded player on this page, because the page is not a secure context. The room itself is fine — the button above opens it full screen where camera access is allowed.'
                    : 'This browser is blocking WebRTC on this page, so the room cannot be embedded here. The button above opens it full screen instead.'}
                </p>
                <p className="jitsi-fallback-url">{probeSummary(probe)}</p>
              </div>
            )}
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
