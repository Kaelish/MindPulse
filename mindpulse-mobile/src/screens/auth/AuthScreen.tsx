import React, { useEffect, useState } from 'react';
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
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase/client';
import { CalendarDatePicker } from '../../components/CalendarDatePicker';
import {
  clearRememberedLogin,
  loadRememberedEmail,
  saveRememberedLogin,
} from '../../services/rememberMe';
import {
  prepareSignInVerification,
  resendSignInChallenge,
  VerificationChallenge,
  verifySignInChallenge,
} from '../../services/signInVerification';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

const { width } = Dimensions.get('window');

interface AuthScreenProps {
  initialTab?: 'login' | 'register';
  onAuthSuccess: (isNewUser: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const GENDER_OPTIONS = ['Female', 'Male', 'Prefer not to say'];
const EMAIL_CONFIRMATION_URL =
  process.env.EXPO_PUBLIC_MINDPULSE_EMAIL_CONFIRMATION_URL?.trim();
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'One number', test: (value: string) => /\d/.test(value) },
  { label: 'One special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

/**
 * Turns Supabase/GoTrue error payloads into wording a student can act on.
 * The raw messages ("over_email_send_rate_limit", "Database error querying
 * schema") are meaningless to the person holding the phone.
 */
const describeAuthError = (error: any): string => {
  const code = String(error?.code ?? '');
  const msg = String(error?.message ?? error ?? 'Something went wrong.');
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
    return 'Too many e-mail attempts in a short time. Only a few confirmation e-mails are allowed per hour — wait about an hour, then tap "Resend confirmation e-mail".';
  }
  if (
    code === 'user_already_exists' ||
    /already registered/i.test(msg) ||
    /already exists/i.test(msg)
  ) {
    return 'An account with that e-mail address already exists. Sign in instead.';
  }
  if (
    code === 'weak_password' ||
    /weak password/i.test(msg) ||
    /password too short/i.test(msg) ||
    /at least 6 characters/i.test(msg) ||
    /6 characters/i.test(msg) ||
    /password should be at least/i.test(msg)
  ) {
    return 'Your password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character.';
  }
  if (code === 'email_address_invalid' || /invalid.*e?mail|not a valid/i.test(msg)) {
    return 'That e-mail address is not valid. Please check it for typos.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Wrong e-mail address or password.';
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Your e-mail address has not been confirmed yet. Open the link we sent you, or resend it below.';
  }
  if (/database error saving new user/i.test(msg)) {
    return 'Your account was created but its profile could not be saved. Please contact the administrator.';
  }
  return msg;
};

// ─── Small logo mark at top ───
const LogoMark = () => (
  <View style={styles.logoWrap}>
    <View style={styles.logoCircle}>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
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
  const [verificationChallenge, setVerificationChallenge] = useState<VerificationChallenge | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);

