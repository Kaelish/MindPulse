import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [savedYear, setSavedYear] = useState<string | null>(null);
  const [savedLiving, setSavedLiving] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const chipsTouched = useRef(false);

  // Load the real profile values every time the sheet opens — nothing here is
  // prefilled with guessed data, so saving can never overwrite an empty field.
  useEffect(() => {
    if (!visible) return;
    chipsTouched.current = false;
    let active = true;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('profiles')
          .select('year_level, living_situation')
          .eq('id', user.id)
          .maybeSingle();
        if (active && data && !chipsTouched.current) {
          const year = data.year_level ?? null;
          const living = data.living_situation ?? null;
          setYearLevel(year);
          setLivingSituation(living);
          setSavedYear(year);
          setSavedLiving(living);
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

        const { error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', user.id);
        if (error) throw new Error(error.message);

        setSavedYear(yearLevel);
        setSavedLiving(livingSituation);
      }
      showToast('Profile information updated successfully!');
      onProfileUpdated?.();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update profile information.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
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
                <Ionicons name="person-outline" size={20} color="#5B6EF5" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Account Information</Text>
                <Text style={styles.headerSub}>View and update your personal details</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Toast Alert */}
          {toastMsg && (
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* ── PROFILE PICTURE / INITIALS ── */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>
                  {fullName ? fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'MP'}
                </Text>
              </View>
              <TouchableOpacity style={styles.changeAvatarBtn} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={14} color="#5B6EF5" />
                <Text style={styles.changeAvatarText}>Change Photo</Text>
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
                <Text style={styles.fieldNote}>Email address is managed by student authentication.</Text>
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
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
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
                    <Ionicons name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#64748B" />
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
                    <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#64748B" />
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
                    <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#64748B" />
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
                style={[styles.saveBtn, { backgroundColor: '#8353E2' }, !isPasswordValid && styles.btnDisabled]}
                onPress={handleUpdatePassword}
                disabled={savingPassword || !isPasswordValid}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="key-outline" size={16} color="#FFF" />
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

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FAF8F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: { width: 36, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D6F5E3',
    borderColor: '#27AE60',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 12, fontWeight: '700', color: '#1E7E43' },

  scroll: { maxHeight: 560 },

  /* Avatar */
  avatarSection: { alignItems: 'center', marginVertical: 12, gap: 8 },
  avatarCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  changeAvatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEEDFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  changeAvatarText: { fontSize: 12, fontWeight: '700', color: '#5B6EF5' },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 10, marginBottom: 8 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  input: { backgroundColor: Colors.pageBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textPrimary },
  inputDisabled: { backgroundColor: '#F1F5F9', color: Colors.textSecondary },
  fieldNote: { fontSize: 10, color: Colors.textHint, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.pageBg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#EEEDFE', borderColor: '#5B6EF5' },
  chipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#5B6EF5', fontWeight: '700' },

  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.pageBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.textPrimary },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },

  reqList: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  reqTitle: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: 11, color: '#64748B' },
  reqTextDone: { color: '#27AE60', fontWeight: '700' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5B6EF5', borderRadius: 12, paddingVertical: 12, marginTop: 4 },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  btnDisabled: { opacity: 0.4 },
});
