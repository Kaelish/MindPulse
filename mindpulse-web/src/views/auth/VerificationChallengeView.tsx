import React, { FormEvent, useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import {
  resendSignInChallenge,
  VerificationChallenge,
  verifySignInChallenge,
} from '../../services/signInVerification';

interface VerificationChallengeViewProps {
  challenge: VerificationChallenge;
  onVerified: () => void;
  onSignOut: () => void;
}

const methodLabel = (challenge: VerificationChallenge) => {
  if (challenge.method === 'totp') return 'authenticator app';
  if (challenge.method === 'sms') return 'text message';
  if (challenge.method === 'whatsapp') return 'WhatsApp';
  return 'email';
};

export const VerificationChallengeView: React.FC<VerificationChallengeViewProps> = ({ challenge, onVerified, onSignOut }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [current, setCurrent] = useState(challenge);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim().length < 6) {
      setError('Enter the six-digit verification code.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await verifySignInChallenge(current, code);
      onVerified();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The verification code could not be confirmed.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await resendSignInChallenge(current);
      setCurrent(next);
      setCode('');
      setNotice(next.method === 'totp'
        ? 'Ready — enter the current code from your authenticator app.'
        : `A new code was sent to ${next.destination}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'A new code could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell auth-shell-compact">
      <div className="auth-card auth-card-split">
        <aside className="auth-side-panel auth-side-panel-soft">
          <div className="brand-chip">
            <span className="brand-icon has-image"><BrandLogo className="brand-logo-img" /></span>
            <span>MindPulse</span>
          </div>
          <h2>Confirm it&apos;s you</h2>
          <p>This account is protected with sign-in verification.</p>
          <ul className="auth-bullets">
            <li>{current.method === 'totp' ? 'Code generated in your authenticator app' : `Code delivered to ${current.destination}`}</li>
            <li>Codes expire after 10 minutes</li>
            <li>New browser sessions ask again</li>
          </ul>
        </aside>

        <div className="auth-form-panel">
          <h1>Verification required</h1>
          <p>
            {current.method === 'totp'
              ? 'Open your authenticator app and enter the current six-digit code.'
              : <>Enter the six-digit code sent to <strong>{current.destination}</strong> by {methodLabel(current)}.</>}
          </p>
          <form className="auth-form" onSubmit={submit}>
            <label>
              <span>Verification code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button className="primary-button auth-secondary-button" type="button" onClick={() => void resend()} disabled={busy}>
              Send a new code
            </button>
          </form>
          <p className="auth-switch">
            Wrong account?{' '}
            <button type="button" onClick={onSignOut}>Sign out</button>
          </p>
        </div>
      </div>
    </div>
  );
};

interface VerificationUnavailableViewProps {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}

export const VerificationUnavailableView: React.FC<VerificationUnavailableViewProps> = ({ message, onRetry, onSignOut }) => (
  <div className="auth-shell auth-shell-compact">
    <div className="auth-card auth-card-split">
      <aside className="auth-side-panel auth-side-panel-soft">
        <div className="brand-chip">
          <span className="brand-icon has-image"><BrandLogo className="brand-logo-img" /></span>
          <span>MindPulse</span>
        </div>
        <h2>Verification unavailable</h2>
        <p>The portal stays locked until this account&apos;s verification method can run.</p>
      </aside>
      <div className="auth-form-panel">
        <h1>We couldn&apos;t start verification</h1>
        <p>{message}</p>
        <div className="auth-form">
          <button className="primary-button" type="button" onClick={onRetry}>Try again</button>
          <button className="primary-button auth-secondary-button" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  </div>
);
