import React, { useEffect, useMemo, useState } from 'react';
import { TrashItem, TrashTable, fetchTrash, formatDeletedAt, restoreTrash } from '../services/trash';
import './RecentlyDeletedPanel.css';

export interface TrashCategory {
  value: TrashTable;
  label: string;
}

/** Every table an administrator may browse in Recently Deleted. */
export const ADMIN_TRASH_CATEGORIES: TrashCategory[] = [
  { value: 'stress_sessions', label: 'Assessment sessions' },
  { value: 'profiles', label: 'Accounts' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'recommendations', label: 'Recommendations' },
  { value: 'patient_files', label: 'Patient files' },
  { value: 'doctor_suggestions', label: 'Doctor suggestions' },
  { value: 'consultation_notes', label: 'Consultation notes' },
  { value: 'chat_messages', label: 'Chat messages' },
  { value: 'video_sessions', label: 'Video sessions' },
  { value: 'payments', label: 'Payments' },
];

/** Tables a doctor may browse in Recently Deleted (their own records only, per RLS). */
export const DOCTOR_TRASH_CATEGORIES: TrashCategory[] = [
  { value: 'stress_sessions', label: 'Assessment sessions' },
  { value: 'consultation_notes', label: 'Consultation notes' },
  { value: 'recommendations', label: 'Recommendations' },
  { value: 'doctor_suggestions', label: 'Doctor suggestions' },
  { value: 'patient_files', label: 'Patient files' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'appointments', label: 'Appointments' },
];

interface RecentlyDeletedPanelProps {
  categories: TrashCategory[];
}

/**
 * Shared Recently Deleted table: category picker, multi-select, and restore.
 * Wrapped by AdminTrashView (admin shell) and DoctorTrashView (doctor shell).
 */
export const RecentlyDeletedPanel: React.FC<RecentlyDeletedPanelProps> = ({ categories }) => {
  const [category, setCategory] = useState<TrashTable>(categories[0]?.value ?? 'stress_sessions');
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  // Keep the picker valid if the caller swaps its category list.
  useEffect(() => {
    if (!categories.some((entry) => entry.value === category)) {
      setCategory(categories[0]?.value ?? 'stress_sessions');
    }
  }, [categories, category]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    setActionError('');
    setNotice('');
    setSelected(new Set());
    fetchTrash(category)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load deleted records.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, reloadKey]);

  const allSelected = items.length > 0 && selected.size === items.length;

  const toggle = (id: string) => {
    setNotice('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restore = async (targets: TrashItem[]) => {
    if (!targets.length) return;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const count = await restoreTrash(targets);
      setNotice(`${count} record${count === 1 ? '' : 's'} restored and visible again.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Those records could not be restored.');
    } finally {
      setBusy(false);
    }
  };

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(`${item.table}:${item.id}`)),
    [items, selected],
  );

  const rowKey = (item: TrashItem) => `${item.table}:${item.id}`;
  const categoryLabel = categories.find((entry) => entry.value === category)?.label ?? category;

  return (
    <section className="content-panel admin-trash-panel">
      <div className="admin-trash-toolbar">
        <label className="admin-trash-picker">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as TrashTable)}>
            {categories.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-trash-bulk">
          <button
            type="button"
            className="view-details-button"
            disabled={busy || items.length === 0}
            onClick={() => setSelected(allSelected ? new Set() : new Set(items.map(rowKey)))}
          >
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
          <button
            type="button"
            className="primary-button admin-trash-restore"
            disabled={busy || selectedItems.length === 0}
            onClick={() => void restore(selectedItems)}
          >
            {busy ? 'Restoring…' : `Restore selected${selectedItems.length ? ` (${selectedItems.length})` : ''}`}
          </button>
        </div>
      </div>

      {notice && <p className="admin-trash-notice" role="status">{notice}</p>}
      {actionError && <p className="error-inline">{actionError}</p>}
      {isLoading && <div className="loading-state"><span className="spinner" /></div>}
      {loadError && (
        <div className="error-state">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      )}

      {!isLoading && !loadError && (
        <div className="table-wrap">
          <table className="data-table admin-trash-table">
            <thead>
              <tr>
                <th className="admin-trash-check">
                  <input
                    type="checkbox"
                    aria-label="Select all deleted records"
                    checked={allSelected}
                    disabled={items.length === 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(items.map(rowKey)))}
                  />
                </th>
                <th>Record</th>
                <th>Details</th>
                <th>Deleted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const key = rowKey(item);
                return (
                  <tr key={key}>
                    <td className="admin-trash-check">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.label}`}
                        checked={selected.has(key)}
                        onChange={() => toggle(item.id)}
                      />
                    </td>
                    <td><strong>{item.label}</strong></td>
                    <td>{item.detail ?? '—'}</td>
                    <td>{formatDeletedAt(item.deletedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="view-details-button"
                        disabled={busy}
                        onClick={() => void restore([item])}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="empty-table">Nothing deleted in {categoryLabel.toLowerCase()} yet.</p>
          )}
        </div>
      )}
    </section>
  );
};
