import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { AdminSidebar } from '../../components/navigation/AdminSidebar';
import { ProfileSecurityPanel } from '../../components/ProfileSecurityPanel';
import { InternationalPhoneField } from '../../components/InternationalPhoneField';
import { OwnProfile, OwnProfilePatch, fetchOwnProfile, updateOwnProfile } from '../../services/profile';
import { uploadProfileAvatar } from '../../services/profileAvatar';
import { formatPhoneNumber, parsePhoneNumber, validatePhoneNumber } from '../../services/internationalPhone';
import '../ProfilePhoto.css';

type ProfileTab = 'personal' | 'professional' | 'security';

type EditableField =
  | 'first_name' | 'last_name' | 'email' | 'phone' | 'sex' | 'preferred_title' | 'clinic_address'
  | 'administrative_title' | 'medical_specialization' | 'professional_license_no' | 'clinic_name' | 'privacy_scope';

type ProfileDraft = Record<EditableField, string>;

const EDITABLE_FIELDS: EditableField[] = [
  'first_name', 'last_name', 'email', 'phone', 'sex', 'preferred_title', 'clinic_address',
  'administrative_title', 'medical_specialization', 'professional_license_no', 'clinic_name', 'privacy_scope',
];

const EMPTY_DRAFT: ProfileDraft = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  sex: '',
  preferred_title: '',
  clinic_address: '',
  administrative_title: '',
  medical_specialization: '',
  professional_license_no: '',
  clinic_name: '',
  privacy_scope: '',
};

