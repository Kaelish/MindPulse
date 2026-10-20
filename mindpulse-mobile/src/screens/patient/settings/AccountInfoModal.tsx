import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { supabase } from '../../../supabase/client';
import { getAvatarUrl, pickProfilePhoto, uploadProfilePhoto } from '../../../services/profileAvatar';
import { CalendarDatePicker } from '../../../components/CalendarDatePicker';
import { registerThemeStyles, tone, toneBg } from '../../../theme/theme';

interface AccountInfoModalProps {
  visible: boolean;
  onClose: () => void;
  currentName: string;
  currentEmail: string;
  onProfileUpdated?: () => void;
}

export const AccountInfoModal: React.FC<AccountInfoModalProps> = ({
  visible,
  onClose,
  currentName,
  currentEmail,
  onProfileUpdated,
}) => {
  const [fullName, setFullName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [yearLevel, setYearLevel] = useState<string | null>(null);
  const [livingSituation, setLivingSituation] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [savedDob, setSavedDob] = useState('');
  const [savedYear, setSavedYear] = useState<string | null>(null);
  const [savedLiving, setSavedLiving] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const chipsTouched = useRef(false);
  const phoneTouched = useRef(false);
  const dobTouched = useRef(false);

  // Load the real profile values every time the sheet opens — nothing here is
  // prefilled with guessed data, so saving can never overwrite an empty field.
  useEffect(() => {
    if (!visible) return;
    chipsTouched.current = false;
    phoneTouched.current = false;
    dobTouched.current = false;
    let active = true;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        getAvatarUrl()
          .then((url) => { if (active) setAvatarUrl(url); })
          .catch(() => {});
        const { data } = await supabase
          .from('profiles')
          .select('year_level, living_situation, phone, birth_date')
          .eq('id', user.id)
          .maybeSingle();
        if (active && data) {
          if (!chipsTouched.current) {
            const year = data.year_level ?? null;
            const living = data.living_situation ?? null;
            setYearLevel(year);
            setLivingSituation(living);
            setSavedYear(year);
            setSavedLiving(living);
          }
          // Fill the contact fields only when the user hasn't started editing
          // them, so a slow load never overwrites what they just typed.
          if (!phoneTouched.current) {
            const storedPhone = data.phone ?? '';
            setPhone(storedPhone);
            setSavedPhone(storedPhone);
          }
          if (!dobTouched.current) {
            const storedDob = data.birth_date ?? '';
            setDob(storedDob);
            setSavedDob(storedDob);
          }
        }
      } catch {
        // Keep the fields empty rather than inventing values.
      } finally {
        if (active) setLoadingProfile(false);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [visible]);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Success message toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Password validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && newPassword === confirmPassword;

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      Alert.alert('Validation Error', 'Please enter a valid phone number (7 to 15 digits).');
      return;
    }
    if (dob) {
      const dobDate = new Date(`${dob}T00:00:00`);
      if (Number.isNaN(dobDate.getTime()) || dobDate.getTime() > Date.now()) {
        Alert.alert('Validation Error', 'Please select a valid birthday.');
        return;
      }
    }
    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || null;

        const { error: metaError } = await supabase.auth.updateUser({
          data: { first_name: firstName, last_name: lastName, full_name: fullName },
        });
        if (metaError) throw new Error(metaError.message);

        const patch: Record<string, string | null> = {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
        };
        // Only send the chips when the user actually changed them, so an empty
        // (unset) value is never written over a real one by accident.
        if (yearLevel !== savedYear) patch.year_level = yearLevel;
        if (livingSituation !== savedLiving) patch.living_situation = livingSituation;
        // Phone is compared digit-for-digit, so a stored "0969 346 4427" and a
        // typed "09693464427" count as the same number (no pointless rewrite).
        if (phoneDigits !== savedPhone.replace(/\D/g, '')) patch.phone = phoneDigits || null;
        if (dob !== savedDob) patch.birth_date = dob || null;

        const { error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', user.id);
        if (error) throw new Error(error.message);

        setSavedYear(yearLevel);
        setSavedLiving(livingSituation);
        setSavedPhone(phoneDigits);
        setSavedDob(dob);
      }
      showToast('Profile information updated successfully!');
      onProfileUpdated?.();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update profile information.');
    } finally {
      setSavingProfile(false);
    }
  };

  /** Pick a square photo from the gallery, upload it, and refresh the sheet. */
  const handleChangePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const photo = await pickProfilePhoto();
      if (!photo) return;
      const url = await uploadProfilePhoto(photo);
      setAvatarUrl(url);
      showToast('Profile photo updated!');
      onProfileUpdated?.();
    } catch (e: any) {
      Alert.alert('Photo Update Failed', e.message || 'Could not update your profile photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword) {
      Alert.alert('Validation Error', 'Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirmation do not match.');
      return;
    }
    if (!hasMinLength || !hasUppercase || !hasNumber) {
      Alert.alert('Weak Password', 'Please fulfill all password strength requirements.');
      return;
    }

    setSavingPassword(true);
    try {
      // Re-authenticate first so the "Current Password" field is enforced
      // (Supabase otherwise trusts the active session and ignores it).
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Your session has expired. Please sign in again.');
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        if (/invalid login credentials/i.test(reauthError.message)) {
          throw new Error('Your current password is incorrect.');
        }
        throw new Error(reauthError.message);
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully!');
    } catch (e: any) {
      Alert.alert('Password Update Failed', e.message || 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="person-outline" size={20} color={tone('#5B6EF5')} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Account Information</Text>
                <Text style={styles.headerSub}>View and update your personal details</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={tone('#64748B')} />
            </Pressable>
          </View>

          {/* Toast Alert */}
          {toastMsg && (
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color={tone('#27AE60')} />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* ── PROFILE PICTURE / INITIALS ── */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                {/* Initials sit underneath: a broken photo URL falls back to them. */}
                <Text style={styles.avatarInitials}>
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'MP'}
                </Text>
                {!!avatarUrl && (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    onError={() => setAvatarUrl(null)}
                  />
                )}
              </View>
              <TouchableOpacity
                style={[styles.changeAvatarBtn, photoBusy && styles.btnDisabled]}
                activeOpacity={0.8}
                onPress={() => void handleChangePhoto()}
                disabled={photoBusy}
              >
                {photoBusy ? (
                  <ActivityIndicator size="small" color={tone('#5B6EF5')} />
                ) : (
                  <Ionicons name="camera-outline" size={14} color={tone('#5B6EF5')} />
                )}
                <Text style={styles.changeAvatarText}>{photoBusy ? 'Uploading…' : 'Change Photo'}</Text>
              </TouchableOpacity>
            </View>

            {/* ── BASIC INFORMATION ── */}
            <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
            {loadingProfile && <Text style={styles.fieldNote}>Loading your saved details…</Text>}
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter full name"
                  placeholderTextColor={Colors.textHint}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={email}
                  editable={false}
                  placeholder="Enter email address"
                  placeholderTextColor={Colors.textHint}
                />
                <Text style={styles.fieldNote}>Email address is managed by your account sign-in.</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(text) => { phoneTouched.current = true; setPhone(text); }}
                  placeholder="09XX XXX XXXX"
                  placeholderTextColor={Colors.textHint}
                  keyboardType="phone-pad"
                  maxLength={20}
                />
                <Text style={styles.fieldNote}>
                  The number you gave at registration — your doctor sees it on your case record.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Birthday</Text>
                <CalendarDatePicker
                  value={dob}
                  onChange={(iso) => { dobTouched.current = true; setDob(iso); }}
                  placeholder="Select your birth date"
                />
                <Text style={styles.fieldNote}>
                  Used to show your age to your doctor. Set at registration.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Academic Year Level</Text>
                <View style={styles.chipRow}>
                  {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(lvl => (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.chip, yearLevel === lvl && styles.chipActive]}
                      onPress={() => { chipsTouched.current = true; setYearLevel(lvl); }}
                    >
                      <Text style={[styles.chipText, yearLevel === lvl && styles.chipTextActive]}>{lvl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Living Arrangement</Text>
                <View style={styles.chipRow}>
                  {['On-campus', 'Off-campus — family', 'Off-campus — alone'].map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, livingSituation === opt && styles.chipActive]}
                      onPress={() => { chipsTouched.current = true; setLivingSituation(opt); }}
                    >
                      <Text style={[styles.chipText, livingSituation === opt && styles.chipTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator size="small" color={tone('#FFF')} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color={tone('#FFF')} />
                    <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ── SECURITY / PASSWORD CHANGE ── */}
            <Text style={styles.sectionLabel}>SECURITY & PASSWORD</Text>
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={Colors.textHint}
                  />
                  <Pressable
                    onPress={() => setShowCurrentPassword(v => !v)}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    <Ionicons name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={tone('#64748B')} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={Colors.textHint}
                  />
                  <Pressable
                    onPress={() => setShowNewPassword(v => !v)}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={tone('#64748B')} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={Colors.textHint}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(v => !v)}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  >
                    <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={tone('#64748B')} />
                  </Pressable>
                </View>
              </View>

              {/* Password Requirements List */}
              <View style={styles.reqList}>
                <Text style={styles.reqTitle}>PASSWORD REQUIREMENTS</Text>
                <View style={styles.reqRow}>
                  <Ionicons name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={hasMinLength ? '#27AE60' : '#A0B0C8'} />
                  <Text style={[styles.reqText, hasMinLength && styles.reqTextDone]}>At least 8 characters</Text>
                </View>
                <View style={styles.reqRow}>
                  <Ionicons name={hasUppercase ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={hasUppercase ? '#27AE60' : '#A0B0C8'} />
                  <Text style={[styles.reqText, hasUppercase && styles.reqTextDone]}>Contains an uppercase letter (A-Z)</Text>
                </View>
                <View style={styles.reqRow}>
                  <Ionicons name={hasNumber ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={hasNumber ? '#27AE60' : '#A0B0C8'} />
                  <Text style={[styles.reqText, hasNumber && styles.reqTextDone]}>Contains a number (0-9)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: toneBg('#8353E2') }, !isPasswordValid && styles.btnDisabled]}
                onPress={handleUpdatePassword}
                disabled={savingPassword || !isPasswordValid}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color={tone('#FFF')} />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={16} color={tone('#FFF')} />
                    <Text style={styles.saveBtnText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: toneBg('#FAF8F3'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: { width: 36, height: 4, backgroundColor: toneBg('#CBD5E1'), borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: toneBg('#EEEDFE'), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: toneBg('#E2E8F0'), alignItems: 'center', justifyContent: 'center' },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: toneBg('#D6F5E3'),
    borderColor: toneBg('#27AE60'),
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 12, fontWeight: '700', color: tone('#1E7E43') },

  scroll: { maxHeight: 560 },

  /* Avatar */
  avatarSection: { alignItems: 'center', marginVertical: 12, gap: 8 },
  avatarCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: toneBg('#F5A623'), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: tone('#FFF') },
  changeAvatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: toneBg('#EEEDFE'), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  changeAvatarText: { fontSize: 12, fontWeight: '700', color: tone('#5B6EF5') },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 10, marginBottom: 8 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  input: { backgroundColor: Colors.pageBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textPrimary },
  inputDisabled: { backgroundColor: toneBg('#F1F5F9'), color: Colors.textSecondary },
  fieldNote: { fontSize: 10, color: Colors.textHint, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.pageBg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: toneBg('#EEEDFE'), borderColor: toneBg('#5B6EF5') },
  chipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: tone('#5B6EF5'), fontWeight: '700' },

  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.pageBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textPrimary },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },

  reqList: { backgroundColor: toneBg('#F8FAFC'), borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: toneBg('#E2E8F0') },
  reqTitle: { fontSize: 10, fontWeight: '800', color: tone('#94A3B8'), letterSpacing: 0.5 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: 11, color: tone('#64748B') },
  reqTextDone: { color: tone('#27AE60'), fontWeight: '700' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: toneBg('#5B6EF5'), borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: tone('#FFF') },
  btnDisabled: { opacity: 0.4 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
