import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NotificationBell } from '../../components/NotificationBell';
import {
  adminPathForNotificationCategory,
  FeedNotification,
  markFeedNotificationRead,
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  notificationTimeAgo,
} from '../../services/notifications';
import { fetchFeedNotifications } from '../../services/notifications';
import './AdminNotificationsView.css';

type CategoryFilter = NotificationCategory | 'all';

interface AdminNotificationsViewProps {
  onNavigate: (pathname: string) => void;
}

const readCategory = (): CategoryFilter => {
  const value = new URLSearchParams(window.location.search).get('category');
  if (value === 'all' || NOTIFICATION_CATEGORIES.some((category) => category.value === value)) return value as CategoryFilter;
  return 'all';
};

const categoryLabel = (category: CategoryFilter) =>
  category === 'all'
    ? 'All Notifications'
    : NOTIFICATION_CATEGORIES.find((option) => option.value === category)?.label ?? 'All Notifications';

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [category, setCategory] = useState<CategoryFilter>(readCategory);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadNotifications = useCallback(() => {
    setIsLoading(true);
    setError('');
    fetchFeedNotifications(1000)
      .then((result) => setNotifications(result.notifications))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const syncCategory = () => setCategory(readCategory());
    window.addEventListener('popstate', syncCategory);
    return () => window.removeEventListener('popstate', syncCategory);
  }, []);

  const updateCategory = (nextCategory: CategoryFilter) => {
    setCategory(nextCategory);
    const query = new URLSearchParams(window.location.search);
    query.set('category', nextCategory);
    window.history.replaceState({}, '', `/notifications?${query.toString()}`);
  };

  const filteredNotifications = useMemo(() => notifications.filter((notification) =>
    (category === 'all' || notification.category === category) &&
    (!unreadOnly || !notification.read),
  ), [category, notifications, unreadOnly]);

  const unreadCount = notifications.filter((notification) =>
    (category === 'all' || notification.category === category) && !notification.read,
  ).length;

  const goBack = () => {
    const from = new URLSearchParams(window.location.search).get('from');
    if (from?.startsWith('/') && !from.startsWith('//') && from !== '/notifications') {
      onNavigate(from);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    onNavigate('/dashboard');
  };

  const markAsRead = async (notification: FeedNotification) => {
    if (notification.read) return;
    setMarkingId(notification.id);
    setActionError('');
    try {
      await markFeedNotificationRead(notification.id);
      setNotifications((current) => current.map((row) =>
        row.id === notification.id ? { ...row, read: true } : row,
      ));
    } catch (markError) {
      setActionError(markError instanceof Error ? markError.message : 'Unable to mark this notification as read.');
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <main className="admin-notifications-main">
      <header className="admin-notifications-header">
        <button type="button" className="admin-notifications-back" onClick={goBack}>
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="admin-notifications-title">
          <span className="admin-notifications-bell"><NotificationBell /></span>
          <div>
            <h1>View Notifications</h1>
            <p>Stay updated with important alerts and updates</p>
          </div>
        </div>
      </header>

      <section className="admin-notifications-toolbar" aria-label="Notification filters">
        <div className="admin-notification-tabs" role="tablist" aria-label="Read status">
          <button
            type="button"
            role="tab"
            aria-selected={!unreadOnly}
            className={!unreadOnly ? 'active' : ''}
            onClick={() => setUnreadOnly(false)}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={unreadOnly}
            className={unreadOnly ? 'active' : ''}
            onClick={() => setUnreadOnly(true)}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <label className="admin-notification-category-filter">
          <select
            aria-label="Notification category"
            value={category}
            onChange={(event) => updateCategory(event.target.value as CategoryFilter)}
          >
            <option value="all">All Notifications</option>
            {NOTIFICATION_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </section>

      {actionError && <p className="admin-notifications-error" role="alert">{actionError}</p>}
      {isLoading && <div className="admin-notifications-state" role="status">Loading notifications…</div>}
      {!isLoading && error && (
        <div className="admin-notifications-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadNotifications}>Retry</button>
        </div>
      )}
      {!isLoading && !error && filteredNotifications.length === 0 && (
        <div className="admin-notifications-state">No notifications in {categoryLabel(category).toLowerCase()}.</div>
      )}

      {!isLoading && !error && filteredNotifications.length > 0 && (
        <section className="admin-notification-cards" aria-label={`${categoryLabel(category)} feed`}>
          {filteredNotifications.map((notification) => (
            <article key={notification.id} className={`admin-notification-card ${notification.read ? 'is-read' : 'is-unread'}`}>
              <span className={`admin-notification-icon ${notification.type === 'alert' ? 'is-alert' : ''}`} aria-hidden="true">
                {notification.type === 'alert' ? '!' : 'i'}
              </span>
              <div className="admin-notification-content">
                <div className="admin-notification-heading">
                  <h2>{notification.title}</h2>
                  <time dateTime={notification.createdAt}>{notificationTimeAgo(notification.createdAt)}</time>
                </div>
                <p>{notification.message}</p>
                <span className="admin-notification-category-label">{categoryLabel(notification.category)}</span>
                <div className="admin-notification-actions">
                  <button
                    type="button"
                    className="admin-notification-mark-read"
                    disabled={notification.read || markingId === notification.id}
                    onClick={() => void markAsRead(notification)}
                  >
                    {notification.read ? 'Read' : markingId === notification.id ? 'Saving…' : 'Mark as Read'}
                  </button>
                  <button
                    type="button"
                    className="admin-notification-view-details"
                    onClick={() => onNavigate(adminPathForNotificationCategory(notification.category))}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};