const toDraft = (profile: OwnProfile): ProfileDraft => ({
  first_name: profile.first_name ?? '',
  last_name: profile.last_name ?? '',
  email: profile.email ?? '',
  phone: profile.phone ?? '',
  sex: profile.sex ?? '',
  preferred_title: profile.preferred_title ?? '',
  clinic_address: profile.clinic_address ?? '',
  administrative_title: profile.administrative_title ?? '',
  medical_specialization: profile.medical_specialization ?? '',
  professional_license_no: profile.professional_license_no ?? '',
  clinic_name: profile.clinic_name ?? '',
  privacy_scope: profile.privacy_scope ?? '',
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
  onNavigate: (view: 'dashboard' | 'users' | 'assessment' | 'results' | 'records' | 'suggestions' | 'analytics' | 'profile' | 'settings') => void;
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchOwnProfile()
      .then((data) => {
        if (active) {
          setProfile(data);
          setDraft(toDraft(data));
          setAvatarPreview(data.avatar_url);
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

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const updateDraft = (field: EditableField, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    if (activeTab === 'security' || !editing) return;
    setSaved('');
    setSaveError('');
    const email = draft.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setSaveError('Enter a valid email address containing @.');
      return;
    }
    const phoneError = validatePhoneNumber(draft.phone);
    if (phoneError) {
      setSaveError(phoneError);
      return;
    }

    const patch: OwnProfilePatch = {};
    EDITABLE_FIELDS.forEach((field) => {
      if (draft[field] !== String(profile[field] ?? '')) {
        patch[field] = draft[field] === '' ? null : draft[field];
      }
    });
    if (Object.keys(patch).length === 0) {
      if (!avatarFile) {
        setSaveError('No changes to save. Edit a field before saving.');
        return;
      }
    }
    setSaving(true);
    try {
      if (Object.keys(patch).length > 0) await updateOwnProfile(patch);
      const avatarUrl = avatarFile ? await uploadProfileAvatar(avatarFile) : profile.avatar_url;
      const updatedProfile = { ...profile, ...patch, avatar_url: avatarUrl };
      setProfile(updatedProfile);
      setDraft(toDraft(updatedProfile));
      window.dispatchEvent(new CustomEvent('mindpulse:profile-updated', {
        detail: {
          name: `${updatedProfile.first_name ?? ''} ${updatedProfile.last_name ?? ''}`.trim(),
          email: updatedProfile.email ?? '',
          preferredTitle: updatedProfile.preferred_title ?? '',
          administrativeTitle: updatedProfile.administrative_title || 'Chief Clinical Administrator',
        },
      }));
      setAvatarFile(null);
      setAvatarPreview(avatarUrl);
      setEditing(false);
      setSaved('Changes saved successfully.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const cancelProfileEdit = () => {
    if (profile) setDraft(toDraft(profile));
    setAvatarFile(null);
    setAvatarPreview(profile?.avatar_url ?? null);
    setEditing(false);
    setSaved('');
    setSaveError('');
  };

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaved('');
    setSaveError('');
    event.target.value = '';
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
  const displayName = [profile.preferred_title?.trim(), identityName].filter(Boolean).join(' ');
  const displayPhone = profile.phone
    ? formatPhoneNumber(parsePhoneNumber(profile.phone).country, parsePhoneNumber(profile.phone).nationalNumber)
    : '';
  const roleLabel = profile.administrative_title?.trim() || (profile.role.charAt(0).toUpperCase() + profile.role.slice(1));

  return <div className="admin-shell admin-scope admin-profile-shell">
    <AdminSidebar onSignOut={onSignOut} activeView="profile" onNavigate={onNavigate} />
    <main className="admin-main admin-profile-main">
      {header}
      <section className="admin-profile-card">
        <div className="admin-avatar-wrap">
          <div className="admin-avatar-large">
            {avatarPreview ? <img src={avatarPreview} alt={`${displayName} profile`} /> : identityName.charAt(0).toUpperCase()}
          </div>
          {editing && (activeTab === 'personal' || activeTab === 'professional') && (
            <button type="button" className="profile-photo-trigger" onClick={() => photoInput.current?.click()} aria-label="Change profile photo">📷</button>
          )}
          <input ref={photoInput} className="profile-photo-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectAvatar} />
        </div>
        <div className="admin-profile-identity"><h2>{displayName}</h2><span>{roleLabel}</span><p className="admin-profile-contact"><span>{profile.email || 'No email'}</span>{displayPhone && <span>{displayPhone}</span>}<span>{profile.medical_specialization || profile.department || 'Clinical Administration'}</span></p></div>
        <div className="profile-header-actions">
          <button type="button" className="profile-edit-button" onClick={editing ? cancelProfileEdit : () => { setEditing(true); setSaved(''); setSaveError(''); }}>{editing ? 'Cancel' : 'Edit Profile'}</button>
          {editing && activeTab !== 'security' && <button type="submit" form="admin-profile-form" className="small-profile-button" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>}
        </div>
      </section>
      <nav className="admin-profile-tabs" aria-label="Profile settings sections">{([['personal', 'Personal Information'], ['professional', 'Professional Details'], ['security', 'Security']] as const).map(([key, label]) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => { setActiveTab(key); setSaved(''); setSaveError(''); }}>{label}</button>)}</nav>
      {saved && <div className="profile-save-banner">{saved}</div>}
      {saveError && <div className="error-inline" role="alert">{saveError}</div>}
      {activeTab !== 'security' ? (
        <form id="admin-profile-form" className="admin-profile-form" onSubmit={save}>
          {activeTab === 'personal' && <ProfileSection title="Personal Information">
            <Field label="First Name" value={draft.first_name} editing={editing} onChange={(value) => updateDraft('first_name', value)} required />
            <Field label="Last Name" value={draft.last_name} editing={editing} onChange={(value) => updateDraft('last_name', value)} required />
            <Field label="Work Email Address" value={draft.email} editing={editing} onChange={(value) => updateDraft('email', value)} type="email" required />
            <InternationalPhoneField label="Phone Number" value={draft.phone} editing={editing} onChange={(value) => updateDraft('phone', value)} />
            <Field label="Preferred Title / Honorific" value={draft.preferred_title} editing={editing} onChange={(value) => updateDraft('preferred_title', value)} placeholder="Dr., Prof., etc." />
            <SelectField label="Gender" value={draft.sex} editing={editing} onChange={(value) => updateDraft('sex', value)} />
            <Field label="Clinic Address / Location" value={draft.clinic_address} editing={editing} onChange={(value) => updateDraft('clinic_address', value)} full />
            {profile.birth_date && <Field label="Date Of Birth" value={formatDate(profile.birth_date)} editing={false} />}
          </ProfileSection>}
          {activeTab === 'professional' && <ProfileSection title="Professional Details">
            <Field label="Administrative Title" value={draft.administrative_title} editing={editing} onChange={(value) => updateDraft('administrative_title', value)} placeholder="Clinic Director & Lead Administrator" />
            <Field label="Medical Specialization" value={draft.medical_specialization} editing={editing} onChange={(value) => updateDraft('medical_specialization', value)} placeholder="Clinical Psychology" />
            <Field label="PRC / Professional License No." value={draft.professional_license_no} editing={editing} onChange={(value) => updateDraft('professional_license_no', value)} />
            <Field label="Clinic / Institution Name" value={draft.clinic_name} editing={editing} onChange={(value) => updateDraft('clinic_name', value)} />
            <Field label="Privacy Responsibility Scope" value={draft.privacy_scope} editing={editing} onChange={(value) => updateDraft('privacy_scope', value)} placeholder="Sole Data Privacy Officer & Doctor Credential Verifier" full />
          </ProfileSection>}
        </form>
      ) : <ProfileSecurityPanel editing={editing} email={profile.email || ''} />}
    </main>
  </div>;
};

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="admin-profile-section"><h2>{title}</h2><div className="profile-fields">{children}</div></section>;
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange?: (value: string) => void; full?: boolean; placeholder?: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; pattern?: string; required?: boolean }> = ({ label, value, editing, onChange, full, placeholder, type = 'text', inputMode, pattern, required }) => <label className={`profile-field ${full ? 'full' : ''}`}><span>{label}</span><input type={type} inputMode={inputMode} pattern={pattern} required={required} value={value} placeholder={placeholder} readOnly={!editing} onChange={(event) => onChange?.(event.target.value)} /></label>;
const SelectField: React.FC<{ label: string; value: string; editing: boolean; onChange: (value: string) => void }> = ({ label, value, editing, onChange }) => <label className="profile-field"><span>{label}</span><select value={value} disabled={!editing} onChange={(event) => onChange(event.target.value)}><option value="">Select gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option><option value="Other">Other</option></select></label>;
