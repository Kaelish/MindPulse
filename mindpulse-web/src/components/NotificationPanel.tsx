import React, { useCallback, useEffect, useState } from 'react';
import {
  FeedNotification,
  fetchFeedNotifications,
  notificationCategoryForPath,
  notificationTimeAgo,
} from '../services/notifications';
import { NotificationBell } from './NotificationBell';
import { NotificationHistorySheet } from './NotificationHistorySheet';
import './NotificationPanel.css';

interface NotificationPanelProps {
  variant?: 'default' | 'dashboard';
  /** Opens the complete past → recent popup; receives the row to preview. */
  onSeeAll?: (initialId?: string) => void;
}

/**
 * The bell dropdown used across the admin views: fetches the real
 * notifications table (RLS-gated + pinned to the signed-in account) and
 * honours the preferences saved in Settings → Profile → Notifications.
 * Rows and the "See all" link both open the shared history popup.
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ variant = 'default', onSeeAll }) => {
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const activeCategory = notificationCategoryForPath(window.location.pathname);
  const activeCategoryLabel = activeCategory === 'all'
    ? 'Dashboard'
    : activeCategory === 'assessment-tools'
      ? 'Assessment Tools'
      : activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);
  const contextualNotifications = notifications.filter((notification) =>
    activeCategory === 'all' || notification.category === activeCategory,
  );
  const scope = document.querySelector('.admin-scope') ? 'admin' : 'doctor';

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

  const openHistory = (initialId?: string) => {
    if (onSeeAll) {
      onSeeAll(initialId);
      return;
    }
    setHistoryId(initialId ?? null);
    setHistoryOpen(true);
  };

  const openFromKeyboard = (event: React.KeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openHistory(id);
    }
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
          {contextualNotifications.slice(0, 5).map((row) => (
            <li
              key={row.id}
              className={`notification-item ${row.read ? '' : 'unread'} is-clickable`}
              role="button"
              tabIndex={0}
              aria-label={`Open notification: ${row.title}`}
              onClick={() => openHistory(row.id)}
              onKeyDown={(event) => openFromKeyboard(event, row.id)}
            >
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
      {!isLoading && !error && contextualNotifications.length > 0 && (
        <button type="button" className="notification-see-all" onClick={() => openHistory()}>
          See all
          <span aria-hidden="true">→</span>
        </button>
      )}
    </>
  );

  return (
    <>
      {variant === 'dashboard'
        ? <div className="admin-dashboard-notification-panel">{body}</div>
        : <aside className="notification-panel">{body}</aside>}
      {historyOpen && (
        <NotificationHistorySheet
          scope={scope}
          initialId={historyId ?? undefined}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
};
