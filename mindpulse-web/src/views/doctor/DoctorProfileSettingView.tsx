import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { DoctorProfileData, fetchDoctorProfile, saveDoctorProfile } from '../../services/doctorProfile';
import { OTHER_SPECIALIZATION, SPECIALIZATION_GROUPS, isSpecializationOption } from '../../services/specializations';
import { DoctorError, DoctorLoading, DoctorNotifications } from '../../components/doctor/DoctorChrome';
import { ProfileSecurityPanel } from '../../components/ProfileSecurityPanel';
import { InternationalPhoneField } from '../../components/InternationalPhoneField';
import { uploadProfileAvatar } from '../../services/profileAvatar';
import { formatPhoneNumber, parsePhoneNumber, validatePhoneNumber } from '../../services/internationalPhone';
import '../ProfilePhoto.css';

type ProfileTab = 'personal' | 'credentials' | 'security';

export const DoctorProfileSettingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedTone, setSavedTone] = useState<'ok' | 'error'>('ok');
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [savedProfile, setSavedProfile] = useState<DoctorProfileData | null>(null);
  const [specialtyChoice, setSpecialtyChoice] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  const flashSaved = (message: string, tone: 'ok' | 'error' = 'ok') => {
    setSavedTone(tone);
    setSaved(message);
    window.setTimeout(() => setSaved(null), 4000);
  };

  const seedSpecialtyControls = useCallback((specialty: string) => {
    const listed = isSpecializationOption(specialty);
    setSpecialtyChoice(specialty ? (listed ? specialty : OTHER_SPECIALIZATION) : '');
    setCustomSpecialty(listed ? '' : specialty);
  }, []);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchDoctorProfile()
      .then((data) => {
        setProfile(data);
        setSavedProfile(data);
        setAvatarPreview(data.avatarUrl);
        seedSpecialtyControls(data.specialty);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load your profile.');
        setLoading(false);
      });
  }, [seedSpecialtyControls]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  // Edits live only in memory until Save Changes is pressed, so leaving the
  // page (reload / close) with unsaved work asks for confirmation first.
  const dirty = Boolean(
    avatarFile ||
    (profile && savedProfile && JSON.stringify(profile) !== JSON.stringify(savedProfile)),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Enter inside a field must never save on its own — only the Save Changes
  // button writes to the backend. (Implicit form submission was the reason
  // changes appeared to save themselves.)
  const blockImplicitSave = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement | null;
    if (target && target.tagName === 'INPUT') event.preventDefault();
  };

  const update = (key: keyof DoctorProfileData, value: string) =>
    setProfile((current) => (current ? { ...current, [key]: value } : current));

  const handleSpecialtyChoice = (value: string) => {
    setSpecialtyChoice(value);
    update('specialty', value === OTHER_SPECIALIZATION ? customSpecialty : value);
  };

  const handleCustomSpecialty = (value: string) => {
    setCustomSpecialty(value);
    update('specialty', value);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaved(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(profile.email.trim())) {
      flashSaved('Enter a valid email address containing @.', 'error');
      return;
    }
    const phoneError = validatePhoneNumber(profile.phone);
    if (phoneError) {
      flashSaved(phoneError, 'error');
      return;
    }
    if (!dirty) {
      flashSaved('No changes to save. Edit a field before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await saveDoctorProfile(profile);
      if (!result.success) throw new Error(result.message || 'Unable to save your profile.');
      try {
        const avatarUrl = avatarFile ? await uploadProfileAvatar(avatarFile) : profile.avatarUrl;
        const updatedProfile = { ...profile, avatarUrl };
        setProfile(updatedProfile);
        setSavedProfile(updatedProfile);
        seedSpecialtyControls(updatedProfile.specialty);
        window.dispatchEvent(new CustomEvent('mindpulse:profile-updated', {
          detail: {
            name: [updatedProfile.firstName, updatedProfile.lastName].filter(Boolean).join(' '),
            email: updatedProfile.email,
            title: updatedProfile.title,
            specialty: updatedProfile.specialty,
          },
        }));
        setAvatarFile(null);
        setAvatarPreview(avatarUrl);
        setEditing(false);
        flashSaved('Changes saved successfully.');
      } catch (error) {
        flashSaved(`Profile saved, but the photo could not be uploaded: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error) {
      flashSaved(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancelProfileEdit = () => {
    setProfile(savedProfile);
    if (savedProfile) seedSpecialtyControls(savedProfile.specialty);
    setAvatarFile(null);
    setAvatarPreview(savedProfile?.avatarUrl ?? null);
    setEditing(false);
    setSaved(null);
  };

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaved(null);
    event.target.value = '';
  };

  if (loading) {
    return (
      <main className="main-panel doctor-profile-main">
        <header className="doctor-profile-header">
          <div>
            <h1>Profile Setting</h1>
            <p>Manage your personal and professional information</p>
          </div>
          <DoctorNotifications />
        </header>
        <DoctorLoading label="Loading your profile…" />
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
          <DoctorNotifications />
        </header>
        <DoctorError message={loadError ?? 'Your profile could not be loaded.'} onRetry={loadProfile} />
      </main>
    );
  }

  const doctorName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const displayName = [profile.title.trim(), doctorName].filter(Boolean).join(' ') || 'Doctor';
  const displayPhone = profile.phone
    ? formatPhoneNumber(parsePhoneNumber(profile.phone).country, parsePhoneNumber(profile.phone).nationalNumber)
    : '';

  return <main className="main-panel doctor-profile-main">
    <header className="doctor-profile-header"><div><h1>Profile Setting</h1><p>Manage your personal and professional information</p></div><DoctorNotifications /></header>
    <section className="doctor-profile-card">
      <div className="doctor-avatar-wrap">
        <div className="doctor-avatar-large">
          {avatarPreview
            ? <img src={avatarPreview} alt={`${displayName} profile`} />
            : `${(profile.firstName || 'D').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase()}
        </div>
        {editing && (activeTab === 'personal' || activeTab === 'credentials') && (
          <button type="button" className="profile-photo-trigger" onClick={() => photoInput.current?.click()} aria-label="Change profile photo">📷</button>
        )}
        <input ref={photoInput} className="profile-photo-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectAvatar} />
      </div>
      <div className="doctor-profile-identity"><h2>{displayName}</h2><span>{profile.specialty || 'Add your position'}</span><p className="doctor-profile-contact"><span className="doctor-profile-contact-item">{profile.email}</span>{displayPhone && <span className="doctor-profile-contact-item">{displayPhone}</span>}{profile.licenseId && <span className="doctor-profile-contact-item">{'License ' + profile.licenseId}</span>}</p></div>
      <div className="profile-header-actions">
        <button type="button" className="profile-edit-button" onClick={editing ? cancelProfileEdit : () => setEditing(true)}>{editing ? 'Cancel' : 'Edit Profile'}</button>
        {editing && activeTab !== 'security' && <button type="submit" form="doctor-profile-form" className="small-profile-button" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>}
      </div>
    </section>
    <nav className="doctor-profile-tabs" aria-label="Doctor profile sections">{([['personal', 'Personal Information'], ['credentials', 'Professional Credentials'], ['security', 'Security']] as const).map(([key, label]) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>{label}</button>)}</nav>
    {saved && <div className={`profile-save-banner ${savedTone === 'error' ? 'is-error' : ''}`} role={savedTone === 'error' ? 'alert' : 'status'}>{saved}</div>}
    {activeTab !== 'security' ? (
      <form id="doctor-profile-form" className="doctor-profile-form" onSubmit={saveProfile} onKeyDown={blockImplicitSave}>
        {activeTab === 'personal' && <ProfileSection title="Personal Information">
          <Field label="First Name" value={profile.firstName} editing={editing} onChange={(value) => update('firstName', value)} required />
          <Field label="Last Name" value={profile.lastName} editing={editing} onChange={(value) => update('lastName', value)} required />
          <Field label="Middle Initial" value={profile.middleInitial} editing={editing} onChange={(value) => update('middleInitial', value)} />
          <Field label="Title / Honorific" value={profile.title} editing={editing} onChange={(value) => update('title', value)} placeholder="Dr., Prof., etc." />
          <Field label="Work Email" value={profile.email} editing={editing} onChange={(value) => update('email', value)} type="email" required />
          <InternationalPhoneField label="Direct Contact Phone" value={profile.phone} editing={editing} onChange={(value) => update('phone', value)} />
          <SelectField label="Gender" value={profile.gender} editing={editing} onChange={(value) => update('gender', value)} />
          <Field label="Preferred Language" value={profile.preferredLanguage} editing={editing} onChange={(value) => update('preferredLanguage', value)} />
        </ProfileSection>}
        {activeTab === 'credentials' && <ProfileSection title="Professional Credentials"><label className="doctor-profile-field"><span>Position</span>{editing
          ? <select value={specialtyChoice} onChange={(event) => handleSpecialtyChoice(event.target.value)}>
              <option value="" disabled>Select a specialization</option>
              {SPECIALIZATION_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}
              <option value={OTHER_SPECIALIZATION}>{OTHER_SPECIALIZATION}</option>
            </select>
          : <input value={profile.specialty} readOnly />}</label>
          <Field label="Department" value={profile.department} editing={editing} onChange={(value) => update('department', value)} />
          <Field label="License Number" value={profile.licenseId} editing={editing} onChange={(value) => update('licenseId', value)} />
          <Field label="Years of Experience" value={profile.yearsExperience} editing={editing} onChange={(value) => update('yearsExperience', value)} />
          <Field label="Start Date" value={profile.startDate} editing={editing} onChange={(value) => update('startDate', value)} />
          <Field label="Date Of Birth" value={profile.dob} editing={editing} onChange={(value) => update('dob', value)} />
          {editing && specialtyChoice === OTHER_SPECIALIZATION && <label className="doctor-profile-field full"><span>Other specialization</span><input value={customSpecialty} placeholder="Type your specialization" onChange={(event) => handleCustomSpecialty(event.target.value)} /></label>}
        </ProfileSection>}
      </form>
    ) : <ProfileSecurityPanel editing={editing} email={profile.email} phone={profile.phone} />}
  </main>;
};

const ProfileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="doctor-profile-section"><h2>{title}</h2><div className="doctor-profile-fields">{children}</div></section>;
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange?: (value: string) => void; full?: boolean; type?: string; placeholder?: string; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; pattern?: string }> = ({ label, value, editing, onChange, full, type = 'text', placeholder, required, inputMode, pattern }) => <label className={`doctor-profile-field ${full ? 'full' : ''}`}><span>{label}</span><input type={type} inputMode={inputMode} pattern={pattern} required={required} value={value} placeholder={placeholder} readOnly={!editing} onChange={(event) => onChange?.(event.target.value)} /></label>;
const SelectField: React.FC<{ label: string; value: string; editing: boolean; onChange: (value: string) => void }> = ({ label, value, editing, onChange }) => <label className="doctor-profile-field"><span>{label}</span><select value={value} disabled={!editing} onChange={(event) => onChange(event.target.value)}><option value="">Select gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option><option value="Other">Other</option></select></label>;
