import React, { useCallback, useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
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
  notificationFullTime,
} from '../services/notifications';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

export type PatientNotificationTab = 'home' | 'analysis' | 'clinics' | 'profile';

interface PatientNotificationsProps {
  /** onGradient sits on the green dashboard header, onLight on white headers. */
  variant?: 'onGradient' | 'onLight';
  /** Chat rows hand off here so the app can land on the Messages thread. */
  onOpenMessages?: () => void;
  /** Appointment rows land on Clinics, alert rows on the Analysis tab. */
  onNavigateTab?: (tab: PatientNotificationTab) => void;
}

/** Newest entries shown before the sheet expands to the full history. */
const RECENT_LIMIT = 5;

interface RowVisual {
  icon: string;
  tileBg: string;
  iconColor: string;
  unreadBg: string;
  accent: string;
}

/** Each notification type gets its own colour so the feed reads at a glance. */
const visualFor = (row: FeedNotification): RowVisual => {
  if (isMessageNotification(row)) {
    return {
      icon: 'chatbubbles',
      tileBg: '#E6F8ED',
      iconColor: '#27AE60',
      unreadBg: '#F3FCF7',
      accent: '#27AE60',
    };
  }
  if (row.type === 'alert') {
    return {
      icon: 'warning',
      tileBg: '#FDEAEB',
      iconColor: '#E74C3C',
      unreadBg: '#FFF6F5',
      accent: '#E74C3C',
    };
  }
  if (row.type === 'appointment') {
    return {
      icon: 'calendar',
      tileBg: '#E9F5FF',
      iconColor: '#4A90E2',
      unreadBg: '#F5FAFF',
      accent: '#4A90E2',
    };
  }
  return {
    icon: 'information-circle',
    tileBg: '#F0EBFE',
    iconColor: '#7B61FF',
    unreadBg: '#F8F6FF',
    accent: '#7B61FF',
  };
};

/** Rows that lead somewhere once opened; plain info rows only get marked read. */
const notificationRoute = (row: FeedNotification): PatientNotificationTab | 'messages' | null => {
  if (isMessageNotification(row)) return 'messages';
  if (row.type === 'appointment') return 'clinics';
  if (row.type === 'alert') return 'analysis';
  return null;
};

const isRoutable = (row: FeedNotification) => notificationRoute(row) !== null;

/**
 * Patient bell + notification sheet: a colourful, type-coded feed with a
 * "Mark as read" action and a "See all" toggle between the five newest
 * entries and the complete history. Tapping a row opens the screen it
 * belongs to (messages thread, appointments, analysis).
 */
