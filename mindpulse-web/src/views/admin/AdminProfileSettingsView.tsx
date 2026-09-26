import React, { FormEvent, useEffect, useState } from 'react';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { OwnProfile, OwnProfilePatch, changeOwnPassword, fetchOwnProfile, updateOwnProfile } from '../../services/profile';
import { passwordPolicyError } from '../../services/adminSettings';

type ProfileTab = 'personal' | 'professional' | 'security';

type EditableField = 'first_name' | 'last_name' | 'department' | 'program' | 'year_level' | 'student_no' | 'sex' | 'living_situation';

type ProfileDraft = Record<EditableField, string>;

const EDITABLE_FIELDS: EditableField[] = ['first_name', 'last_name', 'department', 'program', 'year_level', 'student_no', 'sex', 'living_situation'];

const EMPTY_DRAFT: ProfileDraft = {
  first_name: '',
  last_name: '',
  department: '',
  program: '',
  year_level: '',
  student_no: '',
  sex: '',
  living_situation: '',
};

const toDraft = (profile: OwnProfile): ProfileDraft => ({
  first_name: profile.first_name ?? '',
  last_name: profile.last_name ?? '',
  department: profile.department ?? '',
  program: profile.program ?? '',
  year_level: profile.year_level ?? '',
  student_no: profile.student_no ?? '',
  sex: profile.sex ?? '',
  living_situation: profile.living_situation ?? '',
});

const formatDate = (value: string) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

interface AdminProfileSettingsViewProps {
  onSignOut: () => void;
  onNavigate: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'analytics' | 'profile' | 'settings') => void;
}

