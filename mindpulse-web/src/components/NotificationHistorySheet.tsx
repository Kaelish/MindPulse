import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminNotificationsView } from '../views/admin/AdminNotificationsView';
import { DoctorView } from './navigation/DoctorSidebar';
import {
  FeedNotification,
  fetchAllNotifications,
  markAllNotificationsRead,
  markFeedNotificationRead,
  notificationFullTime,
} from '../services/notifications';
import './NotificationHistorySheet.css';

export type NotificationSheetScope = 'doctor' | 'admin';

/** App.tsx listens for this so a notification can jump the doctor portal. */
export const DOCTOR_NAVIGATE_EVENT = 'mindpulse:doctor-navigate';

interface NotificationHistorySheetProps {
  scope: NotificationSheetScope;
  onClose: () => void;
  /** Opens straight into the detail pane for this notification. */
  initialId?: string;
  /** Fires after any change (mark one / mark all) so badges can refresh. */
  onChanged?: () => void;
}

const doctorTargetFor = (notification: FeedNotification): DoctorView => {
  const text = `${notification.title} ${notification.message}`.toLowerCase();
  if (notification.type === 'appointment' || /appointment|consultation|session|booking|reschedul/.test(text)) {
    return 'consultations';
  }
  if (/recommend|action plan|suggestion/.test(text)) return 'recommendations';
  if (notification.type === 'alert' || /stress|assessment|score|result|risk/.test(text)) return 'assessment-results';
  if (/student|case/.test(text)) return 'student-cases';
  return 'dashboard';
};

/**
 * The full notification history behind every "See all" button. Portalled to
 * <body> so nothing on the page can paint over it, styled by its own CSS, and
 * scoped so admins get their "View Notifications" panel while doctors get the
 * clickable past → recent list with a detail pane.
 */
