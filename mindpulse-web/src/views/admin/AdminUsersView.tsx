import React, { useEffect, useMemo, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminAccountRow, approveDoctor, denyDoctor, fetchAdminAccounts, setDoctorVerified } from '../../services/admin';
import { requireUserId } from '../../services/session';
import './AdminUsersView.css';

interface AdminUsersViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'analytics' | 'profile' | 'settings') => void;
}

type UserRole = 'Students' | 'Doctors';

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ onSignOut, onNavigate }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('Doctors');
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    requireUserId()
      .then((id) => {
        if (active) setMyId(id);
      })
      .catch(() => {
        if (active) setMyId(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchAdminAccounts(activeRole === 'Doctors' ? 'doctor' : 'student')
      .then((rows) => {
        if (active) setAccounts(rows);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load accounts.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeRole, reloadKey]);

  const filteredAccounts = useMemo(() => accounts.filter((account) =>
    `${account.name} ${account.email} ${account.program}`.toLowerCase().includes(search.toLowerCase()),
  ), [accounts, search]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = accounts.filter((account) => new Date(account.createdAt).getTime() >= weekAgo).length;
  const activeAccounts = accounts.filter((account) =>
    activeRole === 'Doctors' ? account.isVerified : account.onboardingComplete,
  ).length;
  const pendingAccounts = accounts.length - activeAccounts;

  const runAction = async (row: AdminAccountRow, action: () => Promise<void>) => {
    setActionError('');
    setBusyId(row.id);
    try {
      await action();
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'That action could not be completed.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleVerified = (row: AdminAccountRow) =>
    runAction(row, () => setDoctorVerified(row.id, !row.isVerified));

  const approveRegistration = (row: AdminAccountRow) =>
    runAction(row, () => approveDoctor(row.id));

  const denyRegistration = (row: AdminAccountRow) => {
    const verb = row.isVerified ? 'Remove' : 'Deny';
    if (!window.confirm(`${verb} ${row.name}'s account? This cannot be undone.`)) return;
    runAction(row, () => denyDoctor(row.id));
  };

  const selectRole = (role: UserRole) => {
    setActiveRole(role);
    setActionError('');
    setSearch('');
  };

  return (
    <div className="doctor-shell admin-scope">
      <AdminSidebar onSignOut={onSignOut} activeView="users" onNavigate={onNavigate} />
      <main className="main-panel admin-users-main">
        <header className="topbar admin-users-topbar">
          <div><div className="eyebrow">System Management</div><h1>Manage {activeRole === 'Doctors' ? 'Doctor' : 'Student'} Accounts</h1><p className="page-subtitle">Review and manage {activeRole.toLowerCase()} accounts</p></div>
          <div className="account-actions">
            <button type="button" className="notification-button" aria-label="View notifications" onClick={() => setShowNotifications((open) => !open)}><NotificationBell /></button>
            {showNotifications && <NotificationPanel />}
          </div>
        </header>

        {!isLoading && !loadError && (
          <section className="user-summary-grid">
            <Summary label="Total Accounts" value={String(accounts.length)} />
            <Summary label="New This Week" value={String(newThisWeek)} />
            <Summary label="Active" value={String(activeAccounts)} />
            <Summary label="Pending" value={String(pendingAccounts)} />
          </section>
        )}

        <section className="content-panel account-list-panel">
          <div className="account-list-toolbar"><div className="role-tabs"><button type="button" className={activeRole === 'Students' ? 'role-tab active' : 'role-tab'} onClick={() => selectRole('Students')}>Students</button><button type="button" className={activeRole === 'Doctors' ? 'role-tab active' : 'role-tab'} onClick={() => selectRole('Doctors')}>Doctors</button></div><label className="doctor-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeRole.toLowerCase()} name`} /></label></div>
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
              <table className="data-table account-table">
                <thead><tr><th>{activeRole === 'Doctors' ? 'Doctor' : 'Student'}</th><th>Contact</th><th>{activeRole === 'Doctors' ? 'Specialization' : 'Program'}</th>{activeRole === 'Students' && <th>Year</th>}{activeRole === 'Students' && <th>Stress Level</th>}{activeRole === 'Doctors' && <th>Patients</th>}<th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredAccounts.map((account) => {
                    const isSelf = myId !== null && account.id === myId;
                    const status = activeRole === 'Doctors'
                      ? (account.isVerified ? 'Active' : 'Pending')
                      : (account.onboardingComplete ? 'Active' : 'Pending');
                    const busy = busyId === account.id;
                    return (
                      <tr key={account.id}>
                        <td><div className="account-name-cell"><span className="account-avatar">{account.initials}</span><strong>{account.name}</strong></div></td>
                        <td>
                          <span className="contact-cell">✉ {account.email}</span>
                          {activeRole === 'Doctors' && account.licenseNo && (
                            <span className="contact-cell" style={{ display: 'block' }}>
                              🪪 {account.licenseNo}
                            </span>
                          )}
                        </td>
                        <td>{account.program}</td>
                        {activeRole === 'Students' && <td>{account.year}</td>}
                        {activeRole === 'Students' && (
                          <td>
                            {account.latestLevel
                              ? <span className={`status-pill status-${account.latestLevel.toLowerCase()}`}>{account.latestLevel}{account.latestScore != null ? ` (${account.latestScore})` : ''}</span>
                              : <span>—</span>}
                          </td>
                        )}
                        {activeRole === 'Doctors' && <td>{account.patients}</td>}
                        <td><span className={`status-pill status-${status.toLowerCase()}`}>{status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {activeRole === 'Doctors' && !account.isVerified && (
                              <button type="button" className="view-details-button" disabled={isSelf || busy} onClick={() => approveRegistration(account)}>
                                {busy ? 'Working…' : 'Approve'}
                              </button>
                            )}
                            {activeRole === 'Doctors' && (
                              <button type="button" className="table-action" disabled={isSelf || busy} onClick={() => denyRegistration(account)}>
                                {account.isVerified ? 'Remove' : 'Deny'}
                              </button>
                            )}
                            {activeRole === 'Doctors' && account.isVerified && (
                              <button type="button" className="view-details-button" disabled={isSelf || busy} onClick={() => toggleVerified(account)}>
                                Unverify
                              </button>
                            )}
                            {activeRole === 'Students' && <span style={{ color: '#94a3b8' }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredAccounts.length === 0 && <p className="empty-table">{search ? 'No accounts match your search.' : `No ${activeRole.toLowerCase()} accounts yet.`}</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => <article className="user-summary-card"><span>{label}</span><strong>{value}</strong></article>;
