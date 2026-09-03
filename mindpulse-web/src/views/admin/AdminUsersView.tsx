import React, { FormEvent, useMemo, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';

interface AdminUsersViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'results' | 'analytics' | 'profile') => void;
}

type UserRole = 'Students' | 'Doctors';
type Account = {
  id: number;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  patients: string;
  year?: string;
  stressLevel?: 'Low' | 'Moderate' | 'High';
  status: 'Active' | 'Inactive';
};

const initialStudents: Account[] = [
  { id: 1, name: 'John Doe', email: 'johndoe@example.com', phone: '+1 234-567-8901', specialization: 'Computer Science', year: '3rd Year', stressLevel: 'Moderate', patients: '24', status: 'Active' },
  { id: 2, name: 'Sarah Smith', email: 'sarah.smith@example.com', phone: '+1 234-567-8902', specialization: 'Psychology', year: '4th Year', stressLevel: 'Low', patients: '18', status: 'Active' },
  { id: 3, name: 'Mike Johnson', email: 'mike.j@example.com', phone: '+1 234-567-8903', specialization: 'Engineering', year: '2nd Year', stressLevel: 'Moderate', patients: '12', status: 'Inactive' },
  { id: 9, name: 'Emma Wilson', email: 'emma.w@example.com', phone: '+1 234-567-8904', specialization: 'Information Technology', year: '1st Year', stressLevel: 'High', patients: '9', status: 'Active' },
  { id: 10, name: 'Alex Brown', email: 'alex.b@example.com', phone: '+1 234-567-8905', specialization: 'Biology', year: '2nd Year', stressLevel: 'Low', patients: '16', status: 'Active' },
];

