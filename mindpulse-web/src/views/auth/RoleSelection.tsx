import React from 'react';
import { supabase } from '../../supabase/client';
import { createUserProfile, AppRole } from '../../services/userProfile';

interface RoleSelectionProps {
  setScreen: (screen: 'doctor' | 'admin' | 'login') => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ setScreen }) => {
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const chooseRole = async (role: AppRole) => {
    setErrorMessage('');
    if (!supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Your session expired. Please sign in again.');
      await createUserProfile(user, role);
      setScreen(role);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save your workspace.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Choose your workspace</h1>
        <p>Select the portal that matches your role.</p>
        <div className="role-grid">
          <button type="button" className="role-card" disabled={isSaving} onClick={() => void chooseRole('doctor')}>
            <strong>Doctor Dashboard</strong>
            <span>Review patients, schedules, consultations, and live chat.</span>
          </button>
          <button type="button" className="role-card" disabled={isSaving} onClick={() => void chooseRole('admin')}>
            <strong>Admin Dashboard</strong>
            <span>System management and platform metrics.</span>
          </button>
        </div>
        {errorMessage && <p className="auth-error">{errorMessage}</p>}
      </div>
    </div>
  );
};
