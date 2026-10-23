import React, { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import {
  connectProfileSessions,
  ProfileLoginSession,
  revokeOtherProfileSessions,
  revokeProfileSession,
} from '../services/profileSessions';
import './ProfileSecurityPanel.css';

interface ProfileSecurityPanelProps {
  editing: boolean;
  email: string;
}

const formatLastActive = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export const ProfileSecurityPanel: React.FC<ProfileSecurityPanelProps> = ({ editing, email }) => {
  const [sessions, setSessions] = useState<ProfileLoginSession[]>([]);
  const [sessionError, setSessionError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [logoutOthersBusy, setLogoutOthersBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    let active = true;
    let disconnect: (() => void) | undefined;
    connectProfileSessions(setSessions, setSessionError)
      .then((stop) => {
        if (active) disconnect = stop;
        else stop();
      })
      .catch((cause: unknown) => {
        if (active) setSessionError(cause instanceof Error ? cause.message : 'Unable to connect to live sessions.');
      });
    return () => {
      active = false;
      disconnect?.();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error: factorError }) => {
      if (!active) return;
      if (factorError) {
        setError(factorError.message);
        return;
      }
      setMfaEnabled((data?.totp ?? []).some((factor) => factor.status === 'verified'));
    });
    return () => { active = false; };
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

  const toggleMfa = async () => {
    if (!editing || !supabase) return;
    setMfaBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const verifiedFactor = (data?.totp ?? []).find((factor) => factor.status === 'verified');
      if (verifiedFactor) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
        if (unenrollError) throw unenrollError;
        setMfaEnabled(false);
        setNotice('Two-factor authentication disabled.');
      } else {
        const unverified = (data?.all ?? []).find((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
        if (unverified) {
          const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: unverified.id });
          if (removeError) throw removeError;
        }
        const { data: enrollment, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'MindPulse profile authenticator',
        });
        if (enrollError) throw enrollError;
        setFactorId(enrollment.id);
        setQrCode(enrollment.totp.qr_code);
        setNotice('Scan the QR code, then enter a current authenticator code to finish setup.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update two-factor authentication.');
    } finally {
      setMfaBusy(false);
    }
  };

  const verifyMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !supabase || !factorId) return;
    setMfaBusy(true);
    setError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (verifyError) throw verifyError;
      setMfaEnabled(true);
      setFactorId('');
      setQrCode('');
      setMfaCode('');
      setNotice('Two-factor authentication enabled.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The authenticator code could not be verified.');
    } finally {
      setMfaBusy(false);
    }
  };

  const cancelMfa = async () => {
    if (!supabase || !factorId) return;
    setMfaBusy(true);
    setError('');
    try {
      const { error: cancelError } = await supabase.auth.mfa.unenroll({ factorId });
      if (cancelError) throw cancelError;
      setFactorId('');
      setQrCode('');
      setMfaCode('');
      setNotice('Authenticator setup cancelled.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to cancel authenticator setup.');
    } finally {
      setMfaBusy(false);
    }
  };

  const logoutSession = async (session: ProfileLoginSession) => {
    setError('');
    if (session.isCurrent) {
      await supabase?.auth.signOut({ scope: 'local' });
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

  return (
    <div className="profile-security-stack">
      {error && <div className="profile-security-alert" role="alert">{error}</div>}
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
        <div className="profile-security-toggle-row">
          <div><h2>Two-Factor Authentication</h2><p>{mfaEnabled ? 'Authenticator app verification is enabled.' : 'Protect your account with an authenticator app.'}</p></div>
          <button type="button" role="switch" aria-checked={mfaEnabled} className={`profile-security-switch ${mfaEnabled ? 'is-on' : ''}`} onClick={() => void toggleMfa()} disabled={!editing || mfaBusy || Boolean(factorId)}><span /></button>
        </div>
        {factorId && (
          <form className="profile-security-mfa" onSubmit={verifyMfa}>
            <img src={qrCode} alt="Authenticator enrollment QR code" />
            <label><span>AUTHENTICATOR CODE</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} required /></label>
            <button className="profile-security-primary" type="submit" disabled={mfaBusy}>{mfaBusy ? 'Verifying…' : 'Verify and Enable'}</button>
            <button className="profile-security-secondary" type="button" onClick={() => void cancelMfa()} disabled={mfaBusy}>Cancel Setup</button>
          </form>
        )}
      </section>

      <section className="profile-security-section">
        <header className="profile-security-session-header">
          <div><h2>Active Login Sessions</h2><p>Device sessions update live. IP address and precise location are not available from browser sessions.</p></div>
          <button type="button" className="profile-security-secondary" onClick={() => void logoutOthers()} disabled={logoutOthersBusy || sessions.length < 2}>{logoutOthersBusy ? 'Logging out…' : 'Log Out All Other Sessions'}</button>
        </header>
        {sessionError && <p className="profile-security-session-error" role="status">{sessionError}</p>}
        {sessions.length === 0 ? <p className="profile-security-empty">Waiting for connected devices…</p> : (
          <div className="profile-security-session-list">
            {sessions.map((session) => (
              <article className="profile-security-session" key={session.id}>
                <header><div><h3>{session.deviceName}</h3><p>{session.browser} · {session.operatingSystem}</p></div>{session.isCurrent && <span className="profile-security-current">Current Device</span>}</header>
                <dl>
                  <div><dt>IP Address</dt><dd>{session.ipAddress}</dd></div>
                  <div><dt>Location</dt><dd>{session.location}</dd></div>
                  <div><dt>Last Active</dt><dd>{formatLastActive(session.lastActiveAt)}</dd></div>
                </dl>
                <button type="button" className="profile-security-logout" onClick={() => void logoutSession(session)} disabled={pendingSessionId === session.id}>{pendingSessionId === session.id ? 'Logging out…' : 'Log Out'}</button>
              </article>
            ))}
          </div>
        )}
        <p className="profile-security-session-note">Logging out revokes the session refresh token. An already-issued access token can remain valid until expiry.</p>
      </section>
    </div>
  );
};