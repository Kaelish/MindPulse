import React from 'react';

interface RoleSelectionProps {
  setScreen: (screen: 'doctor' | 'admin' | 'login') => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ setScreen }) => {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Choose your workspace</h1>
        <p>Select the portal that matches your role.</p>
        <div className="role-grid">
          <button type="button" className="role-card" onClick={() => setScreen('doctor')}>
            <strong>Doctor Dashboard</strong>
            <span>Review patients, schedules, consultations, and live chat.</span>
          </button>
          <button type="button" className="role-card" onClick={() => setScreen('admin')}>
            <strong>Admin Dashboard</strong>
            <span>System management and platform metrics.</span>
          </button>
        </div>
      </div>
    </div>
  );
};
