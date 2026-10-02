import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { TransactionItem, fetchMyTransactions, formatTransactionDate } from '../../services/transactions';

const METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  gcash: 'GCash',
  maya: 'Maya',
};

const formatAmount = (amount: number): string =>
  `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TransactionsSection: React.FC = () => {
  const [rows, setRows] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchMyTransactions());
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Could not load your transaction history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPaid = useMemo(
    () => rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0),
    [rows],
  );

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.stateText}>Loading your transactions…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.stateBox}>
          <Ionicons name="cloud-offline-outline" size={26} color={Colors.textHint} />
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.stateBox}>
          <Ionicons name="receipt-outline" size={26} color={Colors.textHint} />
          <Text style={styles.stateText}>No transactions yet. Paid consultations will show up here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TOTAL PAID</Text>
        <Text style={styles.summaryValue}>{formatAmount(totalPaid)}</Text>
        <Text style={styles.summarySub}>
          {rows.length} transaction{rows.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Transaction history</Text>
        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="wallet-outline" size={16} color={tone('#5B6EF5')} />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{row.doctorName}</Text>
              <Text style={styles.rowMeta}>
                {row.scheduledFor
                  ? `Consultation · ${row.scheduledFor}`
                  : 'Consultation'}
              </Text>
              <Text style={styles.rowDate}>{formatTransactionDate(row.createdAt)}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>{formatAmount(row.amount)}</Text>
              <Text style={styles.rowMethod}>{METHOD_LABELS[row.method] ?? row.method}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: row.status === 'paid' ? toneBg('#D6F5E3') : toneBg('#FFF3CD') },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: row.status === 'paid' ? tone('#27AE60') : tone('#E08A00') },
                  ]}
                >
                  {row.status === 'paid' ? 'Paid' : 'Refunded'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  summaryCard: {
    backgroundColor: toneBg('#EEEDFE'),
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: tone('#5B6EF5') },
  summaryValue: { fontSize: 26, fontWeight: '800', color: tone('#5B6EF5') },
  summarySub: { fontSize: 11, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },

  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  stateText: { fontSize: 13, color: Colors.textHint, textAlign: 'center', lineHeight: 19 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.primary },
  retryText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: toneBg('#EEEDFE'),
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  rowMeta: { fontSize: 11, color: Colors.textSecondary },
  rowDate: { fontSize: 10, color: Colors.textHint },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowAmount: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  rowMethod: { fontSize: 10, color: Colors.textSecondary },
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 9, fontWeight: '800' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