export const NotificationHistorySheet: React.FC<NotificationHistorySheetProps> = ({
  scope,
  onClose,
  initialId,
  onChanged,
}) => {
  const [rows, setRows] = useState<FeedNotification[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');
    fetchAllNotifications()
      .then((result) => {
        if (!active) return;
        setRows(result.notifications);
        setHiddenCount(result.hiddenCount);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load notifications.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  // Past → recent reading, so land on the newest entry.
  useEffect(() => {
    if (isLoading || rows.length === 0) return;
    const timer = setTimeout(() => {
      const list = listRef.current;
      if (list && typeof list.scrollTo === 'function') list.scrollTo({ top: list.scrollHeight });
    }, 80);
    return () => clearTimeout(timer);
  }, [isLoading, rows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const unread = rows.filter((row) => !row.read).length;
  const selected = selectedId ? rows.find((row) => row.id === selectedId) ?? null : null;

  const markAll = async () => {
    setIsMarking(true);
    setActionError('');
    try {
      await markAllNotificationsRead();
      setRows((current) => current.map((row) => ({ ...row, read: true })));
      onChanged?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark notifications as read.');
    } finally {
      setIsMarking(false);
    }
  };

  const markOne = async (notification: FeedNotification) => {
    if (notification.read) return;
    setActionError('');
    try {
      await markFeedNotificationRead(notification.id);
      setRows((current) => current.map((row) => (row.id === notification.id ? { ...row, read: true } : row)));
      onChanged?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark this notification as read.');
    }
  };

  const navigateTo = useCallback(
    (pathname: string) => {
      onClose();
      window.history.pushState({}, '', pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    [onClose],
  );

  const jumpToDoctorView = (notification: FeedNotification) => {
    onClose();
    window.dispatchEvent(
      new CustomEvent(DOCTOR_NAVIGATE_EVENT, { detail: doctorTargetFor(notification) }),
    );
  };

  const openFullPage = () => {
    const query = new URLSearchParams({ category: 'all', from: window.location.pathname });
    navigateTo(`/notifications?${query.toString()}`);
  };

  const title = scope === 'admin' ? 'View Notifications' : 'All notifications';
  const subtitle =
    scope === 'admin'
      ? 'Stay updated with important alerts and updates'
      : `Past to recent · ${rows.length} shown`;

  return createPortal(
    <div
      className={`notif-hs-overlay notif-hs--${scope}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="notif-hs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={sheetRef}
      >
        <header className="notif-hs-head">
          <div className="notif-hs-heading">
            <h2 className="notif-hs-title">{title}</h2>
            <p className="notif-hs-sub">{subtitle}</p>
          </div>
          <div className="notif-hs-actions">
            {!isLoading && !error && unread > 0 && (
              <button type="button" className="notif-hs-markall" onClick={() => void markAll()} disabled={isMarking}>
                {isMarking ? 'Marking…' : 'Mark all as read'}
              </button>
            )}
            <button type="button" className="notif-hs-close" onClick={onClose} aria-label="Close notifications">
              ✕
            </button>
          </div>
        </header>

        {actionError && <p className="notif-hs-action-error" role="alert">{actionError}</p>}

        <div className="notif-hs-body">
          {scope === 'admin' ? (
            <AdminNotificationsView embedded onNavigate={(pathname) => navigateTo(pathname)} />
          ) : (
            <>
              {isLoading && (
                <div className="notif-hs-state" role="status">
                  <span className="notif-hs-spinner" />
                  <p>Loading your notifications…</p>
                </div>
              )}

              {!isLoading && error && (
                <div className="notif-hs-state" role="alert">
                  <p>{error}</p>
                  <button type="button" className="notif-hs-retry" onClick={() => setReloadKey((key) => key + 1)}>
                    Try again
                  </button>
                </div>
              )}

              {!isLoading && !error && rows.length === 0 && (
                <div className="notif-hs-state">
                  <span className="notif-hs-empty-mark" aria-hidden="true" />
                  <p className="notif-hs-empty-title">No notifications yet</p>
                  <p className="notif-hs-empty-text">
                    Assessment alerts, appointment updates and weekly digests will appear here.
                  </p>
                </div>
              )}

              {!isLoading && !error && rows.length > 0 && !selected && (
                <div className="notif-hs-list" ref={listRef}>
                  <ul className="notif-hs-rows">
                    {rows.map((row) => (
                      <li key={row.id} className={`notif-hs-row is-${row.type}${row.read ? '' : ' is-unread'}`}>
                        <button
                          type="button"
                          className="notif-hs-row-hit"
                          onClick={() => setSelectedId(row.id)}
                        >
                          <span className="notif-hs-dot" aria-hidden="true" />
                          <span className="notif-hs-row-body">
                            <span className="notif-hs-row-head">
                              <strong className="notif-hs-row-title">{row.title}</strong>
                              <time className="notif-hs-time" dateTime={row.createdAt}>
                                {notificationFullTime(row.createdAt)}
                              </time>
                            </span>
                            <span className="notif-hs-row-msg">{row.message}</span>
                          </span>
                          {!row.read && <span className="notif-hs-unread-tag">Unread</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {hiddenCount > 0 && (
                    <p className="notif-hs-note">{hiddenCount} hidden by your notification settings.</p>
                  )}
                </div>
              )}

              {!isLoading && !error && selected && (
                <div className="notif-hs-detail">
                  <button type="button" className="notif-hs-back" onClick={() => setSelectedId(null)}>
                    <span aria-hidden="true">←</span> All notifications
                  </button>

                  <div className="notif-hs-detail-meta">
                    <span className={`notif-hs-chip is-${selected.type}`}>{selected.type}</span>
                    {!selected.read && <span className="notif-hs-unread-tag">Unread</span>}
                  </div>

                  <h3 className="notif-hs-detail-title">{selected.title}</h3>
                  <time className="notif-hs-detail-time" dateTime={selected.createdAt}>
                    {notificationFullTime(selected.createdAt)}
                  </time>
                  <p className="notif-hs-detail-msg">{selected.message}</p>

                  <div className="notif-hs-detail-actions">
                    <button
                      type="button"
                      className="notif-hs-secondary"
                      disabled={selected.read}
                      onClick={() => void markOne(selected)}
                    >
                      {selected.read ? 'Read' : 'Mark as read'}
                    </button>
                    <button type="button" className="notif-hs-primary" onClick={() => jumpToDoctorView(selected)}>
                      View details
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {scope === 'admin' && (
          <footer className="notif-hs-foot">
            <button type="button" className="notif-hs-fullpage" onClick={openFullPage}>
              Open the full notifications page
              <span aria-hidden="true">→</span>
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
