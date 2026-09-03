import React, { useEffect, useState } from 'react';
import {
  DEFAULT_DOCTOR_ID,
  DoctorProfileData,
  fetchDoctorProfile,
  initialDoctorData,
  saveDoctorProfile,
} from '../../services/doctorProfile';

type ProfileSubTab = 'personal' | 'credentials' | 'security' | 'notifications';

export const DoctorProfileSettingView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>('personal');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Form State
  const [firstName, setFirstName] = useState(initialDoctorData.firstName);
  const [lastName, setLastName] = useState(initialDoctorData.lastName);
  const [email, setEmail] = useState(initialDoctorData.email);
  const [phone, setPhone] = useState(initialDoctorData.phone);
  const [dob, setDob] = useState(initialDoctorData.dob);
  const [gender, setGender] = useState(initialDoctorData.gender);
  const [address, setAddress] = useState(initialDoctorData.streetAddress);
  const [licenseId, setLicenseId] = useState(initialDoctorData.licenseId);
  const [specialty, setSpecialty] = useState(initialDoctorData.specialty);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  // Notification Preferences State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Fetch Doctor Profile from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      const profile = await fetchDoctorProfile(DEFAULT_DOCTOR_ID);
      if (isMounted) {
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setEmail(profile.email);
        setPhone(profile.phone);
        setDob(profile.dob);
        setGender(profile.gender);
        setAddress(profile.streetAddress);
        setLicenseId(profile.licenseId);
        setSpecialty(profile.specialty);
        setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updatedProfile: DoctorProfileData = {
      userId: DEFAULT_DOCTOR_ID,
      firstName,
      lastName,
      email,
      phone,
      licenseId,
      specialty,
      dob,
      gender,
      streetAddress: address,
      isVerified: true,
    };

    const res = await saveDoctorProfile(updatedProfile);
    setSaving(false);

    if (res.success) {
      setSaveSuccessMsg('Doctor profile saved to Supabase backend successfully!');
      setIsEditing(false);
    } else {
      setSaveSuccessMsg(`Failed to save: ${res.message}`);
    }

    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  return (
    <div className="consultations-page" style={{ padding: '32px', gap: '24px', background: '#F4F5F7', flex: 1 }}>
      {/* Header */}
      <header className="consultations-header">
        <div className="consultations-title-wrap">
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>Profile Setting</h1>
          <p style={{ color: '#64748B', margin: 0, fontSize: '0.95rem' }}>Manage your personal and professional information</p>
        </div>

        <div className="consultations-header-actions">
          <button type="button" className="bell-btn" title="Notifications">
            🔔
          </button>
        </div>
      </header>

      {/* Top Profile Banner Card matching Screenshot */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          padding: '24px 28px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Avatar Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: '#0F172A',
            }}
          >
            👤
          </div>

          {/* Doctor Details */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              DR. {firstName} {lastName}
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#64748B', margin: '0 0 10px 0', fontWeight: 500 }}>
              {specialty}
            </p>

            {/* Sub-row with Contact Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.85rem', color: '#64748B' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✉️ <span style={{ color: '#475569' }}>{email}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                📞 <span style={{ color: '#475569' }}>{phone}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                🔑 <span style={{ color: '#475569' }}>{licenseId}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Edit Profile Button */}
        <button
          type="button"
          style={{
            backgroundColor: '#5B6EF5',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(91, 110, 245, 0.25)',
          }}
          onClick={() => setIsEditing(!isEditing)}
        >
          👤 {isEditing ? 'Cancel Edit' : 'Edit Profile'}
        </button>
      </div>

      {/* Main Profile Settings Panel with Tabs */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {/* Sub-Tabs Row matching Mockup */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            borderBottom: '1px solid #E2E8F0',
            paddingLeft: '28px',
            paddingRight: '28px',
            paddingTop: '16px',
            backgroundColor: '#FAFAFC',
          }}
        >
          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.95rem',
              fontWeight: activeSubTab === 'personal' ? 700 : 600,
              color: activeSubTab === 'personal' ? '#5B6EF5' : '#64748B',
              paddingBottom: '14px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'personal' ? '3px solid #5B6EF5' : '3px solid transparent',
            }}
            onClick={() => setActiveSubTab('personal')}
          >
            Personal Information
          </button>

          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.95rem',
              fontWeight: activeSubTab === 'credentials' ? 700 : 600,
              color: activeSubTab === 'credentials' ? '#5B6EF5' : '#64748B',
              paddingBottom: '14px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'credentials' ? '3px solid #5B6EF5' : '3px solid transparent',
            }}
            onClick={() => setActiveSubTab('credentials')}
          >
            Professional Credentials
          </button>

          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.95rem',
              fontWeight: activeSubTab === 'security' ? 700 : 600,
              color: activeSubTab === 'security' ? '#5B6EF5' : '#64748B',
              paddingBottom: '14px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'security' ? '3px solid #5B6EF5' : '3px solid transparent',
            }}
            onClick={() => setActiveSubTab('security')}
          >
            Security
          </button>

          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.95rem',
              fontWeight: activeSubTab === 'notifications' ? 700 : 600,
              color: activeSubTab === 'notifications' ? '#5B6EF5' : '#64748B',
              paddingBottom: '14px',
              cursor: 'pointer',
              borderBottom: activeSubTab === 'notifications' ? '3px solid #5B6EF5' : '3px solid transparent',
            }}
            onClick={() => setActiveSubTab('notifications')}
          >
            Notifications
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ padding: '28px' }}>
          {loading && (
            <div style={{ padding: '20px', color: '#64748B', fontWeight: 600 }}>
              ⏳ Loading doctor profile data from Supabase backend...
            </div>
          )}

          {saveSuccessMsg && (
            <div
              style={{
                backgroundColor: saveSuccessMsg.includes('Failed') ? '#FEE2E2' : '#D6F5E3',
                color: saveSuccessMsg.includes('Failed') ? '#DC2626' : '#27AE60',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              {saveSuccessMsg.includes('Failed') ? '⚠️ ' : '✓ '} {saveSuccessMsg}
            </div>
          )}

          {!loading && activeSubTab === 'personal' && (
            /* PERSONAL INFORMATION TAB FORM */
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Personal Information
              </h3>

              {/* 2-Column Inputs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* First Name */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    value={firstName}
                    readOnly={!isEditing}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    value={lastName}
                    readOnly={!isEditing}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    value={email}
                    readOnly={!isEditing}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    value={phone}
                    readOnly={!isEditing}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    value={dob}
                    readOnly={!isEditing}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                {/* Gender Dropdown */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Gender
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    disabled={!isEditing}
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                {/* Street Address */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Street Address
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: isEditing ? '#FFFFFF' : '#F8FAFC',
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                    value={address}
                    readOnly={!isEditing}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Save Button */}
              {isEditing && (
                <div style={{ display: 'flex', justifySelf: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      backgroundColor: '#5B6EF5',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: saving ? 'wait' : 'pointer',
                      boxShadow: '0 4px 12px rgba(91, 110, 245, 0.25)',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving to Supabase...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          )}

          {!loading && activeSubTab === 'credentials' && (
            /* PROFESSIONAL CREDENTIALS TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Professional Credentials & License
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Medical License Number
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '0.92rem' }}
                    value={licenseId}
                    onChange={(e) => setLicenseId(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Clinical Specialty
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '0.92rem' }}
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Medical Board Certification
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '0.92rem' }}
                    value="California Board of Psychology"
                    readOnly
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Years of Clinical Experience
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '0.92rem' }}
                    value="12 Years"
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}

          {!loading && activeSubTab === 'security' && (
            /* SECURITY TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Security & Account Access
              </h3>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.92rem' }}
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  New Password
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.92rem' }}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.92rem' }}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', padding: '14px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>Two-Factor Authentication (2FA)</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>Enhance account security with email verification codes.</p>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                />
              </div>

              <button
                type="button"
                style={{
                  backgroundColor: '#5B6EF5',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  marginTop: '10px',
                  alignSelf: 'flex-start',
                }}
                onClick={() => {
                  setSaveSuccessMsg('Password updated successfully!');
                  setTimeout(() => setSaveSuccessMsg(null), 3000);
                }}
              >
                Update Password
              </button>
            </div>
          )}

          {!loading && activeSubTab === 'notifications' && (
            /* NOTIFICATIONS TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Notification Preferences
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>Appointment Booking Notifications</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>Receive instant emails when a student books a telehealth session.</p>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  checked={emailNotifs}
                  onChange={(e) => setEmailNotifs(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>Urgent Student Stress Alerts (SMS)</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>Receive text messages when a student registers a critical stress level score.</p>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  checked={smsAlerts}
                  onChange={(e) => setSmsAlerts(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>Daily Digest Summary</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>Daily morning summary email of scheduled consultations and student case updates.</p>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  checked={dailyDigest}
                  onChange={(e) => setDailyDigest(e.target.checked)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
