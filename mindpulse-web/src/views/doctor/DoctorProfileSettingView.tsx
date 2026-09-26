import React, { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import { DoctorProfileData, fetchDoctorProfile, saveDoctorProfile } from '../../services/doctorProfile';

type ProfileTab = 'personal' | 'credentials' | 'security';

export const DoctorProfileSettingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const flashSaved = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(null), 4000);
  };

  useEffect(() => {
    let mounted = true;
    fetchDoctorProfile()
      .then((data) => {
        if (mounted) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load your profile.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const update = (key: keyof DoctorProfileData, value: string) =>
    setProfile((current) => (current ? { ...current, [key]: value } : current));

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    const result = await saveDoctorProfile(profile);
    setSaving(false);
    if (result.success) {
      setEditing(false);
      flashSaved('Changes saved successfully.');
    } else {
      flashSaved(`Failed to save: ${result.message}`);
    }
  };

  const changePassword = async () => {
    if (!supabase) {
      flashSaved('Supabase is not configured.');
      return;
    }
    if (!currentPassword) {
      flashSaved('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      flashSaved('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      flashSaved('The new passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authEmail = authData.user?.email;
      if (!authEmail) throw new Error('Your session has expired. Please sign in again.');

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
      });
      if (verifyError) throw new Error('Current password is incorrect.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flashSaved('Password updated successfully.');
    } catch (error) {
      flashSaved(`Failed to update password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="main-panel doctor-profile-main">
        <header className="doctor-profile-header">
          <div>
            <h1>Profile Setting</h1>
            <p>Manage your personal and professional information</p>
          </div>
        </header>
        <div className="doctor-profile-loading">Loading your profile…</div>
      </main>
    );
  }

  if (loadError || !profile) {
    return (
      <main className="main-panel doctor-profile-main">
        <header className="doctor-profile-header">
          <div>
            <h1>Profile Setting</h1>
            <p>Manage your personal and professional information</p>
          </div>
        </header>
        <div className="profile-save-banner">{loadError ?? 'Your profile could not be loaded.'}</div>
        <button
          type="button"
          className="small-profile-button"
          onClick={() => {
            setLoading(true);
            setLoadError(null);
            fetchDoctorProfile()
              .then((data) => {
                setProfile(data);
                setLoading(false);
              })
              .catch((error: unknown) => {
                setLoadError(error instanceof Error ? error.message : 'Unable to load your profile.');
                setLoading(false);
              });
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  return <main className="main-panel doctor-profile-main">
    <header className="doctor-profile-header"><div><h1>Profile Setting</h1><p>Manage your personal and professional information</p></div><button type="button" className="notification-button" aria-label="Notifications"><span className="bell-icon" /></button></header>
    <section className="doctor-profile-card"><div className="doctor-avatar-large">{`${(profile.firstName || 'D').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase()}</div><div className="doctor-profile-identity"><h2>DR. {profile.firstName.toUpperCase()} {profile.lastName.toUpperCase()}</h2><span>{profile.specialty || 'Add your position'}</span><p>{profile.email}{profile.phone ? ' ' + profile.phone : ''}{profile.licenseId ? ' License ' + profile.licenseId : ''}</p></div>{(activeTab === 'personal' || activeTab === 'credentials') && <button type="button" className="profile-edit-button" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel Edit' : 'Edit Profile'}</button>}</section>
    <nav className="doctor-profile-tabs" aria-label="Doctor profile sections">{([['personal', 'Personal Information'], ['credentials', 'Professional Credentials'], ['security', 'Security']] as const).map(([key, label]) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => { setActiveTab(key); setEditing(false); setSaved(null); }}>{label}</button>)}</nav>
    {saved && <div className="profile-save-banner">{saved}</div>}
    <form className="doctor-profile-form" onSubmit={saveProfile}>
      {activeTab === 'personal' && <ProfileSection title="Personal Information"><Field label="First Name" value={profile.firstName} editing={editing} onChange={(value) => update('firstName', value)} /><Field label="Last Name" value={profile.lastName} editing={editing} onChange={(value) => update('lastName', value)} /><Field label="Email Address" value={profile.email} editing={editing} onChange={(value) => update('email', value)} type="email" /><Field label="Phone Number" value={profile.phone} editing={editing} onChange={(value) => update('phone', value)} /><Field label="Date Of Birth" value={profile.dob} editing={editing} onChange={(value) => update('dob', value)} /><Field label="Gender" value={profile.gender} editing={editing} onChange={(value) => update('gender', value)} /><Field label="Street Address" value={profile.streetAddress} editing={editing} onChange={(value) => update('streetAddress', value)} full /></ProfileSection>}
      {activeTab === 'credentials' && <ProfileSection title="Professional Credentials"><Field label="Position" value={profile.specialty} editing={editing} onChange={(value) => update('specialty', value)} /><Field label="Department" value={profile.department} editing={editing} onChange={(value) => update('department', value)} /><Field label="License Number" value={profile.licenseId} editing={editing} onChange={(value) => update('licenseId', value)} /><Field label="Years of Experience" value={profile.yearsExperience} editing={editing} onChange={(value) => update('yearsExperience', value)} /><Field label="Start Date" value={profile.startDate} editing={editing} onChange={(value) => update('startDate', value)} /></ProfileSection>}
      {activeTab === 'security' && <ProfileSection title="Security"><Field label="Current Password" value={currentPassword} editing onChange={setCurrentPassword} type="password" placeholder="Enter current password" /><Field label="New Password" value={newPassword} editing onChange={setNewPassword} type="password" placeholder="Enter new password (min 8 characters)" /><Field label="Confirm New Password" value={confirmPassword} editing onChange={setConfirmPassword} type="password" placeholder="Confirm new password" /></ProfileSection>}
      {activeTab === 'personal' && editing && <button type="submit" className="small-profile-button" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
      {activeTab === 'credentials' && editing && <button type="submit" className="small-profile-button" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
      {activeTab === 'security' && <button type="button" className="small-profile-button" disabled={saving} onClick={changePassword}>{saving ? 'Updating…' : 'Change Password'}</button>}
    </form>
  </main>;
};

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="doctor-profile-section"><h2>{title}</h2><div className="doctor-profile-fields">{children}</div></section>;
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange?: (value: string) => void; full?: boolean; type?: string; placeholder?: string }> = ({ label, value, editing, onChange, full, type = 'text', placeholder }) => <label className={`doctor-profile-field ${full ? 'full' : ''}`}><span>{label}</span><input type={type} value={value} placeholder={placeholder} readOnly={!editing} onChange={(event) => onChange?.(event.target.value)} /></label>;
