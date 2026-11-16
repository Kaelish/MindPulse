import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
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
import { NOTIFICATION_PREFS_CHANGED_EVENT } from '../services/notificationPrefs';
import {
  FeedNotification,
  fetchAllNotifications,
  fetchUnreadNotificationCount,
  isMessageNotification,
  markAllNotificationsRead,
  markNotificationRead,
  dismissNotification,
  notificationFullTime,
  subscribeToMyNotificationFeed,
} from '../services/notifications';
import { RecentlyDeletedNotifications } from './RecentlyDeletedNotifications';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../theme/theme';

interface DoctorNotificationsProps {
  /** onGradient sits on the purple dashboard header, onLight on white headers. */
  variant?: 'onGradient' | 'onLight';
  /** Chat rows hand off here so the app can land on the Messages thread. */
  onOpenMessages?: () => void;
}

const makeDotColors = (): Record<FeedNotification['type'], string> => ({
  alert: Colors.tagRedText,
  appointment: Colors.btnBlue,
  info: Colors.textHint,
});

let DOT_COLORS = makeDotColors();
registerThemeStyles(() => {
  DOT_COLORS = makeDotColors();
});

/**
 * Doctor bell + full notification history (past → recent), mirroring the web
 * portal: tap the bell to open the complete list, mark everything as read.
 */
