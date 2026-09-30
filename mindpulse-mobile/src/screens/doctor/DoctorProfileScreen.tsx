import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { supabase } from '../../supabase/client';
import {
  DoctorProfileData,
  changeAccountPassword,
  fetchDoctorProfile,
  saveDoctorProfile,
} from '../../services/doctorProfile';
import { DoctorNotifications } from '../../components/DoctorNotifications';
import { DoctorNotificationsSettings } from './DoctorNotificationsSettings';

interface DoctorProfileScreenProps {
  onSignOut?: () => void;
  /** Chat rows in the bell sheet land on the Messages thread. */
  onOpenMessages?: () => void;
}

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  editable?: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, !editable && styles.inputReadOnly]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textHint}
      keyboardType={keyboardType}
      editable={editable}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
    />
  </View>
);

export const DoctorProfileScreen: React.FC<DoctorProfileScreenProps> = ({ onSignOut, onOpenMessages }) => {
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProfile(await fetchDoctorProfile());
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<DoctorProfileData>) =>
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleSave = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await saveDoctorProfile(profile);
      setNotice(result.message || 'Profile saved.');
      setNoticeIsError(!result.success);
      if (result.success) void load();
    } catch (e: any) {
      setNotice(e?.message || 'Could not save the profile.');
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwdBusy) return;
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Type the same new password in both fields.');
      return;
    }
    setPwdBusy(true);
    try {
      const result = await changeAccountPassword(newPassword);
      if (result.success) {
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Password updated', result.message || 'Your password has been changed.');
      } else {
        Alert.alert('Password not changed', result.message || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Password not changed', e?.message || 'Please try again.');
    } finally {
      setPwdBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Do you want to sign out of the doctor portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await supabase.auth.signOut();
            } finally {
              onSignOut?.();
            }
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.errorText}>{loadError ?? 'Profile unavailable.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials =
    `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase() ||
    profile.email.slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.surface }}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Doctor Profile</Text>
          <View style={styles.headerActions}>
            {profile.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color={Colors.tagGreenText} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            <DoctorNotifications onOpenMessages={onOpenMessages} />
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.identityName}>
          {`Dr. ${profile.firstName} ${profile.lastName}`.trim()}
        </Text>
        <Text style={styles.identitySpecialty}>{profile.specialty || 'Mental Health Professional'}</Text>
        <Text style={styles.identityEmail}>{profile.email}</Text>
      </View>

      {notice && (
        <View style={[styles.noticeBox, { backgroundColor: noticeIsError ? Colors.tagRedBg : Colors.tagGreenBg }]}>
          <Text style={[styles.noticeText, { color: noticeIsError ? Colors.tagRedText : Colors.tagGreenText }]}>
            {notice}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Details</Text>
        <Field label="First name" value={profile.firstName} onChangeText={(t) => update({ firstName: t })} />
        <Field label="Last name" value={profile.lastName} onChangeText={(t) => update({ lastName: t })} />
        <Field label="Email (login)" value={profile.email} editable={false} />
        <Field label="Specialization" value={profile.specialty} onChangeText={(t) => update({ specialty: t })} placeholder="e.g. Clinical Psychologist" />
        <Field label="Contact number" value={profile.phone} onChangeText={(t) => update({ phone: t })} placeholder="+63 …" keyboardType="default" />
        <Field label="License no." value={profile.licenseId} onChangeText={(t) => update({ licenseId: t })} placeholder="PRC license number" />
        <Field label="Department" value={profile.department} onChangeText={(t) => update({ department: t })} placeholder="e.g. Guidance Center" />

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change Password</Text>
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="Min. 12 chars + special" />
        <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat the new password" />
        <TouchableOpacity style={[styles.saveBtn, pwdBusy && { opacity: 0.6 }]} onPress={() => void handleChangePassword()} disabled={pwdBusy}>
          {pwdBusy ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setNotifSettingsOpen(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open notification settings"
        >
          <View style={styles.settingsIcon}>
            <Ionicons name="notifications-outline" size={18} color={Colors.btnBlue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Notifications</Text>
            <Text style={styles.settingsSub}>Choose which alerts appear in your bell</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={Colors.tagRedText} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <DoctorNotificationsSettings visible={notifSettingsOpen} onClose={() => setNotifSettingsOpen(false)} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  content: { paddingBottom: 40 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.pageBg },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
  errorText: { color: Colors.tagRedText, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { backgroundColor: Colors.btnBlue, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 18 },
  retryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  headerSafe: { backgroundColor: Colors.surface },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.tagGreenBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  verifiedText: { fontSize: 11.5, fontWeight: '800', color: Colors.tagGreenText },

  identityCard: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 3 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E8ECFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { fontSize: 24, fontWeight: '900', color: '#5B6EF5' },
  identityName: { fontSize: 19, fontWeight: '900', color: Colors.textPrimary },
  identitySpecialty: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  identityEmail: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },

  noticeBox: { marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: 12 },
  noticeText: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 18 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '900', color: Colors.textPrimary, marginBottom: 2 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 11.5, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: Colors.pageBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  inputReadOnly: { backgroundColor: Colors.divider, color: Colors.textSecondary },
  saveBtn: {
    backgroundColor: Colors.btnBlue,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { fontSize: 13.5, fontWeight: '800', color: Colors.textPrimary },
  settingsSub: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 1, lineHeight: 16 },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    backgroundColor: Colors.tagRedBg,
    borderRadius: Radius.md,
    paddingVertical: 13,
  },
  signOutText: { color: Colors.tagRedText, fontWeight: '800', fontSize: 14.5 },
});
