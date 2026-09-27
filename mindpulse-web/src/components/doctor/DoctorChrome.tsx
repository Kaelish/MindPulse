import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NotificationBell } from '../NotificationBell';
import { NotificationPanel } from '../NotificationPanel';
import {
  FeedNotification,
  fetchAllNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  notificationFullTime,
} from '../../services/notifications';

/**
 * Notification bell shared by every doctor view: real unread badge, dropdown
 * fed by the notifications table, and closes on outside click or Escape.
 * "See all" swaps the dropdown for the complete past → recent history.
 */
export const DoctorNotifications: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const refreshUnread = useCallback(() => {
    fetchUnreadNotificationCount()
      .then((count) => setUnread(count))
      .catch(() => setUnread(0));
  }, []);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open && !showAll) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showAll) setShowAll(false);
      else setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, showAll]);

  const openFullHistory = () => {
    setOpen(false);
    setShowAll(true);
  };

  return (
    <>
      <div className="doc-bell-wrap" ref={wrapRef}>
        <button
          type="button"
          className="notification-button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <NotificationBell />
          {unread > 0 && <span className="doc-bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
        {open && (
          <div className="doc-bell-pop">
            <NotificationPanel onSeeAll={openFullHistory} />
          </div>
        )}
      </div>
      {showAll && <DoctorAllNotifications onClose={() => setShowAll(false)} onUnreadChange={refreshUnread} />}
    </>
  );
};

interface DoctorLoadingProps {
  label?: string;
  variant?: 'spinner' | 'skeleton';
  rows?: number;
}

/** One loading language for the portal: a spinner, or shimmering list rows. */
export const DoctorLoading: React.FC<DoctorLoadingProps> = ({
  label = 'Loading…',
  variant = 'spinner',
  rows = 4,
}) => {
  if (variant === 'skeleton') {
    return (
      <div className="doc-skeleton-list" role="status" aria-live="polite">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="doc-skeleton-row" key={index} aria-hidden="true">
            <span className="doc-skeleton doc-skeleton-avatar" />
            <span className="doc-skeleton-lines">
              <span className="doc-skeleton doc-skeleton-line is-wide" />
              <span className="doc-skeleton doc-skeleton-line is-narrow" />
            </span>
            <span className="doc-skeleton doc-skeleton-pill" />
          </div>
        ))}
        <p className="doc-skeleton-caption">{label}</p>
      </div>
    );
  }

  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
};

interface DoctorErrorProps {
  message: string;
  onRetry?: () => void;
}

/** Failure state with a consistent retry affordance. */
export const DoctorError: React.FC<DoctorErrorProps> = ({ message, onRetry }) => (
  <div className="error-state" role="alert">
    <p>{message}</p>
    {onRetry && (
      <button type="button" className="ghost-button" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

interface DoctorEmptyProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Illustrated empty state so zero rows still looks deliberate. */
export const DoctorEmpty: React.FC<DoctorEmptyProps> = ({ title, description, action }) => (
  <div className="doc-empty">
    <span className="doc-empty-mark" aria-hidden="true" />
    <p className="doc-empty-title">{title}</p>
    {description && <p className="doc-empty-text">{description}</p>}
    {action}
  </div>
);

/** Live result counter shown next to filters. */
export const DoctorResultCount: React.FC<{ shown: number; total: number; noun: string }> = ({
  shown,
  total,
  noun,
}) => (
  <p className="doc-result-count" aria-live="polite">
    Showing <strong>{shown}</strong> of <strong>{total}</strong> {noun}
  </p>
);

interface DoctorAllNotificationsProps {
  onClose: () => void;
  onUnreadChange: () => void;
}

/**
 * "See all" sheet: every notification the doctor can see, past → recent,
 * rendered in a portal so nothing in the page can paint over it.
 */
const DoctorAllNotifications: React.FC<DoctorAllNotificationsProps> = ({ onClose, onUnreadChange }) => {
  const [rows, setRows] = useState<FeedNotification[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
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
    if (isLoading || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [isLoading, rows]);

  const unread = rows.filter((row) => !row.read).length;

  const markAll = async () => {
    setIsMarking(true);
    setActionError('');
    try {
      await markAllNotificationsRead();
      setRows((current) => current.map((row) => ({ ...row, read: true })));
      onUnreadChange();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark notifications as read.');
    } finally {
      setIsMarking(false);
    }
  };

  return createPortal(
    <div
      className="doc-notif-overlay doctor-scope"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="doc-notif-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="All notifications"
        tabIndex={-1}
        ref={sheetRef}
      >
        <header className="doc-notif-sheet-head">
          <div>
            <h2 className="doc-notif-sheet-title">All notifications</h2>
            <p className="doc-notif-sheet-sub">Past to recent · {rows.length} shown</p>
          </div>
          <div className="doc-notif-sheet-actions">
            {!isLoading && !error && unread > 0 && (
              <button type="button" className="ghost-button" onClick={markAll} disabled={isMarking}>
                {isMarking ? 'Marking…' : 'Mark all as read'}
              </button>
            )}
            <button type="button" className="doc-notif-close" onClick={onClose} aria-label="Close notifications">
              ✕
            </button>
          </div>
        </header>

        <div className="doc-notif-sheet-body" ref={bodyRef}>
          {isLoading && <DoctorLoading label="Loading your notifications…" />}
          {!isLoading && error && (
            <DoctorError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
          )}
          {!isLoading && !error && actionError && <DoctorError message={actionError} />}
          {!isLoading && !error && rows.length === 0 && (
            <DoctorEmpty
              title="No notifications yet"
              description="Assessment alerts, appointment updates and weekly digests will appear here."
            />
          )}
          {!isLoading && !error && rows.length > 0 && (
            <ul className="doc-notif-list">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={`doc-notif-row is-${row.type}${row.read ? '' : ' is-unread'}`}
                >
                  <span className="doc-notif-dot" aria-hidden="true" />
                  <div className="doc-notif-row-body">
                    <div className="doc-notif-row-head">
                      <strong className="doc-notif-row-title">{row.title}</strong>
                      <time className="doc-notif-time" dateTime={row.createdAt}>
                        {notificationFullTime(row.createdAt)}
                      </time>
                    </div>
                    <p className="doc-notif-row-msg">{row.message}</p>
                  </div>
                  {!row.read && <span className="doc-notif-unread-tag">Unread</span>}
                </li>
              ))}
            </ul>
          )}
          {!isLoading && !error && hiddenCount > 0 && (
            <p className="notification-panel-note">
              {hiddenCount} hidden by your notification settings.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
