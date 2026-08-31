import React, { useState } from 'react';
import { supabase } from '../../supabase/client';

interface WebAuthProps {
  screen: 'login' | 'register';
  setScreen: (screen: 'login' | 'register' | 'roles') => void;
}

export const WebAuth: React.FC<WebAuthProps> = ({ screen, setScreen }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setScreen('roles');
    } catch (error) {
      setErrorMessage('Unable to create your account right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

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

      setScreen('roles');
    } catch (error) {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (screen === 'register') {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Create your account</h1>
          <p>Start a calmer, more connected care experience.</p>
          <form className="auth-form" onSubmit={handleRegister}>
            <input placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {errorMessage && <p className="auth-error">{errorMessage}</p>}
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
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Sign in to continue to your MindPulse workspace.</p>
        <form className="auth-form" onSubmit={handleLogin}>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {errorMessage && <p className="auth-error">{errorMessage}</p>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          New to MindPulse?{' '}
          <button type="button" onClick={() => setScreen('register')}>
            Create account
          </button>
        </p>
      </div>
    </div>
  );
};
