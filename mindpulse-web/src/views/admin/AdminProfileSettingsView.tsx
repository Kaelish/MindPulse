import React, { FormEvent, useState } from 'react';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';

type ProfileTab = 'personal' | 'professional' | 'security' | 'notifications';

interface AdminProfileSettingsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'results' | 'analytics' | 'profile') => void;
}

export const AdminProfileSettingsView: React.FC<AdminProfileSettingsViewProps> = ({ onSignOut, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(true);
    setEditing(false);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return <div className="admin-shell admin-profile-shell">
    <AdminSidebar onSignOut={onSignOut} activeView="profile" onNavigate={onNavigate} />
    <main className="admin-main admin-profile-main">
      <header className="admin-profile-header"><div><h1>Profile Settings</h1><p>Manage your personal information and preferences</p></div><button type="button" className="notification-button" aria-label="Notifications">🔔</button></header>
      <section className="admin-profile-card"><div className="admin-avatar-large">●</div><div className="admin-profile-identity"><h2>Admin User</h2><span>System Administrator</span><p>✉ admin@mindpulse.com &nbsp;&nbsp; ☎ +1 (555) 123-4567 &nbsp;&nbsp; ▣ IT &amp; Technology</p></div>{(activeTab === 'personal' || activeTab === 'professional') && <button type="button" className="profile-edit-button" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel Edit' : '✎ Edit Profile'}</button>}</section>
      <nav className="admin-profile-tabs" aria-label="Profile settings sections">{([['personal', 'Personal Information'], ['professional', 'Professional Details'], ['security', 'Security'], ['notifications', 'Notifications']] as const).map(([key, label]) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => { setActiveTab(key); setSaved(false); }}>{label}</button>)}</nav>
      {saved && <div className="profile-save-banner">Changes saved successfully.</div>}
      <form className="admin-profile-form" onSubmit={save}>
        {activeTab === 'personal' && <ProfileSection title="Personal Information"><Field label="First Name" value="Admin" editing={editing} /><Field label="Last Name" value="User" editing={editing} /><Field label="Email Address" value="admin@mindpulse.com" editing={editing} /><Field label="Phone Number" value="+1 (555) 123-4567" editing={editing} /><Field label="Date Of Birth" value="05/15/2000" editing={editing} /><Field label="Gender" value="Male" editing={editing} /><Field label="Street Address" value="123 Nowhere" editing={editing} full /><Field label="City" value="Cebu City" editing={editing} /><Field label="State/Province" value="Cebu" editing={editing} /><Field label="Zip/Postal Code" value="6000" editing={editing} /><Field label="State/Country" value="Philippines" editing={editing} /></ProfileSection>}
        {activeTab === 'professional' && <ProfileSection title="Professional Details"><Field label="Position/Title" value="System Administrator" editing={editing} /><Field label="Department" value="IT & Technology" editing={editing} /><Field label="Employee ID" value="EMP-2024-001" editing={editing} /><Field label="Start Date" value="01/15/2024" editing={editing} /><Field label="Qualification" value="Bachelor of Science in Information Technology" editing={editing} /><Field label="Specialization" value="System Administration" editing={editing} /></ProfileSection>}
        {activeTab === 'security' && <ProfileSection title="Change Password"><Field label="Current Password" value="" editing={true} placeholder="Enter current password" password /><Field label="New Password" value="" editing={true} placeholder="Enter new password" password /><Field label="Confirm New Password" value="" editing={true} placeholder="Confirm new password" password /><div className="security-divider" /><h3>Two-Factor Authentication</h3><p className="form-helper">Add an extra layer of security to your account.</p><button type="button" className="small-profile-button">Enable 2FA</button></ProfileSection>}
        {activeTab === 'notifications' && <ProfileSection title="Notification Preferences"><Toggle label="Email Notifications" description="Receive notifications via email" value={emailNotifications} onChange={setEmailNotifications} /><Toggle label="Push Notifications" description="Receive push notifications in your browser" value={pushNotifications} onChange={setPushNotifications} /><Toggle label="SMS Notifications" description="Receive notifications via text message" value={smsNotifications} onChange={setSmsNotifications} /><Toggle label="Weekly Reports" description="Receive weekly summary reports" value={weeklyReports} onChange={setWeeklyReports} /><Toggle label="Critical Alerts" description="Receive alerts for high-risk cases" value={criticalAlerts} onChange={setCriticalAlerts} /></ProfileSection>}
        {(activeTab === 'personal' || activeTab === 'professional') && editing && <button type="submit" className="small-profile-button">▣ Save Changes</button>}
        {activeTab === 'security' && <button type="submit" className="small-profile-button">♧ Change Password</button>}
        {activeTab === 'notifications' && <button type="submit" className="small-profile-button">▣ Save Preferences</button>}
      </form>
    </main>
  </div>;
};

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="admin-profile-section"><h2>{title}</h2><div className="profile-fields">{children}</div></section>;
const Field: React.FC<{ label: string; value: string; editing: boolean; full?: boolean; placeholder?: string; password?: boolean }> = ({ label, value, editing, full, placeholder, password }) => <label className={`profile-field ${full ? 'full' : ''}`}><span>{label}</span><input type={password ? 'password' : 'text'} defaultValue={value} placeholder={placeholder} readOnly={!editing} /></label>;
const Toggle: React.FC<{ label: string; description: string; value: boolean; onChange: (value: boolean) => void }> = ({ label, description, value, onChange }) => <label className="profile-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
