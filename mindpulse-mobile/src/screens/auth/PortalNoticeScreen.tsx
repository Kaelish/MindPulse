import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { registerThemeStyles } from '../../theme/theme';

interface PortalNoticeScreenProps {
  kind: 'admin' | 'pending';
  onSignOut?: () => void;
}

/**
 * Full-screen gate shown after login when the account is not a student or a
 * verified doctor: admins are pointed at the web portal, unverified doctors
 * are told they are awaiting approval. Never shows the patient UI.
 */
export const PortalNoticeScreen: React.FC<PortalNoticeScreenProps> = ({ kind, onSignOut }) => {
  const isAdmin = kind === 'admin';
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: isAdmin ? Colors.tagBlueBg : Colors.tagYellowBg }]}>
          <Ionicons
            name={isAdmin ? 'desktop-outline' : 'time-outline'}
            size={38}
            color={isAdmin ? Colors.tagBlueText : Colors.tagYellowText}
          />
        </View>

        <Text style={styles.title}>{isAdmin ? 'Admin tools are on the web' : 'Account pending approval'}</Text>

        <Text style={styles.body}>
          {isAdmin
            ? 'The MindPulse admin dashboard is available on the web portal. Sign in at the MindPulse website from a computer to manage users, assessments, and settings.'
            : 'Your doctor account is awaiting verification by an administrator. Once approved, sign in again to reach your doctor dashboard here.'}
        </Text>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name="person-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.chipText}>{isAdmin ? 'Admin account' : 'Doctor account'}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={18} color={Colors.white} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg, paddingHorizontal: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 21, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 8 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    // Fixed navy: `Colors.textPrimary` flips to near-white in dark mode, which
    // would swallow the white label on this button.
    backgroundColor: '#1A2340',
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginBottom: Spacing.lg,
  },
  signOutText: { color: Colors.white, fontWeight: '800', fontSize: 14.5 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