  /* Register state */
  const [firstName, setFirstName] = useState('');
  const [mi, setMi] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regGender, setRegGender] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegPw2, setShowRegPw2] = useState(false);
  /* Consent for the registration record (M-04 / B-3): the ticked box is what
     migration 0031's trigger turns into a consent_records row, via the
     consent_source flag sent with signUp() below. */
  const [regConsent, setRegConsent] = useState(false);

  /* Prefill the e-mail (and tick the box) from the last "Remember me" sign-in. */
  useEffect(() => {
    let cancelled = false;
    loadRememberedEmail().then((email) => {
      if (cancelled || !email) return;
      setLoginEmail(email);
      setRememberMe(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Returns a human message, or null when the form is good to send. */
  const validateRegistration = (email: string): string | null => {
    if (!firstName.trim() || !lastName.trim()) {
      return 'Please enter your first and last name.';
    }
    if (!EMAIL_RE.test(email)) {
      return 'Please enter a valid e-mail address.';
    }
    const digits = regPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return 'Please enter a valid phone number (7 to 15 digits).';
    }
    if (!DOB_RE.test(regDob)) {
      return 'Please pick your birth date from the calendar.';
    }
    const dob = new Date(`${regDob}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Round-trip in LOCAL time catches impossible dates such as 2004-02-31,
    // which the Date constructor would otherwise silently roll over to March.
    // (toISOString() would compare in UTC and reject every valid date for
    // users east of UTC, e.g. "That birth date does not exist" on any pick.)
    const [dobYear, dobMonth, dobDay] = regDob.split('-').map(Number);
    if (
      Number.isNaN(dob.getTime()) ||
      dob.getFullYear() !== dobYear ||
      dob.getMonth() !== dobMonth - 1 ||
      dob.getDate() !== dobDay
    ) {
      return 'That birth date does not exist. Please check it.';
    }
    if (dob > today || dob.getFullYear() < 1900) {
      return 'Please enter a birth date between 1900 and today.';
    }
    if (!regGender) {
      return 'Please select your gender.';
    }
    const failedPasswordRule = PASSWORD_RULES.find((rule) => !rule.test(regPassword));
    if (failedPasswordRule) {
      return `Password requirement not met: ${failedPasswordRule.label}.`;
    }
    if (regPassword !== regConfirm) {
      return 'The two passwords do not match.';
    }
    if (!regConsent) {
      return 'Please accept the Privacy Policy and Terms of Use to create your account.';
    }
    return null;
  };

  /* Confirmation panel state: set once an account exists but still needs its
     e-mail link, or when sign-in is blocked by "email not confirmed". */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;

    const handleConfirmationUrl = async (url: string | null) => {
      if (!url || !url.startsWith('mindpulse://')) return;

      const [baseUrl, hash = ''] = url.split('#', 2);
      const query = baseUrl.split('?')[1] ?? '';
      const params = new URLSearchParams(hash || query);
      const errorDescription = params.get('error_description');
      if (errorDescription) {
        Alert.alert(
          'Confirmation link error',
          errorDescription.replace(/\+/g, ' '),
        );
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');
      if ((!accessToken || !refreshToken) && !code) {
        Alert.alert(
          'Confirmation link error',
          'The confirmation link is incomplete or expired. Request a new link and try again.',
        );
        return;
      }

      const error = code
        ? (await supabase.auth.exchangeCodeForSession(code)).error
        : (await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })).error;
      if (error) {
        if (active) Alert.alert('Confirmation link error', describeAuthError(error));
        return;
      }
      if (active) onAuthSuccess(true);
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleConfirmationUrl(url);
    });
    void Linking.getInitialURL().then(handleConfirmationUrl);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [onAuthSuccess]);

  const handleForgotPassword = async () => {
    const email = loginEmail.trim();
    if (!EMAIL_RE.test(email)) {
      Alert.alert(
        'E-mail needed',
        'Type the e-mail address of your account above, then tap Forgot Password.',
      );
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw new Error(describeAuthError(error));
      Alert.alert(
        'Reset link sent',
        `If ${email} has a MindPulse account, a password reset link is on its way. Open it on this device, then choose a new password. Also check spam/junk.`,
      );
    } catch (err: any) {
      Alert.alert('Could not send reset e-mail', err?.message ?? 'Something went wrong.');
    } finally {
      setResetting(false);
    }
  };

  const handleLogin = async () => {
    const email = loginEmail.trim();
    if (!EMAIL_RE.test(email)) {
      Alert.alert('Invalid e-mail', 'Please enter a valid e-mail address.');
      return;
    }
    if (!loginPassword) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }
    setLoading(true);
    let signedIn = false;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          // Hand the user somewhere useful instead of a dead-end alert.
          setPendingEmail(email);
          return;
        }
        throw new Error(describeAuthError(error));
      }
      signedIn = true;
      if (rememberMe) {
        await saveRememberedLogin(email);
      } else {
        await clearRememberedLogin();
      }
      const challenge = await prepareSignInVerification();
      if (challenge) {
        setVerificationChallenge(challenge);
        setVerificationCode('');
        return;
      }
      onAuthSuccess(false);
    } catch (err: any) {
      if (signedIn) await supabase.auth.signOut({ scope: 'local' });
      Alert.alert('Login Failed', err?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignIn = async () => {
    if (!verificationChallenge || verificationCode.length !== 6 || verificationBusy) return;
    setVerificationBusy(true);
    try {
      await verifySignInChallenge(verificationChallenge, verificationCode);
      setVerificationChallenge(null);
      setVerificationCode('');
      onAuthSuccess(false);
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message ?? 'The code could not be verified.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationChallenge || verificationBusy) return;
    setVerificationBusy(true);
    try {
      setVerificationChallenge(await resendSignInChallenge(verificationChallenge));
      setVerificationCode('');
      Alert.alert('Code Sent', `A new code was sent to ${verificationChallenge.destination}.`);
    } catch (err: any) {
      Alert.alert('Could Not Resend Code', err?.message ?? 'Please try again.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const cancelSignInVerification = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setVerificationChallenge(null);
    setVerificationCode('');
    setLoginPassword('');
  };

  const handleResend = async () => {
    const email = (pendingEmail ?? '').trim();
    if (!EMAIL_RE.test(email)) {
      Alert.alert('Invalid e-mail', 'Please enter a valid e-mail address.');
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw new Error(describeAuthError(error));
      Alert.alert(
        'E-mail sent',
        `If ${email} has an account waiting for confirmation, a new link is on its way. Also check your spam/junk folder.`,
      );
    } catch (err: any) {
      Alert.alert('Could not send e-mail', err?.message ?? 'Something went wrong.');
    } finally {
      setResending(false);
    }
  };

  const handleRegister = async () => {
    const email = regEmail.trim();
    const problem = validateRegistration(email);
    if (problem) {
      Alert.alert('Check the form', problem);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: regPassword,
        options: {
          emailRedirectTo: EMAIL_CONFIRMATION_URL || 'mindpulse://auth/callback',
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            mi,
            phone: regPhone.trim(),
            birth_date: regDob,
            sex: regGender,
            // Only sent once the consent box was ticked (handleRegister rejects
            // otherwise); the database turns it into a consent_records row.
            consent_source: 'mobile_signup',
          },
        },
      });
      if (error) throw new Error(describeAuthError(error));

      // GoTrue answers a sign-up for an address that already has an account
      // with a synthetic user whose `identities` array is empty, and it sends
      // no e-mail at all. Treating that as "check your e-mail" would strand
      // the student on a confirmation that never arrives.
      const identities = data.user?.identities;
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        Alert.alert(
          'That e-mail already has an account',
          `${email} is already registered on MindPulse, so no confirmation e-mail was sent.\n\nSign in with it instead — if you never received the confirmation e-mail, we can resend it.`,
          [
            { text: 'Sign In', onPress: () => setActiveTab('login') },
            { text: 'Resend E-mail', onPress: () => setPendingEmail(email) },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }

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
              email,
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
              role: 'student',
              phone: regPhone.trim(),
              sex: regGender,
              birth_date: regDob,
              mi: mi.trim() || null,
            },
            { onConflict: 'id', ignoreDuplicates: true },
          );
          // Non-fatal: the signup itself succeeded and Health Setup upserts
          // the same row, so a failed profile write must not block the user.
          void profileError;
        }
        // Registering is not an opt-in to "Remember me" — start fresh.
        await clearRememberedLogin();
        onAuthSuccess(true);
        return;
      }

      // Email confirmation is enabled: the account exists but cannot be used
      // until the link in the e-mail is clicked.
      setPendingEmail(email);
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.message ?? 'Something went wrong.');
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
            <Text style={styles.heading}>
              {pendingEmail ? 'Confirm Your E-mail' : verificationChallenge ? 'Verify It’s You' : "Let's Get Started!"}
            </Text>
            <Text style={styles.subheading}>
              {pendingEmail
                ? 'Almost there — one more step'
                : verificationChallenge
                  ? `Enter the six-digit code for ${verificationChallenge.destination}`
                : activeTab === 'login'
                  ? 'Sign in to your account today'
                  : 'Create your free account today'}
            </Text>

            {/* ── WAITING FOR CONFIRMATION E-MAIL ── */}
            {pendingEmail ? (
              <View style={styles.panel}>
                <Ionicons name="mail-unread-outline" size={30} color={ACCENT} />
                <Text style={styles.panelTitle}>Check your e-mail</Text>
                <Text style={styles.panelBody}>
                  We sent a confirmation link to{'\n'}
                  <Text style={styles.panelEmail}>{pendingEmail}</Text>
                  {'\n\n'}
                  Open it on this device, then come back and sign in.
                </Text>

                <Pressable
                  style={[styles.primaryBtn, resending && { opacity: 0.7 }]}
                  onPress={handleResend}
                  disabled={resending}
                >
                  <Text style={styles.primaryBtnText}>
                    {resending ? 'Sending...' : 'Resend confirmation e-mail'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.backBtn}
                  onPress={() => {
                    setPendingEmail(null);
                    setActiveTab('login');
                  }}
                >
                  <Text style={styles.backBtnText}>Back to Sign In</Text>
                </Pressable>

                <Text style={styles.panelHint}>
                  Nothing after a few minutes? Look in spam/junk, and make sure
                  you used a brand-new e-mail address — an address that already
                  has a MindPulse account will not receive a new link.
                </Text>
              </View>
            ) : verificationChallenge ? (
              <View style={styles.panel}>
                <Ionicons name="shield-checkmark-outline" size={30} color={ACCENT} />
                <Text style={styles.panelTitle}>Sign-in Verification</Text>
                <Text style={styles.panelBody}>
                  {verificationChallenge.method === 'totp'
                    ? 'Open your authenticator app and enter the current code.'
                    : `Enter the code sent to ${verificationChallenge.destination}.`}
                </Text>
                <TextInput
                  style={styles.input}
                  value={verificationCode}
                  onChangeText={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Six-digit code"
                  placeholderTextColor="#B0C4D8"
                  keyboardType="number-pad"
                  maxLength={6}
                  accessibilityLabel="Sign-in verification code"
                />
                <Pressable
                  style={[styles.primaryBtn, (verificationBusy || verificationCode.length !== 6) && { opacity: 0.7 }]}
                  onPress={() => void handleVerifySignIn()}
                  disabled={verificationBusy || verificationCode.length !== 6}
                >
                  <Text style={styles.primaryBtnText}>{verificationBusy ? 'Verifying…' : 'Verify and Sign In'}</Text>
                </Pressable>
                {verificationChallenge.method !== 'totp' && (
                  <Pressable style={styles.backBtn} onPress={() => void handleResendVerification()} disabled={verificationBusy}>
                    <Text style={styles.backBtnText}>{verificationBusy ? 'Please wait…' : 'Resend Code'}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.backBtn} onPress={() => void cancelSignInVerification()} disabled={verificationBusy}>
                  <Text style={styles.backBtnText}>Cancel Sign In</Text>
                </Pressable>
              </View>
            ) : (
            <>
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
                  <Pressable
                    onPress={handleForgotPassword}
                    disabled={resetting}
                    style={resetting && { opacity: 0.6 }}
                  >
                    <Text style={styles.forgotText}>
                      {resetting ? 'Sending...' : 'Forgot Password'}
                    </Text>
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

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 09171234567"
                  placeholderTextColor="#B0C4D8"
                  keyboardType="phone-pad"
                  maxLength={20}
                  value={regPhone}
                  onChangeText={setRegPhone}
                />

                <Text style={styles.label}>Birth Date</Text>
                <CalendarDatePicker value={regDob} onChange={setRegDob} />

                <Text style={styles.label}>Gender</Text>
                <View style={styles.chipRow}>
                  {GENDER_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setRegGender(option)}
                      style={[styles.chip, regGender === option && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, regGender === option && styles.chipTextOn]}>
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>

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
                <View style={styles.passwordRules}>
                  {PASSWORD_RULES.map((rule) => {
                    const satisfied = rule.test(regPassword);
                    return (
                      <Text
                        key={rule.label}
                        style={[styles.passwordRule, satisfied && styles.passwordRuleSatisfied]}
                      >
                        {satisfied ? '✓' : '○'} {rule.label}
                      </Text>
                    );
                  })}
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    placeholder="Re-enter password"
                    placeholderTextColor="#B0C4D8"
                    secureTextEntry={!showRegPw2}
                    value={regConfirm}
                    onChangeText={setRegConfirm}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowRegPw2(v => !v)}
                  >
                    <Ionicons
                      name={showRegPw2 ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={tone('#8CA9C3')}
                    />
                  </Pressable>
                </View>
                {regConfirm.length > 0 && regConfirm !== regPassword && (
                  <Text style={styles.fieldError}>Passwords do not match</Text>
                )}

                <Pressable
                  style={styles.consentRow}
                  onPress={() => setRegConsent(v => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: regConsent }}
                  accessibilityLabel="I have read and agree to the Privacy Policy and Terms of Use"
                >
                  <View style={[styles.checkbox, { marginTop: 2 }, regConsent && styles.checkboxOn]}>
                    {regConsent && <Ionicons name="checkmark" size={12} color={tone('#FFF')} />}
                  </View>
                  <Text style={styles.consentText}>
                    I have read and agree to the Privacy Policy and Terms of Use.
                  </Text>
                </Pressable>

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
            </>
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
    backgroundColor: toneBg(CARD),
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
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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

  /* Gender selector + inline field error */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT_LIGHT,
    backgroundColor: toneBg('#F4F8FC'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: tone('#4A6680'),
  },
  chipTextOn: {
    color: tone('#FFF'),
    fontWeight: '700',
  },
  fieldError: {
    fontSize: 12,
    color: tone('#D9534F'),
    marginTop: 6,
    fontWeight: '600',
  },
  passwordRules: { marginTop: 6, marginBottom: 8 },
  passwordRule: { color: tone('#8CA9C3'), fontSize: 12, lineHeight: 18 },
  passwordRuleSatisfied: { color: tone('#2E8B57') },

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

  /* Registration consent row (M-04 / B-3) */
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, marginBottom: 2 },
  consentText: { flex: 1, fontSize: 12, lineHeight: 17, color: tone('#6B8CAA') },

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

  /* "Check your e-mail" panel */
  panel: {
    alignItems: 'center',
    backgroundColor: toneBg('#F4F8FC'),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: toneBg('#DDE8F2'),
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tone('#1A2E44'),
    marginTop: 10,
    textAlign: 'center',
  },
  panelBody: {
    fontSize: 13,
    lineHeight: 20,
    color: tone('#4A6680'),
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  panelEmail: { fontWeight: '800', color: tone('#1A2E44') },
  panelHint: {
    fontSize: 12,
    lineHeight: 18,
    color: tone('#8CA9C3'),
    textAlign: 'center',
    marginTop: 6,
  },
  backBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: ACCENT_LIGHT,
    backgroundColor: toneBg('#FFF'),
    marginTop: 2,
    width: '100%',
  },
  backBtnText: { fontSize: 14, fontWeight: '800', color: ACCENT },

  /* Name row */
  nameRow: { flexDirection: 'row', marginTop: 0 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
