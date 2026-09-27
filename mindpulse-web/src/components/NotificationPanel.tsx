import React, { useCallback, useEffect, useState } from 'react';
import {
  FeedNotification,
  fetchFeedNotifications,
  notificationCategoryForPath,
  notificationTimeAgo,
} from '../services/notifications';
import { NotificationBell } from './NotificationBell';
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
  const [showAll, setShowAll] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const activeCategory = notificationCategoryForPath(window.location.pathname);
  const activeCategoryLabel = activeCategory === 'all'
    ? 'Dashboard'
    : activeCategory === 'assessment-tools'
      ? 'Assessment Tools'
      : activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);
  const contextualNotifications = notifications.filter((notification) =>
    activeCategory === 'all' || notification.category === activeCategory,
  );

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

  const handleShowMore = () => {
    if (document.querySelector('.admin-scope')) {
      const category = notificationCategoryForPath(window.location.pathname);
      window.history.pushState({}, '', `/notifications?category=${category}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    setShowAll((expanded) => !expanded);
  };

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
      {!isLoading && !error && contextualNotifications.length === 0 && (
        <div className="notification-empty-state">
          <NotificationBell />
          <strong>No notifications for {activeCategoryLabel}</strong>
          <span>You're all caught up for this section.</span>
        </div>
      )}
      {!isLoading && !error && contextualNotifications.length > 0 && (
        <ul className="notification-list">
          {(showAll ? contextualNotifications : contextualNotifications.slice(0, 2)).map((row) => (
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
      {!isLoading && !error && (
        <button
          className="notification-show-more"
          type="button"
          aria-expanded={showAll}
          onClick={handleShowMore}
        >
          {showAll ? 'Show less' : 'Show more'}
        </button>
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
