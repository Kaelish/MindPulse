import React, { useState } from 'react';
import { supabase } from '../../supabase/client';

export type AuthScreen = 'login' | 'register' | 'forgot' | 'reset' | 'confirm';

interface WebAuthProps {
  screen: AuthScreen;
  setScreen: (screen: AuthScreen) => void;
}

export const WebAuth: React.FC<WebAuthProps> = ({ screen, setScreen }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please complete all fields to create your account.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add your project URL and publishable key first.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        // Signed in immediately — App routes by profile role.
        return;
      }
      setScreen('confirm');
    } catch {
      setErrorMessage('Unable to create your account right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add your project URL and publishable key first.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }
      // App's auth listener routes by profile role.
    } catch {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add your project URL and publishable key first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setInfoMessage(`A reset link was sent to ${email.trim()}.`);
    } catch {
      setErrorMessage('Unable to send the reset link right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!password.trim() || password.length < 8) {
      setErrorMessage('Please choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The two passwords do not match.');
      return;
    }
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Add your project URL and publishable key first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(
          error.message.includes('session') || error.message.includes('authenticated')
            ? 'Open the reset link from your email first, then set a new password here.'
            : error.message,
        );
        return;
      }
      setInfoMessage('Password updated. You can sign in now.');
      setScreen('login');
    } catch {
      setErrorMessage('Unable to update your password right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!supabase || !email.trim()) {
      setErrorMessage('Enter your email address first, then request a new confirmation link.');
      return;
    }
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setInfoMessage(`A new confirmation link was sent to ${email.trim()}.`);
    } catch {
      setErrorMessage('Unable to resend the confirmation link right now.');
    }
  };

  if (screen === 'confirm') {
    return (
      <div className="auth-shell auth-shell-compact">
        <div className="auth-card auth-card-split">
          <aside className="auth-side-panel auth-side-panel-soft">
            <div className="brand-chip">
              <span className="brand-icon">M</span>
              <span>MindPulse</span>
            </div>
            <h2>Confirm your email</h2>
            <p>One more step keeps your account secure.</p>
            <ul className="auth-bullets">
              <li>Check your inbox</li>
              <li>Click the confirmation link</li>
              <li>Come back and sign in</li>
            </ul>
          </aside>

          <div className="auth-form-panel">
            <h1>Check your email</h1>
            <p>
              {email.trim()
                ? `We sent a confirmation link to ${email.trim()}.`
                : 'We sent a confirmation link to your email address.'}{' '}
              After confirming, sign in to continue.
            </p>
            {errorMessage && <p className="auth-error">{errorMessage}</p>}
            {infoMessage && <p className="auth-error">{infoMessage}</p>}
            <button className="primary-button" type="button" onClick={() => setScreen('login')}>
              Go to sign in
            </button>
            <p className="auth-switch">
              Link not there?{' '}
              <button type="button" onClick={handleResendConfirmation}>
                Resend confirmation email
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'forgot' || screen === 'reset') {
    const isReset = screen === 'reset';

    return (
      <div className="auth-shell auth-shell-compact">
        <div className="auth-card auth-card-split">
          <aside className="auth-side-panel auth-side-panel-soft">
            <div className="brand-chip">
              <span className="brand-icon">M</span>
              <span>MindPulse</span>
            </div>
            <h2>{isReset ? 'Create New Password' : 'Forgot Password?'}</h2>
            <p>
              {isReset
                ? 'Choose a strong password to protect your MindPulse account.'
                : 'No problem. Enter your email address and we will send you a link to reset your password.'}
            </p>
            <ul className="auth-bullets">
              <li>Secure access</li>
              <li>Privacy first</li>
              <li>Quick recovery</li>
            </ul>
          </aside>

          <div className="auth-form-panel">
            <h1>{isReset ? 'Reset Password' : 'Forgot Password?'}</h1>
            <p>{isReset ? 'Enter your new password below.' : 'Reset your password and regain access to your account.'}</p>
            <form className="auth-form" onSubmit={isReset ? handleResetPassword : handleForgotPassword}>
              {isReset ? (
                <>
                  <label>
                    <span>New Password</span>
                    <input type="password" placeholder="Enter your new password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  <label>
                    <span>Confirm New Password</span>
                    <input type="password" placeholder="Re-enter your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </label>
                </>
              ) : (
                <label>
                  <span>Email address</span>
                  <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
              )}

              {errorMessage && <p className="auth-error">{errorMessage}</p>}
              {infoMessage && <p className="auth-error">{infoMessage}</p>}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : isReset ? 'Reset Password' : 'Send Reset Link'}
              </button>
            </form>
            <p className="auth-switch">
              Remember your password?{' '}
              <button type="button" onClick={() => setScreen('login')}>
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'register') {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card-split">
          <aside className="auth-side-panel">
            <div className="brand-chip">
              <span className="brand-icon">M</span>
              <span>MindPulse</span>
            </div>
            <h2>Start Your Journey with MindPulse</h2>
            <p>Join leading organizations in transforming mental health monitoring through AI-powered facial analysis.</p>
            <ul className="auth-bullets">
              <li>Real-time stress detection</li>
              <li>Comprehensive analytics</li>
              <li>Privacy first</li>
            </ul>
          </aside>

          <div className="auth-form-panel">
            <h1>Create your account</h1>
            <p>Start a calmer, more connected care experience.</p>
            <form className="auth-form" onSubmit={handleRegister}>
              <label>
                <span>Full name</span>
                <input placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label>
                <span>Email address</span>
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                <span>Password</span>
                <input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {errorMessage && <p className="auth-error">{errorMessage}</p>}
              {infoMessage && <p className="auth-error">{infoMessage}</p>}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create account'}
              </button>
            </form>
            <p className="auth-switch">
              Already have an account?{' '}
              <button type="button" onClick={() => setScreen('login')}>
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-split">
        <aside className="auth-side-panel auth-side-panel-soft">
          <div className="brand-chip">
            <span className="brand-icon">M</span>
            <span>MindPulse</span>
          </div>
          <h2>Welcome Back to MindPulse</h2>
          <p>AI-based emotional stress detection system using facial analysis.</p>
          <ul className="auth-bullets">
            <li>Real-time stress detection</li>
            <li>Secure monitoring</li>
            <li>Easy follow-up</li>
          </ul>
        </aside>

        <div className="auth-form-panel">
          <h1>Welcome back</h1>
          <p>Sign in to continue to your MindPulse workspace.</p>
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Email address</span>
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {errorMessage && <p className="auth-error">{errorMessage}</p>}
            {infoMessage && <p className="auth-error">{infoMessage}</p>}
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="auth-switch auth-switch-inline">
            New to MindPulse?{' '}
            <button type="button" onClick={() => setScreen('register')}>
              Create account
            </button>
          </p>
          <p className="auth-switch auth-switch-inline auth-switch-muted">
            <button type="button" onClick={() => setScreen('forgot')}>
              Forgot password?
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
