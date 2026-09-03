import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface AuthScreenProps {
  initialTab?: 'login' | 'register';
  onAuthSuccess: (isNewUser: boolean) => void;
}

/* ─── Mini MindPulse logo mark ─── */
const LogoMark = () => (
  <View style={styles.logoWrap}>
    <View style={styles.logoCircle}>
      {/* head silhouette */}
      <View style={styles.logoHead} />
      {/* pulse line */}
      <View style={styles.logoPulseLine} />
    </View>
    <Text style={styles.logoLabel}>MindPulse</Text>
  </View>
);

/* ─── Eye toggle icon ─── */
const EyeIcon = ({ visible }: { visible: boolean }) => (
  <View style={styles.eyeWrap}>
    <View style={styles.eyeOuter}>
      <View style={styles.eyeInner} />
    </View>
    {!visible && <View style={styles.eyeStrike} />}
  </View>
);

/* ─── Checkbox ─── */
const Checkbox = ({ checked, onPress }: { checked: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.checkbox, checked && styles.checkboxChecked]}>
    {checked && <Text style={styles.checkmark}>✓</Text>}
  </Pressable>
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

  /* Register state */
  const [firstName, setFirstName] = useState('');
  const [mi, setMi] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <LogoMark />

          {/* Heading */}
          <Text style={styles.heading}>Let's Get Started!</Text>
          <Text style={styles.subheading}>Create your free account today</Text>

          {/* Tab card */}
          <View style={styles.card}>
            {/* Tab switcher */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
                onPress={() => setActiveTab('login')}>
                <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
                  Login
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, activeTab === 'register' && styles.tabBtnActive]}
                onPress={() => setActiveTab('register')}>
                <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>
                  Register
                </Text>
              </Pressable>
            </View>

            {activeTab === 'login' ? (
              /* ── LOGIN FORM ── */
              <View style={styles.form}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#A0B4CC"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                />

                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="Enter your password"
                    placeholderTextColor="#A0B4CC"
                    secureTextEntry={!showLoginPw}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowLoginPw(v => !v)}>
                    <EyeIcon visible={showLoginPw} />
                  </Pressable>
                </View>

                <View style={styles.rememberRow}>
                  <Pressable style={styles.rememberLeft} onPress={() => setRememberMe(v => !v)}>
                    <Checkbox checked={rememberMe} onPress={() => setRememberMe(v => !v)} />
                    <Text style={styles.rememberText}>Remember me</Text>
                  </Pressable>
                  <Pressable>
                    <Text style={styles.forgotText}>Forgot Password</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.primaryBtn} onPress={() => onAuthSuccess(false)}>
                  <Text style={styles.primaryBtnText}>Sign in</Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Don't have an account? </Text>
                  <Pressable onPress={() => setActiveTab('register')}>
                    <Text style={styles.switchAccent}>Create Account</Text>
                  </Pressable>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>
            ) : (
              /* ── REGISTER FORM ── */
              <View style={styles.form}>
                <View style={styles.nameRow}>
                  <View style={styles.nameFirst}>
                    <Text style={styles.fieldLabel}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter first name"
                      placeholderTextColor="#A0B4CC"
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                  </View>
                  <View style={styles.nameMi}>
                    <Text style={styles.fieldLabel}>M.I</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="M.I"
                      placeholderTextColor="#A0B4CC"
                      maxLength={2}
                      value={mi}
                      onChangeText={setMi}
                    />
                  </View>
                  <View style={styles.nameLast}>
                    <Text style={styles.fieldLabel}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter last name"
                      placeholderTextColor="#A0B4CC"
                      value={lastName}
                      onChangeText={setLastName}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#A0B4CC"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                />

                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="Enter password"
                    placeholderTextColor="#A0B4CC"
                    secureTextEntry={!showRegPw}
                    value={regPassword}
                    onChangeText={setRegPassword}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowRegPw(v => !v)}>
                    <EyeIcon visible={showRegPw} />
                  </Pressable>
                </View>

                <Pressable style={styles.primaryBtn} onPress={() => onAuthSuccess(true)}>
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Already have an account? </Text>
                  <Pressable onPress={() => setActiveTab('login')}>
                    <Text style={styles.switchAccent}>Sign In</Text>
                  </Pressable>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const BG = '#A8C8E8';
const CARD_BG = '#BDD4E8';
const BLUE = '#4A7EC7';
const WHITE = '#FFFFFF';
const TEXT_DARK = '#1A3A5C';
const TEXT_MUTED = '#4A7EC7';
const INPUT_BG = WHITE;
const BORDER = 'rgba(255,255,255,0.7)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  /* Logo */
  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D98543',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: WHITE,
    opacity: 0.9,
  },
  logoPulseLine: {
    position: 'absolute',
    bottom: 13,
    left: 9,
    width: 34,
    height: 2,
    backgroundColor: WHITE,
    borderRadius: 1,
  },
  logoLabel: {
    color: '#D98543',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Headings */
  heading: {
    color: TEXT_DARK,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subheading: {
    color: TEXT_DARK,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 22,
    opacity: 0.7,
  },

  /* Card */
  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
  },

  /* Tab switcher */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 30,
    padding: 3,
    marginBottom: 22,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: WHITE,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: TEXT_DARK,
  },

  /* Form */
  form: { gap: 0 },
  fieldLabel: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 16,
    fontSize: 13,
    color: TEXT_DARK,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inputFlex: { flex: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  /* Eye icon */
  eyeWrap: { width: 20, height: 14, justifyContent: 'center', alignItems: 'center' },
  eyeOuter: {
    width: 20,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#7AA3CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7AA3CC',
  },
  eyeStrike: {
    position: 'absolute',
    width: 22,
    height: 1.5,
    backgroundColor: '#7AA3CC',
    transform: [{ rotate: '35deg' }],
  },

  /* Remember me */
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
  },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#7AA3CC',
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: BLUE, borderColor: BLUE },
  checkmark: { color: WHITE, fontSize: 10, lineHeight: 12 },
  rememberText: { color: TEXT_DARK, fontSize: 12 },
  forgotText: { color: BLUE, fontSize: 12, fontWeight: '600' },

  /* Primary button */
  primaryBtn: {
    height: 50,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  primaryBtnText: { color: WHITE, fontWeight: '700', fontSize: 16 },

  /* Switch link */
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  switchText: { color: TEXT_DARK, fontSize: 12 },
  switchAccent: { color: BLUE, fontSize: 12, fontWeight: '700' },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(74,126,199,0.25)' },
  dividerText: { color: TEXT_DARK, fontSize: 11, opacity: 0.6 },

  /* Name row */
  nameRow: { flexDirection: 'row', gap: 6, marginTop: 0 },
  nameFirst: { flex: 2.2 },
  nameMi: { flex: 0.8 },
  nameLast: { flex: 2.2 },
});