const initialDoctors: Account[] = [
  { id: 4, name: 'Dr. John Doe', email: 'johndoe@example.com', phone: '+1 234-567-8901', specialization: 'Clinical Psychology', patients: '15', status: 'Active' },
  { id: 5, name: 'Dr. Sarah Smith', email: 'sarah.smith@example.com', phone: '+1 234-567-8902', specialization: 'Clinical Psychology', patients: '20', status: 'Active' },
  { id: 6, name: 'Dr. Mike Johnson', email: 'mike.j@example.com', phone: '+1 234-567-8903', specialization: 'Psychiatry', patients: '10', status: 'Inactive' },
  { id: 7, name: 'Dr. Emma Wilson', email: 'emma.w@example.com', phone: '+1 234-567-8904', specialization: 'Psychiatry', patients: '11', status: 'Active' },
  { id: 8, name: 'Dr. Alex Brown', email: 'alex.b@example.com', phone: '+1 234-567-8905', specialization: 'Counseling Psychology', patients: '24', status: 'Active' },
];

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ onSignOut, onNavigate }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('Doctors');
  const [students, setStudents] = useState(initialStudents);
  const [doctors, setDoctors] = useState(initialDoctors);
  const [search, setSearch] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addRole, setAddRole] = useState<UserRole | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(['System is ready. New account activity will appear here.']);

  const accounts = activeRole === 'Doctors' ? doctors : students;
  const filteredAccounts = useMemo(() => accounts.filter((account) =>
    `${account.name} ${account.email} ${account.specialization}`.toLowerCase().includes(search.toLowerCase()),
  ), [accounts, search]);

  const openAddForm = (role: UserRole) => {
    setAddRole(role);
    setShowAddMenu(false);
  };

  const addAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const account: Account = {
      id: Date.now(),
      name: String(form.get('name')),
      email: String(form.get('email')),
      phone: String(form.get('phone') || 'Not provided'),
      specialization: addRole === 'Doctors' ? String(form.get('specialization') || 'General Practice') : String(form.get('program') || 'Undeclared'),
      year: addRole === 'Students' ? String(form.get('year') || '1st Year') : undefined,
      stressLevel: addRole === 'Students' ? 'Low' : undefined,
      patients: addRole === 'Doctors' ? '0' : '0',
      status: 'Active',
    };
    if (addRole === 'Doctors') setDoctors((current) => [...current, account]);
    else setStudents((current) => [...current, account]);
    setNotifications((current) => [`${account.name} was added as a ${addRole === 'Doctors' ? 'doctor' : 'student'}.`, ...current]);
    setActiveRole(addRole as UserRole);
    setAddRole(null);
  };

  const removeAccount = (account: Account) => {
    if (!window.confirm(`Remove ${account.name}?`)) return;
    if (activeRole === 'Doctors') setDoctors((current) => current.filter((item) => item.id !== account.id));
    else setStudents((current) => current.filter((item) => item.id !== account.id));
    setNotifications((current) => [`${account.name} was removed.`, ...current]);
  };

  return (
    <div className="doctor-shell">
      <AdminSidebar onSignOut={onSignOut} activeView="users" onNavigate={onNavigate} />
      <main className="main-panel admin-users-main">
        <header className="topbar admin-users-topbar">
          <div><div className="eyebrow">System Management</div><h1>Manage {activeRole === 'Doctors' ? 'Doctor' : 'Student'} Accounts</h1><p className="page-subtitle">View, add, edit, and manage {activeRole.toLowerCase()} accounts</p></div>
          <div className="account-actions">
            <div className="add-account-wrap"><button type="button" className="add-account-button" onClick={() => setShowAddMenu((open) => !open)}>＋ Add {activeRole === 'Doctors' ? 'Doctor' : 'Student'}</button>{showAddMenu && <div className="add-account-menu"><button type="button" onClick={() => openAddForm('Students')}>＋ Add Student</button><button type="button" onClick={() => openAddForm('Doctors')}>＋ Add Doctor</button></div>}</div>
            <button type="button" className="notification-button" aria-label="View notifications" onClick={() => setShowNotifications((open) => !open)}>🔔<span className="notification-dot">{notifications.length}</span></button>
            {showNotifications && <aside className="notification-panel"><div className="notification-heading"><strong>Notifications</strong><button type="button" onClick={() => setNotifications([])}>Clear</button></div>{notifications.length ? notifications.map((notification, index) => <div className="notification-item" key={`${notification}-${index}`}><span className="notification-symbol">●</span><span>{notification}</span></div>) : <p className="empty-notifications">No new notifications</p>}</aside>}
          </div>
        </header>

        <section className="user-summary-grid"><Summary label="Total Users" value={activeRole === 'Doctors' ? '2,847' : '12,430'} /><Summary label="Active Today" value={activeRole === 'Doctors' ? '1,243' : '8,691'} /><Summary label="New This Week" value={activeRole === 'Doctors' ? '127' : '342'} /><Summary label="Inactive" value={activeRole === 'Doctors' ? '89' : '214'} /></section>

        <section className="content-panel account-list-panel">
          <div className="account-list-toolbar"><div className="role-tabs"><button type="button" className={activeRole === 'Students' ? 'role-tab active' : 'role-tab'} onClick={() => setActiveRole('Students')}>Students</button><button type="button" className={activeRole === 'Doctors' ? 'role-tab active' : 'role-tab'} onClick={() => setActiveRole('Doctors')}>Doctors</button></div><label className="doctor-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeRole.toLowerCase()} name`} /></label></div>
          <div className="table-wrap"><table className="data-table account-table"><thead><tr><th>{activeRole === 'Doctors' ? 'Doctor' : 'Student'}</th><th>Contact</th><th>{activeRole === 'Doctors' ? 'Specialization' : 'Program'}</th>{activeRole === 'Students' && <th>Year</th>}{activeRole === 'Students' && <th>Stress Level</th>}{activeRole === 'Doctors' && <th>Patients</th>}<th>Status</th><th>Actions</th></tr></thead><tbody>{filteredAccounts.map((account) => <tr key={account.id}><td><div className="account-name-cell"><span className="account-avatar">●</span><strong>{account.name}</strong></div></td><td><span className="contact-cell">✉ {account.email}</span><span className="contact-cell">☎ {account.phone}</span></td><td>{account.specialization}</td>{activeRole === 'Students' && <td>{account.year}</td>}{activeRole === 'Students' && <td><span className={`status-pill status-${account.stressLevel?.toLowerCase()}`}>{account.stressLevel}</span></td>}{activeRole === 'Doctors' && <td>{account.patients}</td>}<td><span className={`status-pill status-${account.status.toLowerCase()}`}>{account.status}</span></td><td><button type="button" className="icon-action" aria-label={`Edit ${account.name}`}>✎</button><button type="button" className="icon-action delete" aria-label={`Remove ${account.name}`} onClick={() => removeAccount(account)}>🗑️</button></td></tr>)}</tbody></table>{filteredAccounts.length === 0 && <p className="empty-table">No accounts match your search.</p>}</div>
        </section>
      </main>

      {addRole && <div className="modal-backdrop" role="presentation"><form className="account-modal" onSubmit={addAccount}><div className="modal-heading"><div><span className="eyebrow">New account</span><h2>Add {addRole === 'Doctors' ? 'Doctor' : 'Student'}</h2></div><button type="button" className="modal-close" aria-label="Close" onClick={() => setAddRole(null)}>×</button></div><label>Name<input name="name" required placeholder={addRole === 'Doctors' ? 'Dr. Jane Smith' : 'Jane Smith'} /></label><label>Email<input name="email" type="email" required placeholder="name@example.com" /></label><label>Phone<input name="phone" placeholder="+1 234-567-8900" /></label>{addRole === 'Doctors' ? <label>Specialization<input name="specialization" required placeholder="Clinical Psychology" /></label> : <><label>Program<input name="program" required placeholder="Computer Science" /></label><label>Year<select name="year" defaultValue="1st Year"><option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option></select></label></>}<button type="submit" className="primary-button">Add {addRole === 'Doctors' ? 'Doctor' : 'Student'}</button></form></div>}
    </div>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => <article className="user-summary-card"><span>{label}</span><strong>{value}</strong></article>;
