import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationBell } from '../NotificationBell';
import { NotificationPanel } from '../NotificationPanel';
import { NotificationHistorySheet } from '../NotificationHistorySheet';
import { fetchUnreadNotificationCount } from '../../services/notifications';

/**
 * Notification bell shared by every doctor view: real unread badge, dropdown
 * fed by the notifications table, and closes on outside click or Escape.
 * Rows and "See all" open the shared past â†’ recent history popup.
 */
export const DoctorNotifications: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
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

  const openFullHistory = (initialId?: string) => {
    setOpen(false);
    setHistoryId(initialId ?? null);
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
      {showAll && (
        <NotificationHistorySheet
          scope="doctor"
          initialId={historyId ?? undefined}
          onClose={() => setShowAll(false)}
          onChanged={refreshUnread}
        />
      )}
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
  label = 'Loadingâ€¦',
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