export const DoctorNotifications: React.FC<DoctorNotificationsProps> = ({ variant = 'onLight', onOpenMessages }) => {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [marking, setMarking] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);

  const refreshUnread = useCallback(() => {
    fetchUnreadNotificationCount()
      .then(setUnread)
      .catch(() => setUnread(0));
  }, []);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  // Settings changes rebuild the badge (and the open list) right away.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(NOTIFICATION_PREFS_CHANGED_EVENT, () => {
      refreshUnread();
      setReloadKey((key) => key + 1);
    });
    return () => subscription.remove();
  }, [refreshUnread]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;
    void subscribeToMyNotificationFeed(() => {
      if (!active) return;
      refreshUnread();
      setReloadKey((key) => key + 1);
    }).then((unsubscribe) => {
      if (!active) unsubscribe();
      else cleanup = unsubscribe;
    });
    return () => {
      active = false;
      if (cleanup) cleanup();
    };
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    setActionError('');
    fetchAllNotifications()
      .then((items) => {
        if (active) setRows(items);
      })
      .catch((e: any) => {
        if (active) setError(e?.message || 'Could not load notifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, reloadKey]);

  // Past → recent reading, so land on the newest entry.
  useEffect(() => {
    if (loading || rows.length === 0) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    return () => clearTimeout(timer);
  }, [loading, rows]);

  const close = useCallback(() => {
    setOpen(false);
    refreshUnread();
  }, [refreshUnread]);

  const markAll = async () => {
    setMarking(true);
    setActionError('');
    try {
      await markAllNotificationsRead();
      setRows((current) => current.map((row) => ({ ...row, read: true })));
      setUnread(0);
    } catch (e: any) {
      setActionError(e?.message || 'Could not mark notifications as read.');
    } finally {
      setMarking(false);
    }
  };

  /**
   * Archive (B-2): soft-delete the row from my own list — sets is_deleted so
   * the row is preserved but hidden — optimistic removal with a
   * position-preserving rollback; the unread badge follows the row.
   */
  const dismiss = async (row: FeedNotification) => {
    if (dismissingId) return;
    const index = rows.findIndex((item) => item.id === row.id);
    setDismissingId(row.id);
    setActionError('');
    setRows((current) => current.filter((item) => item.id !== row.id));
    if (!row.read) setUnread((count) => Math.max(0, count - 1));
    try {
      await dismissNotification(row.id);
    } catch (e: any) {
      setRows((current) => {
        if (current.some((item) => item.id === row.id)) return current;
        const next = [...current];
        next.splice(Math.max(0, Math.min(index, next.length)), 0, row);
        return next;
      });
      if (!row.read) setUnread((count) => count + 1);
      setActionError(e?.message || 'Could not archive this notification.');
    } finally {
      setDismissingId(null);
    }
  };

  /**
   * Opening a notification is the act of reading it: clear the dot, then hand
   * chat rows straight to the message thread.
   */
  const openNotification = (row: FeedNotification) => {
    const wasUnread = !row.read;
    if (wasUnread) {
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, read: true } : item)));
      setUnread((count) => Math.max(0, count - 1));
      void markNotificationRead(row.id).catch(() => {
        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, read: false } : item)));
        setUnread((count) => count + 1);
      });
    }
    if (isMessageNotification(row)) {
      close();
      onOpenMessages?.();
    }
  };

  const gradient = variant === 'onGradient';
  const unreadCount = rows.filter((row) => !row.read).length;

  return (
    <>
      <TouchableOpacity
        style={[styles.bell, gradient ? styles.bellGradient : styles.bellLight]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Ionicons
          name={unread > 0 ? 'notifications' : 'notifications-outline'}
          size={19}
          color={gradient ? Colors.white : Colors.primaryDark}
        />
        {unread > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close notifications" />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeading}>
                <Text style={styles.sheetTitle}>All notifications</Text>
                <Text style={styles.sheetSub}>Past to recent · {rows.length} shown</Text>
              </View>
              <View style={styles.sheetActions}>
                {!loading && !error && unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllBtn}
                    onPress={() => void markAll()}
                    disabled={marking}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.markAllText}>{marking ? 'Marking…' : 'Mark all'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close notifications">
                  <Ionicons name="close" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBody}>
              {loading && (
                <View style={styles.stateBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.stateText}>Loading your notifications…</Text>
                </View>
              )}

              {!loading && !!error && (
                <View style={styles.stateBox}>
                  <Ionicons name="cloud-offline-outline" size={26} color={Colors.textHint} />
                  <Text style={styles.stateText}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => setReloadKey((key) => key + 1)}>
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!loading && !error && !!actionError && (
                <View style={styles.actionError}>
                  <Text style={styles.actionErrorText}>{actionError}</Text>
                </View>
              )}

              {!loading && !error && rows.length === 0 && (
                <View style={styles.stateBox}>
                  <Ionicons name="notifications-off-outline" size={26} color={Colors.textHint} />
                  <Text style={styles.stateTitle}>No notifications yet</Text>
                  <Text style={styles.stateText}>
                    Assessment alerts, appointment updates and weekly digests will appear here.
                  </Text>
                </View>
              )}

              {!loading && !error && rows.length > 0 && (
                <ScrollView
                  ref={listRef}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                >
                  {rows.map((row) => (
                    <TouchableOpacity
                      key={row.id}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Open notification: ${row.title}`}
                      onPress={() => openNotification(row)}
                      style={[styles.row, !row.read && styles.rowUnread, !row.read && { borderColor: DOT_COLORS[row.type] }]}
                    >
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: row.read ? Colors.textHint : DOT_COLORS[row.type] },
                        ]}
                      />
                      <View style={styles.rowBody}>
                        <View style={styles.rowHead}>
                          <Text style={[styles.rowTitle, !row.read && styles.rowTitleUnread]} numberOfLines={1}>
                            {row.title}
                          </Text>
                          <Text style={styles.rowTime}>{notificationFullTime(row.createdAt)}</Text>
                        </View>
                        {!!row.message && (
                          <Text style={styles.rowMessage}>{row.message}</Text>
                        )}
                      </View>
                      {!row.read && (
                        <View style={styles.unreadTag}>
                          <Text style={styles.unreadTagText}>Unread</Text>
                        </View>
                      )}
                      {isMessageNotification(row) && (
                        <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
                      )}
                      <Pressable
                        onPress={() => void dismiss(row)}
                        disabled={dismissingId === row.id}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Archive notification: ${row.title}`}
                        style={styles.dismissBtn}
                      >
                        <Ionicons
                          name={dismissingId === row.id ? 'hourglass-outline' : 'close'}
                          size={14}
                          color={Colors.textHint}
                        />
                      </Pressable>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Recently Deleted — the archive target of the ✕ above. */}
            {!loading && !error && (
              <View style={styles.trashRow}>
                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() => setTrashOpen(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Open recently deleted notifications"
                >
                  <Ionicons name="trash-outline" size={15} color={tone('#5B6EF5')} />
                  <Text style={styles.trashBtnText}>Recently Deleted</Text>
                  <Ionicons name="chevron-forward" size={15} color={tone('#5B6EF5')} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <RecentlyDeletedNotifications
        visible={trashOpen}
        onClose={() => setTrashOpen(false)}
        onRestored={() => {
          refreshUnread();
          setReloadKey((key) => key + 1);
        }}
      />
    </>
  );
};

const makeStyles = () => StyleSheet.create({
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bellGradient: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.35)' },
  bellLight: { backgroundColor: Colors.surface, borderColor: Colors.border },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.tagRedText,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: Colors.white, fontSize: 9.5, fontWeight: '900' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  sheetHeading: { flex: 1 },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
  sheetSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  markAllText: { color: Colors.primaryDark, fontSize: 12, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetBody: { paddingHorizontal: 16, paddingTop: 14, minHeight: 200 },
  listContent: { gap: 10, paddingBottom: 6 },

  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 34, paddingHorizontal: 18 },
  stateTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  stateText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 4,
    backgroundColor: toneBtn(Colors.btnBlue),
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: Radius.full,
  },
  retryText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  actionError: {
    backgroundColor: Colors.tagRedBg,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  actionErrorText: { color: Colors.tagRedText, fontSize: 12, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: toneBg('#FBFCFE'),
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowUnread: { backgroundColor: Colors.primaryLight },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowBody: { flex: 1, gap: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  rowTitleUnread: { fontWeight: '900' },
  rowTime: { fontSize: 10.5, color: Colors.textSecondary },
  rowMessage: { fontSize: 12.5, color: Colors.textSecondary, lineHeight: 18 },
  unreadTag: {
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: toneBtn(Colors.btnBlue),
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  unreadTagText: { color: Colors.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },

  trashRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  trashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: tone('#5B6EF5'),
  },
  trashBtnText: { fontSize: 13, fontWeight: '900', color: tone('#5B6EF5') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
