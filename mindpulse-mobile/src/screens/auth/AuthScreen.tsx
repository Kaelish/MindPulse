import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase/client';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

const { width } = Dimensions.get('window');

interface AuthScreenProps {
  initialTab?: 'login' | 'register';
  onAuthSuccess: (isNewUser: boolean) => void;
}

// ─── Small logo mark at top ───
const LogoMark = () => (
  <View style={styles.logoWrap}>
    <View style={styles.logoCircle}>
      <Ionicons name="pulse" size={20} color={tone('#D97B45')} />
    </View>
    <Text style={styles.logoText}>MindPulse</Text>
  </View>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialTab = 'login',
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  /* Login state */
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  /* Register state */
  const [firstName, setFirstName] = useState('');
  const [mi, setMi] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          Alert.alert(
            'Confirm Your Email',
            'Open the confirmation link we e-mailed you, then sign in. If it expired, ask your administrator to confirm the account.',
          );
          return;
        }
        throw error;
      }
      onAuthSuccess(false);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPassword || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: { first_name: firstName, last_name: lastName, mi },
        },
      });
      if (error) throw error;

      if (data.session) {
        // Email confirmation is disabled. Create the canonical profile row
        // right away so onboarding is never a pre-requisite for having a
        // profile. The insert is idempotent: when the database trigger
        // (on_auth_user_created) already created the row we leave it alone.
        const newUser = data.user;
        if (newUser) {
          const { error: profileError } = await supabase.from('profiles').upsert(
            {
              id: newUser.id,
              email: regEmail.trim(),
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
              role: 'student',
            },
            { onConflict: 'id', ignoreDuplicates: true },
          );
          // Non-fatal: the signup itself succeeded and Health Setup upserts
          // the same row, so a failed profile write must not block the user.
          void profileError;
        }
        onAuthSuccess(true);
        return;
      }

      // Email confirmation is enabled: the account exists but cannot be used
      // until the link in the e-mail is clicked.
      Alert.alert(
        'Check Your E-mail',
        `We sent a confirmation link to ${regEmail.trim()}. Confirm your address, then sign in.`,
        [{ text: 'OK', onPress: () => setActiveTab('login') }],
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Card ── */}
          <View style={styles.card}>
            <LogoMark />

            {/* Heading */}
            <Text style={styles.heading}>Let's Get Started!</Text>
            <Text style={styles.subheading}>
              {activeTab === 'login'
                ? 'Sign in to your account today'
                : 'Create your free account today'}
            </Text>

            {/* ── Tab Switcher ── */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
                onPress={() => setActiveTab('login')}
              >
                <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
                  Login
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, activeTab === 'register' && styles.tabBtnActive]}
                onPress={() => setActiveTab('register')}
              >
                <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>
                  Register
                </Text>
              </Pressable>
            </View>

            {/* ── LOGIN FORM ── */}
            {activeTab === 'login' ? (
              <View style={styles.form}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#B0C4D8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    placeholder="Enter your password"
                    placeholderTextColor="#B0C4D8"
                    secureTextEntry={!showLoginPw}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowLoginPw(v => !v)}
                  >
                    <Ionicons
                      name={showLoginPw ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={tone('#8CA9C3')}
                    />
                  </Pressable>
                </View>

                <View style={styles.rowBetween}>
                  <Pressable
                    style={styles.rememberRow}
                    onPress={() => setRememberMe(v => !v)}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                      {rememberMe && <Ionicons name="checkmark" size={12} color={tone('#FFF')} />}
                    </View>
                    <Text style={styles.rememberText}>Remember me</Text>
                  </Pressable>
                  <Pressable>
                    <Text style={styles.forgotText}>Forgot Password</Text>
                  </Pressable>
                </View>

                <Pressable 
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]} 
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Don't have an account? </Text>
                  <Pressable onPress={() => setActiveTab('register')}>
                    <Text style={styles.switchLink}>Create Account</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── REGISTER FORM ── */
              <View style={styles.form}>
                <View style={styles.nameRow}>
                  <View style={{ flex: 2.2 }}>
                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter first name"
                      placeholderTextColor="#B0C4D8"
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                  </View>
                  <View style={{ flex: 0.85, marginHorizontal: 8 }}>
                    <Text style={styles.label}>M.I</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="M.I"
                      placeholderTextColor="#B0C4D8"
                      maxLength={2}
                      value={mi}
                      onChangeText={setMi}
                    />
                  </View>
                  <View style={{ flex: 2.2 }}>
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter last name"
                      placeholderTextColor="#B0C4D8"
                      value={lastName}
                      onChangeText={setLastName}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#B0C4D8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    placeholder="Enter password"
                    placeholderTextColor="#B0C4D8"
                    secureTextEntry={!showRegPw}
                    value={regPassword}
                    onChangeText={setRegPassword}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowRegPw(v => !v)}
                  >
                    <Ionicons
                      name={showRegPw ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={tone('#8CA9C3')}
                    />
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Already have an account? </Text>
                  <Pressable onPress={() => setActiveTab('login')}>
                    <Text style={styles.switchLink}>Sign In</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const SKY = '#7EB4D8';         // sky blue background
const CARD = '#FFFFFF';
const ACCENT = '#4A8AB5';      // tab pill, button
const ACCENT_LIGHT = '#D6E8F5'; // tab background

const makeStyles = () => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SKY,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 28,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },

  /* Logo */
  logoWrap: { alignItems: 'center', marginBottom: 16 },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: toneBg('#FFF0E6'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoText: {
    fontSize: 13,
    fontWeight: '700',
    color: tone('#D97B45'),
    letterSpacing: 0.4,
  },

  /* Heading */
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: tone('#1A2E44'),
    textAlign: 'center',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: tone('#8CA9C3'),
    textAlign: 'center',
    marginBottom: 22,
  },

  /* Tab pill */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 30,
    padding: 4,
    marginBottom: 22,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: ACCENT,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },
  tabTextActive: {
    color: tone('#FFF'),
    fontWeight: '700',
  },

  /* Form */
  form: { gap: 0 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tone('#4A6680'),
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: toneBg('#F4F8FC'),
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 14,
    color: tone('#1A2E44'),
    borderWidth: 1,
    borderColor: toneBg('#DDE8F2'),
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  /* Remember me row */
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 4,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: toneBg('#B0C4D8'),
    backgroundColor: toneBg('#F4F8FC'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  rememberText: { fontSize: 12, color: tone('#6B8CAA'), fontWeight: '500' },
  forgotText: { fontSize: 12, color: ACCENT, fontWeight: '700' },

  /* Primary button */
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 10,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: tone('#FFF'),
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Switch link */
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  switchLabel: { fontSize: 13, color: tone('#8CA9C3') },
  switchLink: { fontSize: 13, fontWeight: '800', color: ACCENT },

  /* Name row */
  nameRow: { flexDirection: 'row', marginTop: 0 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