export const AdminProfileSettingsView: React.FC<AdminProfileSettingsViewProps> = ({ onSignOut, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [saveError, setSaveError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchOwnProfile()
      .then((data) => {
        if (active) {
          setProfile(data);
          setDraft(toDraft(data));
        }
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your profile.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const updateDraft = (field: EditableField, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    if (activeTab !== 'security' && !editing) return;
    setSaved('');
    setSaveError('');

    if (activeTab === 'security') {
      const policyError = passwordPolicyError(newPassword);
      if (policyError) {
        setSaveError(policyError);
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveError('New passwords do not match.');
        return;
      }
      setSaving(true);
      try {
        await changeOwnPassword(newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSaved('Password updated successfully.');
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Unable to update your password.');
      } finally {
        setSaving(false);
      }
      return;
    }

    const patch: OwnProfilePatch = {};
    EDITABLE_FIELDS.forEach((field) => {
      if ((draft[field] ?? '') !== (profile[field] ?? '')) {
        patch[field] = draft[field] === '' ? null : draft[field];
      }
    });
    if (Object.keys(patch).length === 0) {
      setSaved('No changes to save.');
      return;
    }
    setSaving(true);
    try {
      await updateOwnProfile(patch);
      setProfile((current) => (current ? { ...current, ...patch } : current));
      setEditing(false);
      setSaved('Changes saved successfully.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <header className="admin-profile-header">
      <div><h1>Profile Settings</h1><p>Manage your personal information and preferences</p></div>
      <div className="account-actions">
        <button type="button" className="notification-button" aria-label="Notifications" onClick={() => setShowNotifications((open) => !open)}><NotificationBell /></button>
        {showNotifications && <NotificationPanel />}
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <div className="admin-shell admin-scope admin-profile-shell">
        <AdminSidebar onSignOut={onSignOut} activeView="profile" onNavigate={onNavigate} />
        <main className="admin-main admin-profile-main">
          {header}
          <div className="loading-state"><span className="spinner" /></div>
        </main>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="admin-shell admin-scope admin-profile-shell">
        <AdminSidebar onSignOut={onSignOut} activeView="profile" onNavigate={onNavigate} />
        <main className="admin-main admin-profile-main">
          {header}
          <div className="error-state">
            <p>{loadError || 'Your profile could not be loaded.'}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
          </div>
        </main>
      </div>
    );
  }

  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  const identityName = fullName || profile.email || 'Your account';
  const roleLabel = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
  const showStudentFields = profile.role === 'student'
    || Boolean(profile.student_no || profile.program || profile.year_level);

  return <div className="admin-shell admin-scope admin-profile-shell">
    <AdminSidebar onSignOut={onSignOut} activeView="profile" onNavigate={onNavigate} />
    <main className="admin-main admin-profile-main">
      {header}
      <section className="admin-profile-card"><div className="admin-avatar-large">●</div><div className="admin-profile-identity"><h2>{identityName}</h2><span>{roleLabel}</span><p>✉ {profile.email || 'No email'} &nbsp;&nbsp; ▣ {profile.department || 'No department'}</p></div>{(activeTab === 'personal' || activeTab === 'professional') && <button type="button" className="profile-edit-button" onClick={() => { setEditing((value) => !value); setSaved(''); setSaveError(''); }}>{editing ? 'Cancel Edit' : '✎ Edit Profile'}</button>}</section>
      <nav className="admin-profile-tabs" aria-label="Profile settings sections">{([['personal', 'Personal Information'], ['professional', 'Professional Details'], ['security', 'Security']] as const).map(([key, label]) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => { setActiveTab(key); setEditing(false); setSaved(''); setSaveError(''); }}>{label}</button>)}</nav>
      {saved && <div className="profile-save-banner">{saved}</div>}
      {saveError && <div className="error-inline">{saveError}</div>}
      <form className="admin-profile-form" onSubmit={save}>
        {activeTab === 'personal' && <ProfileSection title="Personal Information">
          <Field label="First Name" value={draft.first_name} editing={editing} onChange={(value) => updateDraft('first_name', value)} />
          <Field label="Last Name" value={draft.last_name} editing={editing} onChange={(value) => updateDraft('last_name', value)} />
          <Field label="Email Address" value={profile.email || ''} editing={false} placeholder="No email" />
          <Field label="Department" value={draft.department} editing={editing} onChange={(value) => updateDraft('department', value)} placeholder="Not set" />
          <Field label="Gender" value={draft.sex} editing={editing} onChange={(value) => updateDraft('sex', value)} placeholder="Not set" />
          <Field label="Living Situation" value={draft.living_situation} editing={editing} onChange={(value) => updateDraft('living_situation', value)} placeholder="Not set" />
          {profile.birth_date && <Field label="Date Of Birth" value={formatDate(profile.birth_date)} editing={false} />}
          {showStudentFields && <><Field label="Student Number" value={draft.student_no} editing={editing} onChange={(value) => updateDraft('student_no', value)} placeholder="Not set" /><Field label="Program" value={draft.program} editing={editing} onChange={(value) => updateDraft('program', value)} placeholder="Not set" /><Field label="Year Level" value={draft.year_level} editing={editing} onChange={(value) => updateDraft('year_level', value)} placeholder="Not set" /></>}
        </ProfileSection>}
        {activeTab === 'professional' && <ProfileSection title="Professional Details">
          <Field label="Department" value={draft.department} editing={editing} onChange={(value) => updateDraft('department', value)} placeholder="Not set" />
          <Field label="Program" value={draft.program} editing={editing} onChange={(value) => updateDraft('program', value)} placeholder="Not set" />
          <Field label="Year Level" value={draft.year_level} editing={editing} onChange={(value) => updateDraft('year_level', value)} placeholder="Not set" />
          <Field label="Student Number" value={draft.student_no} editing={editing} onChange={(value) => updateDraft('student_no', value)} placeholder="Not set" />
        </ProfileSection>}
        {activeTab === 'security' && <ProfileSection title="Change Password">
          <Field label="Current Password" value={currentPassword} editing onChange={(value) => setCurrentPassword(value)} placeholder="Enter current password" type="password" />
          <Field label="New Password" value={newPassword} editing onChange={(value) => setNewPassword(value)} placeholder="Enter new password" type="password" />
          <Field label="Confirm New Password" value={confirmPassword} editing onChange={(value) => setConfirmPassword(value)} placeholder="Confirm new password" type="password" />
        </ProfileSection>}
        {(activeTab === 'personal' || activeTab === 'professional') && editing && <button type="submit" className="small-profile-button" disabled={saving}>{saving ? 'Saving…' : '▣ Save Changes'}</button>}
        {activeTab === 'security' && <button type="submit" className="small-profile-button" disabled={saving}>{saving ? 'Updating…' : '♧ Change Password'}</button>}
      </form>
    </main>
  </div>;
};

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="admin-profile-section"><h2>{title}</h2><div className="profile-fields">{children}</div></section>;
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange?: (value: string) => void; full?: boolean; placeholder?: string; type?: string }> = ({ label, value, editing, onChange, full, placeholder, type = 'text' }) => <label className={`profile-field ${full ? 'full' : ''}`}><span>{label}</span><input type={type} value={value} placeholder={placeholder} readOnly={!editing} onChange={(event) => onChange?.(event.target.value)} /></label>;
