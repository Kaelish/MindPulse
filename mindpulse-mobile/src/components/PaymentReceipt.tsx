import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import { formatTransactionDate } from '../services/transactions';

/**
 * Everything a payment receipt needs. Built from a `payments` row (see
 * TransactionItem on the list screens, or assembled right after checkout).
 */
export interface PaymentReceiptData {
  reference: string;
  createdAt: string;
  amount: number;
  method: string;
  status: string;
  /** Who received the money — the doctor's name on the patient side. */
  payeeName: string;
  scheduledFor?: string | null;
}

interface PaymentReceiptProps {
  receipt: PaymentReceiptData;
  /** Green "Payment Successful" banner — shown right after checkout. */
  showSuccessBanner?: boolean;
  /** Back arrow / Done handler — closes the receipt. */
  onBack: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  gcash: 'GCash',
  maya: 'Maya',
};

const formatAmount = (amount: number): string =>
  `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReceiptRow: React.FC<{ label: string; value: string; emphasized?: boolean; last?: boolean }> = ({
  label,
  value,
  emphasized,
  last,
}) => (
  <View style={[styles.row, last && styles.rowLast]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, emphasized && styles.rowValueEmphasized]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

/**
 * Official-looking payment receipt shared by the transaction history and the
 * post-checkout popup. Always renders a back arrow so the user can return to
 * wherever they came from.
 */
export const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
  receipt,
  showSuccessBanner,
  onBack,
}) => {
  const isPaid = receipt.status !== 'refunded';
  const statusLabel = isPaid ? 'Paid' : 'Refunded';

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Receipt</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showSuccessBanner && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={tone('#27AE60')} />
            <Text style={styles.successText}>
              Payment Successful — your appointment is confirmed.
            </Text>
          </View>
        )}

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>{isPaid ? 'AMOUNT PAID' : 'AMOUNT REFUNDED'}</Text>
          <Text style={styles.amount}>{formatAmount(receipt.amount)}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isPaid ? toneBg('#D6F5E3') : toneBg('#FFF3CD') },
            ]}
          >
            <Text style={[styles.statusText, { color: isPaid ? tone('#27AE60') : tone('#E08A00') }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <ReceiptRow label="Reference No." value={receipt.reference} emphasized />
          <ReceiptRow label="Date" value={formatTransactionDate(receipt.createdAt)} />
          <ReceiptRow label="Paid to" value={receipt.payeeName || 'Clinician'} />
          <ReceiptRow label="Service" value="Online consultation" />
          {receipt.scheduledFor ? <ReceiptRow label="Session" value={receipt.scheduledFor} /> : null}
          <ReceiptRow label="Method" value={METHOD_LABELS[receipt.method] ?? receipt.method} />
          <ReceiptRow label="Status" value={statusLabel} last />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            MindPulse mock payment — no real charge was made.
          </Text>
          <Text style={styles.footerNote}>
            Computer-generated receipt · keep for your records.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.doneBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Close receipt"
      >
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    wrap: {
      backgroundColor: Colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: toneBg('#F3F5F9'),
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '800',
      color: Colors.textPrimary,
    },
    headerSpacer: { width: 32 },

    scroll: { flexGrow: 0, maxHeight: 420 },
    scrollContent: { padding: 16, gap: 14 },

    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: toneBg('#B7E7CB'),
      backgroundColor: toneBg('#D6F5E3'),
    },
    successText: { flex: 1, fontSize: 12, fontWeight: '700', color: tone('#1E8E4E'), lineHeight: 17 },

    amountBlock: { alignItems: 'center', gap: 4 },
    amountLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: Colors.textHint },
    amount: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
    statusBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3, marginTop: 4 },
    statusText: { fontSize: 10, fontWeight: '800' },

    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.divider,
      backgroundColor: toneBg('#FAFBFD'),
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { fontSize: 12, color: Colors.textSecondary, flexShrink: 0 },
    rowValue: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textPrimary,
      textAlign: 'right',
      flex: 1,
    },
    rowValueEmphasized: { fontWeight: '800', letterSpacing: 0.3 },

    footer: { alignItems: 'center', gap: 3 },
    footerNote: { fontSize: 10, color: Colors.textHint, textAlign: 'center', lineHeight: 15 },

    doneBtn: {
      marginHorizontal: 16,
      marginBottom: 16,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: Colors.primary,
    },
    doneText: { fontSize: 13, fontWeight: '800', color: Colors.white },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
