import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminNotificationsView } from '../views/admin/AdminNotificationsView';
import { DoctorView } from './navigation/DoctorSidebar';
import {
  FeedNotification,
  fetchAllNotifications,
  dismissFeedNotification,
  isMessageNotification,
  markAllNotificationsRead,
  markFeedNotificationRead,
  notificationFullTime,
} from '../services/notifications';
import './NotificationHistorySheet.css';

export type NotificationSheetScope = 'doctor' | 'admin';

/** App.tsx listens for this so a notification can jump the doctor portal. */
export const DOCTOR_NAVIGATE_EVENT = 'mindpulse:doctor-navigate';

export interface DoctorNavigateDetail {
  view: DoctorView;
  /** Consultations has its own sub-tabs; message rows open "Messages". */
  tab?: 'upcoming' | 'history' | 'messages';
}

interface NotificationHistorySheetProps {
  scope: NotificationSheetScope;
  onClose: () => void;
  /** Opens straight into the detail pane for this notification. */
  initialId?: string;
  /** Fires after any change (mark one / mark all) so badges can refresh. */
  onChanged?: () => void;
}

const doctorTargetFor = (notification: FeedNotification): DoctorNavigateDetail => {
  const text = `${notification.title} ${notification.message}`.toLowerCase();
  if (isMessageNotification(notification)) return { view: 'consultations', tab: 'messages' };
  if (notification.type === 'appointment' || /appointment|consultation|session|booking|reschedul/.test(text)) {
    return { view: 'consultations' };
  }
  if (/recommend|action plan|suggestion/.test(text)) return { view: 'recommendations' };
  if (notification.type === 'alert' || /stress|assessment|score|result|risk/.test(text)) {
    return { view: 'assessment-results' };
  }
  if (/student|case/.test(text)) return { view: 'student-cases' };
  return { view: 'dashboard' };
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
  const [dismissingId, setDismissingId] = useState<string | null>(null);
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

  /**
   * Archive (B-2): soft-delete the row from my own list — sets is_deleted so
   * the row is preserved but hidden. Optimistic with rollback,
   * and leaving the detail pane when the open row is the one archived.
   */
  const dismissOne = async (notification: FeedNotification) => {
    setDismissingId(notification.id);
    setActionError('');
    try {
      await dismissFeedNotification(notification.id);
      setRows((current) => current.filter((row) => row.id !== notification.id));
      setSelectedId((current) => (current === notification.id ? null : current));
      onChanged?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to archive this notification.');
    } finally {
      setDismissingId(null);
    }
  };

  /**
   * Opening a notification is the act of reading it, so a tap both shows the
   * detail and clears the unread state behind it.
   */
  const openNotification = (notification: FeedNotification) => {
    setSelectedId(notification.id);
    if (!notification.read) void markOne(notification);
  };

  // Arriving from a bell row ("See all" with an id) counts as reading it too.
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (didAutoOpen.current || !initialId || isLoading) return;
    const target = rows.find((row) => row.id === initialId);
    if (!target) return;
    didAutoOpen.current = true;
    openNotification(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, isLoading, rows]);

  const navigateTo = useCallback(
    (pathname: string) => {
      onClose();
      window.history.pushState({}, '', pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    [onClose],
  );

  const jumpToDoctorView = (notification: FeedNotification) => {
    void markOne(notification);
    onClose();
    window.dispatchEvent(
      new CustomEvent<DoctorNavigateDetail>(DOCTOR_NAVIGATE_EVENT, {
        detail: doctorTargetFor(notification),
      }),
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
            <AdminNotificationsView
              embedded
              onNavigate={(pathname) => navigateTo(pathname)}
              onChanged={() => {
                onChanged?.();
                setReloadKey((key) => key + 1);
              }}
            />
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
                          onClick={() => openNotification(row)}
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
                        <button
                          type="button"
                          className="notif-hs-row-dismiss"
                          aria-label={`Archive notification: ${row.title}`}
                          disabled={dismissingId === row.id}
                          onClick={() => void dismissOne(row)}
                        >
                          {dismissingId === row.id ? '…' : '✕'}
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
                    <button
                      type="button"
                      className="notif-hs-dismiss"
                      disabled={dismissingId === selected.id}
                      onClick={() => void dismissOne(selected)}
                    >
                      {dismissingId === selected.id ? 'Archiving…' : 'Archive'}
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
