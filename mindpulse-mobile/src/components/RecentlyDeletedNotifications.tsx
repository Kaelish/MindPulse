import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import { DeletedNotification, deletedAtLabel, fetchDeletedNotifications } from '../services/trash';
import { restoreNotification } from '../services/notifications';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../theme/theme';

interface RecentlyDeletedNotificationsProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Fired after each successful restore so the host sheet can rebuild its
   * feed — the row it just un-archived is no longer in the trash, and it has
   * reappeared in the active list.
   */
  onRestored?: () => void;
}

/**
 * Mobile "Recently Deleted" for notifications (doctor + patient).
 *
 * Reads archived rows through the shared list_deleted_rows RPC and restores
 * them one at a time via restoreNotification, which pins the write to the
 * signed-in account. Nothing here ever issues a hard DELETE: restoring only
 * clears is_deleted / deleted_at / deleted_by, so the row survives either way.
 */
export const RecentlyDeletedNotifications: React.FC<RecentlyDeletedNotificationsProps> = ({
  visible,
  onClose,
  onRestored,
}) => {
  const [items, setItems] = useState<DeletedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    fetchDeletedNotifications()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((e: any) => {
        if (active) setError(e?.message || 'Could not load recently deleted notifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, reloadKey]);

  const close = useCallback(() => {
    setNotice('');
    onClose();
  }, [onClose]);

  /** Un-archive one row: clears the flag, drops it from this list, refreshes the feed. */
  const restore = async (item: DeletedNotification) => {
    if (restoringId) return;
    setRestoringId(item.id);
    setNotice('');
    try {
      await restoreNotification(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setNotice(`"${item.title}" restored to your notifications.`);
      onRestored?.();
    } catch (e: any) {
      setNotice('');
      setError(e?.message || 'That notification could not be restored.');
    } finally {
      setRestoringId(null);
    }
  };

  const retry = () => {
    setError('');
    setReloadKey((key) => key + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="Close recently deleted"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={styles.headIcon}>
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>Recently Deleted</Text>
              <Text style={styles.sheetSub}>
                {loading ? 'Loading…' : `${items.length} archived · restore to bring back`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close recently deleted"
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetBody}>
            {loading && (
              <View style={styles.stateBox}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.stateText}>Loading archived notifications…</Text>
              </View>
            )}

            {!loading && !!error && (
              <View style={styles.stateBox}>
                <Ionicons name="cloud-offline-outline" size={26} color={Colors.textHint} />
                <Text style={styles.stateText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={retry}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && !!notice && (
              <View style={styles.notice}>
                <Ionicons name="checkmark-circle" size={14} color={tone('#27AE60')} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            {!loading && !error && items.length === 0 && (
              <View style={styles.stateBox}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="trash-bin-outline" size={26} color={tone('#5B6EF5')} />
                </View>
                <Text style={styles.stateTitle}>Nothing archived</Text>
                <Text style={styles.stateText}>
                  Notifications you archive from your feed are kept here, and can be restored at any
                  time.
                </Text>
              </View>
            )}

            {!loading && !error && items.length > 0 && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {items.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {!!item.message && (
                        <Text style={styles.rowMessage} numberOfLines={2}>
                          {item.message}
                        </Text>
                      )}
                      <View style={styles.rowFoot}>
                        <Ionicons name="time-outline" size={11} color={Colors.textHint} />
                        <Text style={styles.rowTime}>
                          {item.deletedAt
                            ? `Archived ${deletedAtLabel(item.deletedAt)}`
                            : 'Archived'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      onPress={() => void restore(item)}
                      disabled={restoringId !== null}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Restore notification: ${item.title}`}
                    >
                      {restoringId === item.id ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Ionicons name="refresh" size={13} color={Colors.white} />
                      )}
                      <Text style={styles.restoreText}>
                        {restoringId === item.id ? 'Restoring…' : 'Restore'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    sheet: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '84%',
      backgroundColor: Colors.surface,
      borderRadius: 24,
      overflow: 'hidden',
      paddingBottom: 14,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
    },
    headIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: tone('#5B6EF5'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetHeading: { flex: 1 },
    sheetTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
    sheetSub: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetBody: { paddingHorizontal: 14, paddingTop: 12 },
    listContent: { gap: 9, paddingBottom: 4 },

    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 26,
      paddingHorizontal: 16,
    },
    stateTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
    stateText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
    emptyIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: toneBg('#EEEDFE'),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    retryBtn: {
      marginTop: 4,
      backgroundColor: toneBtn(Colors.btnBlue),
      paddingHorizontal: 20,
      paddingVertical: 9,
      borderRadius: Radius.full,
    },
    retryText: { color: Colors.white, fontSize: 13, fontWeight: '800' },

    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: toneBg('#E6F8ED'),
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    noticeText: { flex: 1, color: tone('#1E8E5A'), fontSize: 12, fontWeight: '700' },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.lg,
      backgroundColor: toneBg('#FBFCFE'),
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    rowBody: { flex: 1, gap: 3 },
    rowTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
    rowMessage: { fontSize: 12.5, color: Colors.textSecondary, lineHeight: 17 },
    rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    rowTime: { fontSize: 10.5, color: Colors.textHint, fontWeight: '600' },
    restoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: toneBtn('#27AE60'),
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: Radius.full,
      alignSelf: 'center',
    },
    restoreText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
