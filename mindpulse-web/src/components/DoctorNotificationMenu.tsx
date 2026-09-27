import React, { useState } from 'react';
import { NotificationBell } from './NotificationBell';
import { NotificationPanel } from './NotificationPanel';
import './NotificationPanel.css';

export const DoctorNotificationMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="doctor-notification-menu">
      <button
        type="button"
        className="notification-button"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <NotificationBell />
      </button>
      {isOpen && <NotificationPanel />}
    </div>
  );
};