export const PatientNotifications: React.FC<PatientNotificationsProps> = ({
  variant = 'onLight',
  onOpenMessages,
  onNavigateTab,
}) => {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FeedNotification[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [marking, setMarking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    refreshUnread();
  }, [refreshUnread]);

  const openSheet = () => {
    setExpanded(false);
    setOpen(true);
  };

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
   * Opening a notification is the act of reading it: clear the dot, then hand
   * the row to the screen it belongs to.
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
    const route = notificationRoute(row);
    if (route) {
      close();
      if (route === 'messages') onOpenMessages?.();
      else onNavigateTab?.(route);
    }
  };

  const gradient = variant === 'onGradient';
  const unreadCount = rows.filter((row) => !row.read).length;
  const total = rows.length;
  // Newest first; collapsed shows only the latest few until "See all".
  const visible = (expanded ? rows : rows.slice(-RECENT_LIMIT)).slice().reverse();
  const canExpand = total > RECENT_LIMIT;

  return (
    <>
      <TouchableOpacity
        style={[styles.bell, gradient ? styles.bellGradient : styles.bellLight]}
        onPress={openSheet}
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
            {/* ── Gradient header with the two actions ── */}
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              colors={['#5B6EF5', '#8353E2']}
              style={styles.sheetHead}
            >
              <View style={styles.headIcon}>
                <Ionicons name="notifications" size={17} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Notifications</Text>
                <Text style={styles.sheetSub}>
                  {unreadCount > 0 ? `${unreadCount} unread · ` : ''}{total} total
                </Text>
              </View>
              {!loading && !error && unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markBtn}
                  onPress={() => void markAll()}
                  disabled={marking}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all notifications as read"
                >
                  {marking ? (
                    <ActivityIndicator size="small" color="#5B6EF5" />
                  ) : (
                    <Text style={styles.markBtnText}>Mark as read</Text>
                  )}
                </TouchableOpacity>
              )}
              <Pressable
                onPress={close}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </LinearGradient>

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

              {!loading && !error && total === 0 && (
                <View style={styles.stateBox}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="notifications-off-outline" size={26} color={tone('#5B6EF5')} />
                  </View>
                  <Text style={styles.stateTitle}>No notifications yet</Text>
                  <Text style={styles.stateText}>
                    Assessment alerts, appointment updates and clinician messages will appear here.
                  </Text>
                </View>
              )}

              {!loading && !error && total > 0 && (
                <>
                  <Text style={styles.listLabel}>
                    {expanded ? 'ALL NOTIFICATIONS' : `RECENT · SHOWING ${visible.length} OF ${total}`}
                  </Text>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    style={styles.listScroll}
                  >
                    {visible.map((row) => {
                      const visual = visualFor(row);
                      return (
                        <TouchableOpacity
                          key={row.id}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={`Open notification: ${row.title}`}
                          onPress={() => openNotification(row)}
                          style={[
                            styles.row,
                            { backgroundColor: toneBg(visual.tileBg) },
                            !row.read && { backgroundColor: toneBg(visual.unreadBg), borderLeftColor: visual.accent },
                          ]}
                        >
                          <View style={[styles.iconTile, { backgroundColor: toneBg('#FFFFFF') }]}>
                            <Ionicons name={visual.icon as any} size={18} color={tone(visual.iconColor)} />
                          </View>
                          <View style={styles.rowBody}>
                            <View style={styles.rowHead}>
                              <Text style={[styles.rowTitle, !row.read && styles.rowTitleUnread]} numberOfLines={1}>
                                {row.title}
                              </Text>
                              {!row.read && (
                                <View style={[styles.unreadTag, { backgroundColor: visual.accent }]}>
                                  <Text style={styles.unreadTagText}>Unread</Text>
                                </View>
                              )}
                            </View>
                            {!!row.message && (
                              <Text style={styles.rowMessage} numberOfLines={2}>{row.message}</Text>
                            )}
                            <View style={styles.rowFoot}>
                              <Ionicons name="time-outline" size={11} color={Colors.textHint} />
                              <Text style={styles.rowTime}>{notificationFullTime(row.createdAt)}</Text>
                              {isRoutable(row) && (
                                <View style={styles.openHint}>
                                  <Text style={styles.openHintText}>Open</Text>
                                  <Ionicons name="arrow-forward" size={11} color={tone('#5B6EF5')} />
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </View>

            {/* ── See all / Show less toggle ── */}
            {!loading && !error && canExpand && (
              <TouchableOpacity
                style={[styles.seeAllBtn, expanded && styles.seeAllBtnGhost]}
                onPress={() => setExpanded((value) => !value)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Show recent notifications only' : `See all ${total} notifications`}
              >
                <Text style={[styles.seeAllText, expanded && styles.seeAllTextGhost]}>
                  {expanded ? 'Show recent only' : `See all (${total})`}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={expanded ? tone('#5B6EF5') : '#FFFFFF'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = () => StyleSheet.create({
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bellGradient: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' },
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
    paddingBottom: 16,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 16.5, fontWeight: '900', color: '#FFFFFF' },
  sheetSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
  markBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: Radius.full,
    minWidth: 96,
    alignItems: 'center',
  },
  markBtnText: { color: '#5B6EF5', fontSize: 12, fontWeight: '900' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetBody: { paddingHorizontal: 14, paddingTop: 12, flexShrink: 1 },
  listLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  listScroll: { maxHeight: 400 },
  listContent: { gap: 9, paddingBottom: 4 },

  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 30, paddingHorizontal: 16 },
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
    backgroundColor: Colors.btnBlue,
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
    gap: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  rowBody: { flex: 1, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  rowTitleUnread: { fontWeight: '900' },
  rowMessage: { fontSize: 12.5, color: Colors.textSecondary, lineHeight: 17 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowTime: { fontSize: 10.5, color: Colors.textHint, fontWeight: '600' },
  openHint: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  openHintText: { fontSize: 10.5, fontWeight: '800', color: tone('#5B6EF5') },
  unreadTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  unreadTagText: { color: Colors.white, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: '#5B6EF5',
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  seeAllBtnGhost: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: tone('#5B6EF5'),
  },
  seeAllText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  seeAllTextGhost: { color: tone('#5B6EF5') },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
