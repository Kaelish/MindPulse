import React, { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import {
  ProfileSessionsState,
  ProfileLoginSession,
  revokeOtherProfileSessions,
  revokeProfileSession,
  signOutCurrentDevice,
  subscribeProfileSessions,
} from '../services/profileSessions';
import {
  activeVerificationMethod,
  challengeFactor,
  disableVerification,
  destinationError,
  enrollTotp,
  markContactMethodVerified,
  markFactorMethodVerified,
  normalizeVerificationDestination,
  readVerificationProfile,
  removeOtherTotpFactors,
  sendContactCode,
  VERIFICATION_METHODS,
  VerificationMethod,
  verifyContactCode,
  verifyFactor,
} from '../services/signInVerification';
import './ProfileSecurityPanel.css';

interface ProfileSecurityPanelProps {
  editing: boolean;
  email: string;
  phone?: string;
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const STATUS_LABEL: Record<ProfileSessionsState['status'], string> = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

const methodById = (id: VerificationMethod) => VERIFICATION_METHODS.find((method) => method.id === id) ?? VERIFICATION_METHODS[0];

/**
 * Supabase blocks a second TOTP factor at aal1. The service retries through the
 * mfa-reset function, so seeing this message means the reset could not run —
 * point at the two ways to clear the stored factor instead of showing raw SQL
 * style text.
 */
const describeVerificationError = (cause: unknown, fallback: string) => {
  const message = cause instanceof Error ? cause.message : fallback;
  if (/aal2|assurance level/i.test(message)) {
    return 'Supabase will not replace the stored authenticator from this session. Deploy the mfa-reset function (supabase functions deploy mfa-reset) or delete the old factor in Supabase → Authentication → Users, then press Show QR Code again.';
  }
  return message;
};

export const ProfileSecurityPanel: React.FC<ProfileSecurityPanelProps> = ({ editing, email, phone = '' }) => {
  const [sessionState, setSessionState] = useState<ProfileSessionsState>({
    sessions: [],
    status: 'connecting',
    message: 'Connecting to the live session service…',
    notice: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  // Session details start collapsed; the arrow button reveals them.
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [logoutOthersBusy, setLogoutOthersBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });

  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [method, setMethod] = useState<VerificationMethod>('totp');
  const [activeMethod, setActiveMethod] = useState<VerificationMethod | null>(null);
  const [savedDestination, setSavedDestination] = useState('');
  const [totpEnrollment, setTotpEnrollment] = useState<{ factorId: string; challengeId: string; qrCode: string } | null>(null);
  const [contactChallenge, setContactChallenge] = useState<{ method: 'email' | 'whatsapp' | 'sms'; destination: string } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [emailAddress, setEmailAddress] = useState(email);
  const [whatsappNumber, setWhatsappNumber] = useState(phone);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => subscribeProfileSessions(setSessionState), []);

  useEffect(() => {
    setEmailAddress(email);
    setPhoneNumber((current) => current || phone);
    setWhatsappNumber((current) => current || phone);
  }, [email, phone]);

  const loadVerification = async () => {
    setVerificationLoading(true);
    try {
      const [profile, active] = await Promise.all([readVerificationProfile(), activeVerificationMethod()]);
      setSavedDestination(profile.destination);
      if (active) {
        setActiveMethod(active);
        setMethod(active);
      } else if (profile.method !== 'none') {
        setMethod(profile.method);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read your verification settings.');
    } finally {
      setVerificationLoading(false);
    }
  };

  useEffect(() => {
    void loadVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !supabase) return;
    setError('');
    setNotice('');
    if (!password.current) {
      setError('Enter your current password.');
      return;
    }
    if (password.next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (password.next !== password.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: password.current });
      if (verifyError) throw new Error('Current password is incorrect.');
      const { error: updateError } = await supabase.auth.updateUser({ password: password.next });
      if (updateError) throw new Error(updateError.message);
      setPassword({ current: '', next: '', confirm: '' });
      setNotice('Password updated successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const clearEnrollment = () => {
    setTotpEnrollment(null);
    setContactChallenge(null);
    setVerificationCode('');
  };

  const selectMethod = (next: VerificationMethod) => {
    if (activeMethod && activeMethod !== next) return;
    setMethod(next);
    setError('');
    setNotice('');
    clearEnrollment();
  };

  const startVerificationSetup = async () => {
    if (verificationBusy || verificationLoading) return;
    if (activeMethod) return;
    setError('');
    setNotice('');
    clearEnrollment();
    setVerificationBusy(true);
    try {
      if (method === 'totp') {
        const enrollment = await enrollTotp();
        const challengeId = await challengeFactor(enrollment.factorId);
        setTotpEnrollment({ ...enrollment, challengeId });
        setNotice('Scan the QR code with your authenticator app, then enter the current six-digit code.');
      } else {
        const destination = method === 'email' ? emailAddress : method === 'sms' ? phoneNumber : whatsappNumber;
        const problem = destinationError(method, destination);
        if (problem) throw new Error(problem);
        const normalized = normalizeVerificationDestination(method, destination);
        await sendContactCode(method, normalized);
        setContactChallenge({ method, destination: normalized });
        const channelLabel = method === 'email' ? 'email' : method === 'sms' ? 'text message' : 'WhatsApp';
        setNotice(`A six-digit code was sent to ${normalized} by ${channelLabel}.`);
      }
    } catch (cause) {
      setError(describeVerificationError(cause, 'Verification setup could not be started.'));
    } finally {
      setVerificationBusy(false);
    }
  };

  const confirmVerificationSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (verificationBusy) return;
    setError('');
    setNotice('');
    setVerificationBusy(true);
    try {
      let cleanupWarning = '';
      if (method === 'totp') {
        if (!totpEnrollment) throw new Error('Start the authenticator setup first.');
        await verifyFactor(totpEnrollment.factorId, totpEnrollment.challengeId, verificationCode);
        // The new factor raised this session to aal2, which is the only level
        // at which a verified factor may be removed. Drop the lost device's
        // factor now so future challenges can only use the new authenticator.
        try {
          await removeOtherTotpFactors(totpEnrollment.factorId);
        } catch (cleanupCause) {
          cleanupWarning = cleanupCause instanceof Error
            ? ` The old authenticator could not be removed: ${cleanupCause.message}`
            : ' The old authenticator could not be removed.';
        }
        await markFactorMethodVerified('totp', 'Authenticator app');
        setSavedDestination('Authenticator app');
      } else {
        if (!contactChallenge) throw new Error('Request a verification code first.');
        await verifyContactCode(contactChallenge.method, contactChallenge.destination, verificationCode);
        await markContactMethodVerified(contactChallenge.method, contactChallenge.destination);
        setSavedDestination(contactChallenge.destination);
      }
      setActiveMethod(method);
      clearEnrollment();
      setNotice(`${methodById(method).shortLabel} verification is now active.${cleanupWarning}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The verification code could not be confirmed.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const turnOffVerification = async () => {
    if (verificationBusy) return;
    if (!window.confirm('Turn off sign-in verification for this account?')) return;
    setVerificationBusy(true);
    setError('');
    setNotice('');
    try {
      await disableVerification();
      setActiveMethod(null);
      setSavedDestination('');
      setMethod('totp');
      clearEnrollment();
      setNotice('Sign-in verification is turned off.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to turn off verification.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const toggleSessionDetails = (sessionId: string) => {
    setExpandedSessions((current) => ({ ...current, [sessionId]: !current[sessionId] }));
  };

  const logoutSession = async (session: ProfileLoginSession) => {
    setError('');
    if (session.isCurrent) {
      await signOutCurrentDevice();
      return;
    }
    setPendingSessionId(session.id);
    try {
      await revokeProfileSession(session.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log out this session.');
    } finally {
      setPendingSessionId(null);
    }
  };

  const logoutOthers = async () => {
    if (!window.confirm('Log out all other active sessions?')) return;
    setLogoutOthersBusy(true);
    setError('');
    try {
      await revokeOtherProfileSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log out other sessions.');
    } finally {
      setLogoutOthersBusy(false);
    }
  };

  const selectedMethod = methodById(method);
  const setupStarted = Boolean(totpEnrollment || contactChallenge);
  const activeOption = activeMethod ? methodById(activeMethod) : null;

  const destinationValue = method === 'email' ? emailAddress : method === 'sms' ? phoneNumber : whatsappNumber;
  const destinationFieldLabel = method === 'email' ? 'Email address' : method === 'sms' ? 'Mobile number' : 'WhatsApp number';
  const destinationProblem = method === 'totp' ? null : destinationError(method, destinationValue);
  const projectRef = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(process.env.REACT_APP_SUPABASE_URL ?? '')?.[1] ?? '';
  const needsResetSetup = /0029_reset_own_mfa_factors|mfa-reset service is not reachable/i.test(error);

  return (
    <div className="profile-security-stack">
      {error && (
        <div className="profile-security-alert" role="alert">
          <span>{error}</span>
          {needsResetSetup && (
            <a
              className="profile-security-alert-link"
              href={projectRef
                ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
                : 'https://supabase.com/dashboard'}
              target="_blank"
              rel="noreferrer"
            >
              Open the SQL Editor
            </a>
          )}
        </div>
      )}
      {notice && <div className="profile-security-notice" role="status">{notice}</div>}

      <section className="profile-security-section">
        <header><h2>Change Password</h2><p>Confirm your current password before updating it.</p></header>
        <form className="profile-security-password-grid" onSubmit={changePassword}>
          <label><span>CURRENT PASSWORD</span><input type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword((value) => ({ ...value, current: event.target.value }))} readOnly={!editing} required /></label>
          <label><span>NEW PASSWORD</span><input type="password" autoComplete="new-password" value={password.next} onChange={(event) => setPassword((value) => ({ ...value, next: event.target.value }))} readOnly={!editing} minLength={8} required /></label>
          <label><span>CONFIRM NEW PASSWORD</span><input type="password" autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword((value) => ({ ...value, confirm: event.target.value }))} readOnly={!editing} minLength={8} required /></label>
          {editing && <button type="submit" className="profile-security-primary" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Change Password'}</button>}
        </form>
      </section>

      <section className="profile-security-section">
        <header>
          <h2>Sign-in Verification</h2>
          <p>Choose how MindPulse confirms it&apos;s you. The code can arrive by QR/authenticator app, SMS, email, or WhatsApp.</p>
        </header>

        <div className="profile-security-methods" role="radiogroup" aria-label="Verification method">
          {VERIFICATION_METHODS.map((option) => {
            const isActive = activeMethod === option.id;
            const isSelected = method === option.id;
            const locked = Boolean(activeMethod && !isActive);
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`profile-security-method ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
                onClick={() => selectMethod(option.id)}
                disabled={locked || verificationBusy || verificationLoading}
              >
                <span className="profile-security-method-top">
                  <strong>{option.label}</strong>
                  <span className="profile-security-method-badges">
                    {option.recommended && !isActive && (
                      <span className="profile-security-recommended">Recommended</span>
                    )}
                    {isActive && <span className="profile-security-current">Active</span>}
                  </span>
                </span>
                <span>{option.description}</span>
              </button>
            );
          })}
        </div>

        {verificationLoading ? (
          <p className="profile-security-empty">Checking your verification settings…</p>
        ) : activeMethod && activeOption && !setupStarted ? (
          <div className="profile-security-method-panel">
            <div>
              <h3>{activeOption.label} is active</h3>
              <p>
                {activeMethod === 'totp'
                  ? 'Sign-in asks for a code from your authenticator app.'
                  : activeMethod === 'sms'
                    ? `Sign-in codes are sent to ${savedDestination || 'your mobile number'}.`
                    : `Sign-in codes are sent to ${savedDestination} by ${activeMethod === 'email' ? 'email' : 'WhatsApp'}.`}
              </p>
            </div>
            <button type="button" className="profile-security-secondary" onClick={() => void turnOffVerification()} disabled={verificationBusy}>
              Turn Off Verification
            </button>
          </div>
        ) : (
          <div className="profile-security-method-panel profile-security-method-setup">
            <p>{selectedMethod.description}</p>

            {method === 'sms' && (
              <label>
                <span>MOBILE NUMBER</span>
                <input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} disabled={setupStarted} />
                <small className="profile-security-session-note">Use a Philippines local number or include its country calling code.</small>
                {destinationProblem && <small className="profile-security-session-error" role="alert">{destinationProblem}</small>}
              </label>
            )}

            {(method === 'email' || method === 'whatsapp') && (
              <label>
                <span>{destinationFieldLabel.toUpperCase()}</span>
                <input
                  type={method === 'email' ? 'email' : 'tel'}
                  value={destinationValue}
                  onChange={(event) => (method === 'email' ? setEmailAddress(event.target.value) : setWhatsappNumber(event.target.value))}
                  disabled={Boolean(contactChallenge)}
                />
                {method === 'whatsapp' && <small className="profile-security-session-note">Use a Philippines local number or include its country calling code.</small>}
                {destinationProblem && <small className="profile-security-session-error" role="alert">{destinationProblem}</small>}
              </label>
            )}

            {totpEnrollment && (
              <div className="profile-security-qr">
                <img src={totpEnrollment.qrCode} alt="Authenticator enrollment QR code" />
                <p>Scan this QR code with your authenticator app, then enter the six-digit code it shows.</p>
              </div>
            )}

            {setupStarted && (
              <form className="profile-security-code-form" onSubmit={confirmVerificationSetup}>
                <label>
                  <span>VERIFICATION CODE</span>
                  <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
                </label>
                <button className="profile-security-primary" type="submit" disabled={verificationBusy || verificationCode.length !== 6}>{verificationBusy ? 'Verifying…' : 'Verify and Enable'}</button>
                <button className="profile-security-secondary" type="button" onClick={clearEnrollment} disabled={verificationBusy}>Cancel</button>
              </form>
            )}

            {!setupStarted && (
              <button className="profile-security-primary" type="button" onClick={() => void startVerificationSetup()} disabled={verificationBusy || verificationLoading || Boolean(destinationProblem)}>
                {verificationBusy ? 'Starting…' : method === 'totp' ? 'Show QR Code' : method === 'sms' ? 'Send SMS Code' : `Send ${method === 'email' ? 'Email' : 'WhatsApp'} Code`}
              </button>
            )}

            {(method === 'email' || method === 'whatsapp' || method === 'sms') && (
              <p className="profile-security-session-note">
                Email, SMS and WhatsApp codes are delivered by the `verification-code` Supabase function. If the function or its mail/SMS provider is not configured, setup will report that instead of pretending a code was sent.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="profile-security-section">
        <header className="profile-security-session-header">
          <div>
            <div className="profile-security-session-title">
              <h2>Active Login Sessions</h2>
              <span className={`profile-security-live is-${sessionState.status}`}>{STATUS_LABEL[sessionState.status]}</span>
            </div>
            <p>Every signed-in admin or doctor tab appears here and updates live. IP address and precise location are not available from browser sessions.</p>
          </div>
          <button
            type="button"
            className="profile-security-secondary"
            onClick={() => void logoutOthers()}
            disabled={logoutOthersBusy}
            title="Revokes every other session on the server, including devices that are not listed here."
          >
            {logoutOthersBusy ? 'Logging out…' : 'Log Out All Other Sessions'}
          </button>
        </header>

        {sessionState.status !== 'live' && sessionState.message && (
          <p className="profile-security-session-error" role="status">{sessionState.message}</p>
        )}
        {sessionState.notice && <p className="profile-security-session-note" role="status">{sessionState.notice}</p>}

        {sessionState.sessions.length === 0 ? (
          <p className="profile-security-empty">
            {sessionState.status === 'live'
              ? 'No device is tracked yet. This tab will appear as soon as the live channel syncs.'
              : 'Waiting for the live session service…'}
          </p>
        ) : (
          <div className="profile-security-session-list">
            {sessionState.sessions.map((session) => (
              <article className={`profile-security-session ${expandedSessions[session.id] ? 'is-expanded' : ''}`} key={session.id}>
                <header>
                  <div className="profile-security-session-identity">
                    <h3>{session.deviceName}</h3>
                    <p>{session.roleLabel} · {session.browser} · {session.operatingSystem}</p>
                  </div>
                  <div className="profile-security-session-aside">
                    <div className="profile-security-session-actions">
                      {session.isCurrent && <span className="profile-security-current">Current Device</span>}
                      <button
                        type="button"
                        className="profile-security-session-toggle"
                        aria-expanded={Boolean(expandedSessions[session.id])}
                        aria-controls={`profile-session-details-${session.id}`}
                        aria-label={expandedSessions[session.id] ? 'Hide session details' : 'Show session details'}
                        title={expandedSessions[session.id] ? 'Hide details' : 'Show details'}
                        onClick={() => toggleSessionDetails(session.id)}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <button type="button" className="profile-security-logout" onClick={() => void logoutSession(session)} disabled={pendingSessionId === session.id}>
                      {pendingSessionId === session.id ? 'Logging out…' : session.isCurrent ? 'Sign Out This Device' : 'Log Out'}
                    </button>
                  </div>
                </header>
                <div
                  className="profile-security-session-details"
                  id={`profile-session-details-${session.id}`}
                  hidden={!expandedSessions[session.id]}
                >
                  <dl>
                    <div><dt>Signed in</dt><dd>{formatDateTime(session.signedInAt)}</dd></div>
                    <div><dt>Last active</dt><dd>{formatDateTime(session.lastActiveAt)}</dd></div>
                    <div><dt>Time zone</dt><dd>{session.location}</dd></div>
                    <div><dt>IP address</dt><dd>{session.ipAddress}</dd></div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="profile-security-session-note">
          Logging out a device sends an immediate sign-out signal and removes it from this list. When the session-control function is deployed, its refresh token is also revoked so it cannot silently reconnect. A device appears again the next time it signs in. “Log Out All Other Sessions” always works, even when only one device is listed, because it revokes the refresh tokens on the server.
        </p>
      </section>
    </div>
  );
};
