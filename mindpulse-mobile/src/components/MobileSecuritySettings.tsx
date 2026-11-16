import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthenticatorQrCode } from './AuthenticatorQrCode';
import { Colors } from '../theme/colors';
import { tone, toneBg } from '../theme/theme';
import {
  activeVerificationMethod,
  challengeFactor,
  destinationError,
  disableVerification,
  enrollTotp,
  markVerificationEnabled,
  normalizeVerificationDestination,
  readVerificationProfile,
  sendContactCode,
  VERIFICATION_METHODS,
  VerificationMethod,
  verifyContactCode,
  verifyFactor,
} from '../services/signInVerification';
import {
  ProfileSessionsState,
  revokeOtherProfileSessions,
  revokeProfileSession,
  subscribeProfileSessions,
} from '../services/profileSessions';

interface MobileSecuritySettingsProps {
  email: string;
  phone: string;
}

const initialSessions: ProfileSessionsState = {
  sessions: [],
  status: 'connecting',
  message: 'Connecting to the live session service…',
  notice: '',
};

export const MobileSecuritySettings: React.FC<MobileSecuritySettingsProps> = ({ email, phone }) => {
  const [method, setMethod] = useState<VerificationMethod>('totp');
  const [activeMethod, setActiveMethod] = useState<VerificationMethod | null>(null);
  const [savedDestination, setSavedDestination] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [emailAddress, setEmailAddress] = useState(email);
  const [whatsappNumber, setWhatsappNumber] = useState(phone);
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<{ factorId: string; challengeId: string; qrCode: string } | null>(null);
  const [contactChallenge, setContactChallenge] = useState<{ method: VerificationMethod; destination: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingSession, setPendingSession] = useState('');

  useEffect(() => subscribeProfileSessions(setSessions), []);

  useEffect(() => {
    setEmailAddress(email);
    setPhoneNumber((current) => current || phone);
    setWhatsappNumber((current) => current || phone);
  }, [email, phone]);

  useEffect(() => {
    let active = true;
    void Promise.all([readVerificationProfile(), activeVerificationMethod()])
      .then(([profile, current]) => {
        if (!active) return;
        setSavedDestination(profile.destination);
        const selected = current ?? (profile.method !== 'none' ? profile.method : 'totp');
        setMethod(selected);
        setActiveMethod(current);
      })
      .catch((cause: unknown) => {
        Alert.alert('Verification Settings', cause instanceof Error ? cause.message : 'Could not load verification settings.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const clearSetup = () => {
    setEnrollment(null);
    setContactChallenge(null);
    setCode('');
  };

  const startSetup = async () => {
    if (busy || loading || activeMethod) return;
    setBusy(true);
    try {
      if (method === 'totp') {
        const next = await enrollTotp();
        const challengeId = await challengeFactor(next.factorId);
        setEnrollment({ ...next, challengeId });
      } else {
        const destination = method === 'sms' ? phoneNumber : method === 'email' ? emailAddress : whatsappNumber;
        const invalid = destinationError(method, destination);
        if (invalid) throw new Error(invalid);
        const normalized = normalizeVerificationDestination(method, destination);
        await sendContactCode(method, normalized);
        setContactChallenge({ method, destination: normalized });
        Alert.alert('Verification Code Sent', `A six-digit code was sent to ${normalized}.`);
      }
    } catch (cause) {
      Alert.alert('Verification Setup Failed', cause instanceof Error ? cause.message : 'Could not start verification setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    if (busy || code.length !== 6) return;
    setBusy(true);
    try {
      const destination = method === 'totp'
        ? 'Authenticator app'
        : contactChallenge?.destination;
      if (method === 'totp') {
        if (!enrollment) throw new Error('Start authenticator setup first.');
        await verifyFactor(enrollment.factorId, enrollment.challengeId, code);
      } else {
        if (!contactChallenge) throw new Error('Request a verification code first.');
        await verifyContactCode(method, contactChallenge.destination, code);
      }
      await markVerificationEnabled(method, destination ?? '');
      setSavedDestination(destination ?? '');
      setActiveMethod(method);
      clearSetup();
      Alert.alert('Verification Enabled', `${VERIFICATION_METHODS.find((item) => item.id === method)?.label} is now active for sign-in.`);
    } catch (cause) {
      Alert.alert('Could Not Verify', cause instanceof Error ? cause.message : 'The code could not be confirmed.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disableVerification();
      setActiveMethod(null);
      setMethod('totp');
      setSavedDestination('');
      clearSetup();
    } catch (cause) {
      Alert.alert('Could Not Turn Off', cause instanceof Error ? cause.message : 'Unable to turn off verification.');
    } finally {
      setBusy(false);
    }
  };

  const logOutOthers = () => {
    Alert.alert('Log Out Other Sessions?', 'All other devices will be signed out. This device stays signed in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out Others',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await revokeOtherProfileSessions();
            } catch (cause) {
              Alert.alert('Could Not Log Out Sessions', cause instanceof Error ? cause.message : 'Unable to log out other sessions.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const logOutSession = async (id: string) => {
    setPendingSession(id);
    try {
      await revokeProfileSession(id);
    } catch (cause) {
      Alert.alert('Could Not Log Out Device', cause instanceof Error ? cause.message : 'Unable to log out this device.');
    } finally {
      setPendingSession('');
    }
  };

  const activeOption = VERIFICATION_METHODS.find((item) => item.id === activeMethod);
  const destinationValue = method === 'email' ? emailAddress : method === 'sms' ? phoneNumber : whatsappNumber;
  const destinationProblem = method === 'totp' ? null : destinationError(method, destinationValue);
  const confirmDisabled = busy || code.length !== 6;

  return (
    <>
      <Text style={styles.sectionLabel}>SIGN-IN VERIFICATION</Text>
      <View style={styles.card}>
        <Text style={styles.description}>Choose how MindPulse confirms it&apos;s you when you sign in.</Text>
        {VERIFICATION_METHODS.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: method === option.id, disabled: !!activeMethod && activeMethod !== option.id }}
            onPress={() => {
              if (!activeMethod && !busy) {
                setMethod(option.id);
                clearSetup();
              }
            }}
            style={[
              styles.methodCard,
              method === option.id && styles.methodSelected,
              activeMethod === option.id && styles.methodActive,
            ]}
            disabled={!!activeMethod && activeMethod !== option.id || busy}
          >
            <View style={styles.methodHeading}>
              <Text style={styles.methodTitle}>{option.label}</Text>
              {option.recommended && <Text style={styles.recommended}>RECOMMENDED</Text>}
              {activeMethod === option.id && <Text style={styles.activeBadge}>ACTIVE</Text>}
            </View>
            <Text style={styles.description}>{option.description}</Text>
          </Pressable>
        ))}

        {loading ? (
          <ActivityIndicator color={tone('#5B6EF5')} style={styles.indicator} />
        ) : activeMethod && activeOption ? (
          <View style={styles.setupArea}>
            <Text style={styles.methodTitle}>{activeOption.label} is active</Text>
            <Text style={styles.description}>
              {activeMethod === 'totp' ? 'Use a code from your authenticator app to sign in.' : `Sign-in codes are sent to ${savedDestination}.`}
            </Text>
            <Pressable style={styles.secondaryButton} onPress={() => void turnOff()} disabled={busy}>
              <Text style={styles.secondaryText}>Turn Off Verification</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.setupArea}>
            {method === 'sms' && (
              <>
                <Text style={styles.fieldLabel}>Mobile number (Philippines local number or include country code)</Text>
                <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" editable={!contactChallenge} accessibilityLabel="Mobile number" />
                {destinationProblem && <Text style={styles.inputError}>{destinationProblem}</Text>}
              </>
            )}
            {method === 'email' && (
              <>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput style={styles.input} value={emailAddress} onChangeText={setEmailAddress} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!contactChallenge} accessibilityLabel="Email address" />
                {destinationProblem && <Text style={styles.inputError}>{destinationProblem}</Text>}
              </>
            )}
            {method === 'whatsapp' && (
              <>
                <Text style={styles.fieldLabel}>WhatsApp number (Philippines local number or include country code)</Text>
                <TextInput style={styles.input} value={whatsappNumber} onChangeText={setWhatsappNumber} keyboardType="phone-pad" editable={!contactChallenge} accessibilityLabel="WhatsApp number" />
                {destinationProblem && <Text style={styles.inputError}>{destinationProblem}</Text>}
              </>
            )}
            {enrollment && (
              <>
                <View style={styles.qrContainer}>
                  <AuthenticatorQrCode source={enrollment.qrCode} />
                </View>
                <Text style={styles.description}>Scan the QR code with your authenticator app, then enter its six-digit code.</Text>
              </>
            )}
            {(enrollment || contactChallenge) && (
              <>
                <Text style={styles.fieldLabel}>Verification code</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  accessibilityLabel="Verification code"
                />
                <Pressable
                  style={[styles.primaryButton, confirmDisabled && styles.buttonDisabled]}
                  onPress={() => void confirmSetup()}
                  disabled={confirmDisabled}
                >
                  <Text style={[styles.primaryText, confirmDisabled && styles.disabledPrimaryText]}>{busy ? 'Verifying…' : 'Verify and Enable'}</Text>
                </Pressable>
                {contactChallenge && (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      void sendContactCode(contactChallenge.method, contactChallenge.destination)
                        .then(() => Alert.alert('Code Sent', 'A new verification code was sent.'))
                        .catch((cause: unknown) => Alert.alert('Could Not Resend', cause instanceof Error ? cause.message : 'Unable to resend the code.'));
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.secondaryText}>Resend Code</Text>
                  </Pressable>
                )}
                <Pressable onPress={clearSetup} disabled={busy} style={styles.cancelButton}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
              </>
            )}
            {!enrollment && !contactChallenge && (
              <Pressable
                style={[styles.primaryButton, (busy || Boolean(destinationProblem)) && styles.buttonDisabled]}
                onPress={() => void startSetup()}
                disabled={busy || Boolean(destinationProblem)}
              >
                {busy ? <ActivityIndicator color="#fff" /> :                 <Text style={[styles.primaryText, Boolean(destinationProblem) && styles.disabledPrimaryText]}>{method === 'totp' ? 'Set Up Authenticator' : `Send ${method === 'sms' ? 'SMS' : method === 'email' ? 'Email' : 'WhatsApp'} Code`}</Text>}
              </Pressable>
            )}
            <Text style={styles.note}>Email, SMS, and WhatsApp codes use the Supabase verification-code service.</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>ACTIVE LOGIN SESSIONS</Text>
      <View style={styles.card}>
        <View style={styles.sessionHeading}>
          <Text style={styles.methodTitle}>Your signed-in devices</Text>
          <Text style={styles.status}>{sessions.status.toUpperCase()}</Text>
        </View>
        {!!sessions.message && sessions.status !== 'live' && <Text style={styles.note}>{sessions.message}</Text>}
        {!!sessions.notice && <Text style={styles.notice}>{sessions.notice}</Text>}
        {sessions.sessions.length === 0 ? (
          <Text style={styles.description}>No active devices are currently listed.</Text>
        ) : sessions.sessions.map((session) => (
          <View key={session.id} style={styles.sessionCard}>
            <View style={styles.sessionDetails}>
              <Text style={styles.methodTitle}>{session.deviceName}</Text>
              <Text style={styles.description}>{session.roleLabel} · {session.browser}</Text>
              <Text style={styles.note}>{session.operatingSystem} · {session.isCurrent ? 'Current device' : new Date(session.lastActiveAt).toLocaleString()}</Text>
            </View>
            {!session.isCurrent && (
              <Pressable onPress={() => void logOutSession(session.id)} disabled={pendingSession === session.id}>
                <Text style={styles.removeText}>{pendingSession === session.id ? '…' : 'Log Out'}</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable style={styles.secondaryButton} onPress={logOutOthers} disabled={busy}>
          <Text style={styles.secondaryText}>{busy ? 'Working…' : 'Log Out All Other Sessions'}</Text>
        </Pressable>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: toneBg('#FFFFFF'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: toneBg('#E2E8F0'),
    padding: 14,
    gap: 10,
  },
  description: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  inputError: { fontSize: 11, lineHeight: 15, color: tone('#B42318') },
  methodCard: {
    padding: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: toneBg('#D6E0E8'),
    borderRadius: 10,
  },
  methodSelected: { backgroundColor: toneBg('#F1FBFC'), borderColor: toneBg('#5B6EF5') },
  methodActive: { backgroundColor: toneBg('#EEFaf6'), borderColor: toneBg('#27AE60') },
  methodHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  methodTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  recommended: { fontSize: 8, fontWeight: '800', color: '#fff', backgroundColor: toneBg('#5B6EF5'), paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  activeBadge: { fontSize: 8, fontWeight: '800', color: '#fff', backgroundColor: toneBg('#27AE60'), paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  setupArea: { borderTopWidth: 1, borderTopColor: toneBg('#E2E8F0'), paddingTop: 12, gap: 10 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: toneBg('#D6E0E8'),
    borderRadius: 9,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    backgroundColor: toneBg('#F8FAFC'),
    fontSize: 14,
  },
  primaryButton: { backgroundColor: toneBg('#5B6EF5'), borderRadius: 9, padding: 12, alignItems: 'center', minHeight: 42, justifyContent: 'center' },
  buttonDisabled: { backgroundColor: toneBg('#CBD5E1') },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disabledPrimaryText: { color: tone('#64748B') },
  secondaryButton: { borderWidth: 1, borderColor: toneBg('#D6E0E8'), borderRadius: 9, padding: 11, alignItems: 'center' },
  secondaryText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 8 },
  note: { color: Colors.textSecondary, fontSize: 10, lineHeight: 15 },
  indicator: { padding: 14 },
  qrContainer: { width: 220, height: 220, overflow: 'hidden', alignSelf: 'center', backgroundColor: '#fff' },
  sessionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  status: { fontSize: 9, fontWeight: '800', color: tone('#5B6EF5') },
  sessionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: toneBg('#E2E8F0'), paddingTop: 10 },
  sessionDetails: { flex: 1, gap: 3 },
  removeText: { color: tone('#B42318'), fontSize: 11, fontWeight: '700' },
  notice: { color: tone('#1E7E43'), fontSize: 11 },
});
