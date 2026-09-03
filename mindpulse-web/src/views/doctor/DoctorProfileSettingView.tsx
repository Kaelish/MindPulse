import React, { FormEvent, useEffect, useState } from 'react';
import { DEFAULT_DOCTOR_ID, DoctorProfileData, fetchDoctorProfile, initialDoctorData, saveDoctorProfile } from '../../services/doctorProfile';

type ProfileTab = 'personal' | 'credentials' | 'security' | 'notifications';

export const DoctorProfileSettingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [profile, setProfile] = useState<DoctorProfileData>(initialDoctorData);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [caseAssignments, setCaseAssignments] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchDoctorProfile(DEFAULT_DOCTOR_ID).then((data) => { if (mounted) { setProfile(data); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const update = (key: keyof DoctorProfileData, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    const result = await saveDoctorProfile(profile); setSaving(false); setEditing(false);
    setSaved(result.success ? 'Changes saved successfully.' : `Failed to save: ${result.message}`);
    window.setTimeout(() => setSaved(null), 3000);
  };
  const saveAction = (message: string) => { setSaved(message); window.setTimeout(() => setSaved(null), 3000); };

  return <main className="main-panel doctor-profile-main">
    <header className="doctor-profile-header"><div><h1>Profile Setting</h1><p>Manage your personal and professional information</p></div><button type="button" className="notification-button" aria-label="Notifications">🔔</button></header>
    <section className="doctor-profile-card"><div className="doctor-avatar-large">●</div><div className="doctor-profile-identity"><h2>DR. {profile.firstName.toUpperCase()} {profile.lastName.toUpperCase()}</h2><span>{profile.specialty}</span><p>✉ {profile.email} &nbsp;&nbsp; ☎ {profile.phone} &nbsp;&nbsp; ♙ {profile.licenseId}</p></div>{(activeTab === 'personal' || activeTab === 'credentials') && <button type="button" className="profile-edit-button" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel Edit' : '✎ Edit Profile'}</button>}</section>
    <nav className="doctor-profile-tabs" aria-label="Doctor profile sections">{([['personal', 'Personal Information'], ['credentials', 'Professional Credentials'], ['security', 'Security'], ['notifications', 'Notifications']] as const).map(([key, label]) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => { setActiveTab(key); setEditing(false); setSaved(null); }}>{label}</button>)}</nav>
    {saved && <div className="profile-save-banner">{saved}</div>}
    {loading ? <div className="doctor-profile-loading">Loading doctor profile...</div> : <form className="doctor-profile-form" onSubmit={saveProfile}>
      {activeTab === 'personal' && <ProfileSection title="Personal Information"><Field label="First Name" value={profile.firstName} editing={editing} onChange={(value) => update('firstName', value)} /><Field label="Last Name" value={profile.lastName} editing={editing} onChange={(value) => update('lastName', value)} /><Field label="Email Address" value={profile.email} editing={editing} onChange={(value) => update('email', value)} type="email" /><Field label="Phone Number" value={profile.phone} editing={editing} onChange={(value) => update('phone', value)} /><Field label="Date Of Birth" value={profile.dob} editing={editing} onChange={(value) => update('dob', value)} /><Field label="Gender" value={profile.gender} editing={editing} onChange={(value) => update('gender', value)} /><Field label="Street Address" value={profile.streetAddress} editing={editing} onChange={(value) => update('streetAddress', value)} full /></ProfileSection>}
      {activeTab === 'credentials' && <ProfileSection title="Professional Credentials"><Field label="Professional Title" value="Dr." editing={editing} /><Field label="Position" value={profile.specialty} editing={editing} onChange={(value) => update('specialty', value)} /><Field label="Department" value="Mental Health Services" editing={editing} /><Field label="License Number" value={profile.licenseId} editing={editing} onChange={(value) => update('licenseId', value)} /><Field label="Specialization" value="Cognitive Behavioral Therapy" editing={editing} /><Field label="Years of Experience" value="12" editing={editing} /><Field label="Start Date" value="15/03/2022" editing={editing} /></ProfileSection>}
      {activeTab === 'security' && <ProfileSection title="Security"><Field label="Current Password" value={currentPassword} editing onChange={setCurrentPassword} type="password" placeholder="Enter current password" /><Field label="New Password" value={newPassword} editing onChange={setNewPassword} type="password" placeholder="Enter new password" /><Field label="Confirm New Password" value={confirmPassword} editing onChange={setConfirmPassword} type="password" placeholder="Confirm new password" /><div className="security-divider" /><h3>Two-Factor Authentication</h3><p className="form-helper">Add an extra layer of security to your account.</p><Toggle label="Two-factor authentication" description="Require a verification code when signing in" value={true} onChange={() => undefined} /></ProfileSection>}
      {activeTab === 'notifications' && <ProfileSection title="Notification Preferences"><Toggle label="Email Notifications" description="Receive notifications via email" value={emailNotifications} onChange={setEmailNotifications} /><Toggle label="Push Notifications" description="Receive push notifications in your browser" value={pushNotifications} onChange={setPushNotifications} /><Toggle label="SMS Notifications" description="Receive notifications via text message" value={smsNotifications} onChange={setSmsNotifications} /><Toggle label="New Case Assignments" description="Get notified when new cases are assigned" value={caseAssignments} onChange={setCaseAssignments} /></ProfileSection>}
      {activeTab === 'personal' && editing && <button type="submit" className="small-profile-button" disabled={saving}>{saving ? 'Saving...' : '▣ Save Changes'}</button>}
      {activeTab === 'credentials' && editing && <button type="submit" className="small-profile-button" disabled={saving}>{saving ? 'Saving...' : '▣ Save Changes'}</button>}
      {activeTab === 'security' && <button type="button" className="small-profile-button" onClick={() => saveAction('Password updated successfully.')}>♧ Change Password</button>}
      {activeTab === 'notifications' && <button type="button" className="small-profile-button" onClick={() => saveAction('Notification preferences saved.')}>▣ Save Preferences</button>}
    </form>}
  </main>;
};

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="doctor-profile-section"><h2>{title}</h2><div className="doctor-profile-fields">{children}</div></section>;
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange?: (value: string) => void; full?: boolean; type?: string; placeholder?: string }> = ({ label, value, editing, onChange, full, type = 'text', placeholder }) => <label className={`doctor-profile-field ${full ? 'full' : ''}`}><span>{label}</span><input type={type} value={value} placeholder={placeholder} readOnly={!editing} onChange={(event) => onChange?.(event.target.value)} /></label>;
const Toggle: React.FC<{ label: string; description: string; value: boolean; onChange: (value: boolean) => void }> = ({ label, description, value, onChange }) => <label className="doctor-profile-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
