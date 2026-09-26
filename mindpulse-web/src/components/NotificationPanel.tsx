import React, { useCallback, useEffect, useState } from 'react';
import { FeedNotification, fetchFeedNotifications, notificationTimeAgo } from '../services/notifications';
import './NotificationPanel.css';

interface NotificationPanelProps {
  variant?: 'default' | 'dashboard';
}

/**
 * The bell dropdown used across the admin views: fetches the real
 * notifications table (RLS-gated) and honours the preferences saved in
 * Settings → Profile → Notifications.
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ variant = 'default' }) => {
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setIsLoading(true);
    setError('');
    fetchFeedNotifications()
      .then((result) => {
        setNotifications(result.notifications);
        setHiddenCount(result.hiddenCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load notifications.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const body = (
    <>
      <div className="notification-heading"><strong>Notifications</strong></div>
      {isLoading && <div className="loading-state"><span className="spinner" /></div>}
      {!isLoading && error && (
        <div className="notification-panel-state">
          <p>{error}</p>
          <button type="button" onClick={load}>Retry</button>
        </div>
      )}
      {!isLoading && !error && notifications.length === 0 && (
        <p className="empty-notifications">
          {hiddenCount > 0
            ? 'All notifications are hidden by your settings.'
            : 'No notifications yet'}
        </p>
      )}
      {!isLoading && !error && notifications.length > 0 && (
        <ul className="notification-list">
          {notifications.map((row) => (
            <li key={row.id} className={`notification-item ${row.read ? '' : 'unread'}`}>
              <div className="notification-item-head">
                <span className="notification-item-title">{row.title}</span>
                <span className="notification-item-time">{notificationTimeAgo(row.createdAt)}</span>
              </div>
              <p className="notification-item-message">{row.message}</p>
            </li>
          ))}
        </ul>
      )}
      {!isLoading && !error && hiddenCount > 0 && (
        <p className="notification-panel-note">
          {hiddenCount} hidden by your notification settings.
        </p>
      )}
    </>
  );

  if (variant === 'dashboard') {
    return <div className="admin-dashboard-notification-panel">{body}</div>;
  }
  return <aside className="notification-panel">{body}</aside>;
};
