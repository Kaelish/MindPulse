import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { DoctorNotifications } from '../../components/DoctorNotifications';
import {
  DoctorAvailability,
  DoctorChatMessage,
  DoctorConsultation,
  approveAppointment,
  declineAppointment,
  editAppointmentTime,
  fetchDoctorAvailability,
  fetchDoctorChatMessages,
  fetchDoctorChatThreads,
  fetchDoctorConsultations,
  markDoctorThreadRead,
  saveDoctorAvailability,
  sendDoctorChatMessage,
  subscribeToDoctorAppointments,
  subscribeToDoctorMessages,
} from '../../services/doctorConsultations';
import { consultationModeLabel, generateRealLifeDates, isDateUnavailable, isSlotInPast, WEEKDAY_KEYS } from '../../services/appointments';
import {
  ChatThreadSummary,
  PickedAttachment,
  formatThreadTime,
  pickDocumentAttachment,
  pickImageAttachment,
  previewLabelFor,
} from '../../services/chat';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../../theme/theme';
import {
  PATIENT_FILE_CATEGORIES,
  PatientFileCategory,
  uploadPatientFile,
} from '../../services/patientFiles';

type ConsultTab = 'upcoming' | 'history' | 'messages';

/** Set by App.tsx when a notification routes into a specific sub-tab. */
export interface ConsultTabRequest {
  tab: ConsultTab;
  /** Bumped per request so the same tab can be asked for twice in a row. */
  nonce: number;
}

interface DoctorConsultationsScreenProps {
  openTabRequest?: ConsultTabRequest | null;
}

const UPCOMING_STATUSES = ['scheduled', 'awaiting_payment', 'confirmed'] as const;
const HISTORY_STATUSES = ['declined', 'completed', 'cancelled'] as const;

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Requested',
  awaiting_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const makeStatusColors = (): Record<string, { bg: string; text: string }> => ({
  scheduled: { bg: toneBg('#FCECEC'), text: tone('#C05656') },
  awaiting_payment: { bg: Colors.tagBlueBg, text: Colors.tagBlueText },
  confirmed: { bg: Colors.tagGreenBg, text: Colors.tagGreenText },
  completed: { bg: Colors.divider, text: Colors.textSecondary },
  declined: { bg: Colors.tagRedBg, text: Colors.tagRedText },
  cancelled: { bg: Colors.divider, text: Colors.textHint },
});

let STATUS_COLORS = makeStatusColors();
registerThemeStyles(() => {
  STATUS_COLORS = makeStatusColors();
});

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const TabPill = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.tabPill, active && styles.tabPillActive]} onPress={onPress} activeOpacity={0.8}>
    <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const DoctorConsultationsScreen: React.FC<DoctorConsultationsScreenProps> = ({
  openTabRequest = null,
}) => {
  const [items, setItems] = useState<DoctorConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [consultTab, setConsultTab] = useState<ConsultTab>(openTabRequest?.tab ?? 'upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);

  // A notification can ask for a specific sub-tab ("Messages" for chat rows).
  useEffect(() => {
    if (openTabRequest) setConsultTab(openTabRequest.tab);
  }, [openTabRequest]);

  // Decline modal
  const [declineTarget, setDeclineTarget] = useState<DoctorConsultation | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineBusy, setDeclineBusy] = useState(false);

  // Edit-time modal
  const [editTarget, setEditTarget] = useState<DoctorConsultation | null>(null);
  const [editDateIdx, setEditDateIdx] = useState(0);
  const [editTime, setEditTime] = useState<string | null>(null);
  const [editSlots, setEditSlots] = useState<string[]>([]);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Working days + days off this doctor has set (loaded with the slots above).
  const [editAvail, setEditAvail] = useState<{ days: string[]; blockedDates: string[] }>({
    days: [...WEEKDAY_KEYS],
    blockedDates: [],
  });

  // Fee & slots modal
  const [availOpen, setAvailOpen] = useState(false);
  const [availFee, setAvailFee] = useState('');
  const [availSlots, setAvailSlots] = useState<string[]>([]);
  const [availDays, setAvailDays] = useState<string[]>([...WEEKDAY_KEYS]);
  const [availBlockedDates, setAvailBlockedDates] = useState<string[]>([]);
  const [availBlockDraft, setAvailBlockDraft] = useState('');
  const [availDraft, setAvailDraft] = useState('');
  const [availBusy, setAvailBusy] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [availNotice, setAvailNotice] = useState<string | null>(null);

  // Messages
  const [thread, setThread] = useState<DoctorConsultation | null>(null);
  const [threadMessages, setThreadMessages] = useState<DoctorChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [threads, setThreads] = useState<Map<string, ChatThreadSummary>>(new Map());
  const [pendingAttachment, setPendingAttachment] = useState<PickedAttachment | null>(null);
  // null = "Chat only" (send in the thread without filing it into My Files).
  const [pendingFileCategory, setPendingFileCategory] = useState<PatientFileCategory | null>(null);

  const threadRef = useRef<DoctorConsultation | null>(null);
  threadRef.current = thread;

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await fetchDoctorChatThreads());
    } catch {
      /* previews are cosmetic — the list still renders without them */
    }
  }, []);

  const totalUnread = useMemo(
    () => [...threads.values()].reduce((sum, row) => sum + row.unreadCount, 0),
    [threads],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setItems(await fetchDoctorConsultations());
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your consultations.');
    } finally {
      if (!silent) setLoading(false);
    }
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: new bookings, payments, and patient messages.
  useEffect(() => {
    let disposed = false;
    let unsubAppointments: (() => void) | null = null;
    let unsubMessages: (() => void) | null = null;

    void subscribeToDoctorAppointments(() => {
      void load(true);
    }).then((unsub) => {
      if (disposed) unsub();
      else unsubAppointments = unsub;
    });

    void subscribeToDoctorMessages(() => {
      void loadThreads();
      const current = threadRef.current;
      if (current) void openThread(current, true);
    }).then((unsub) => {
      if (disposed) unsub();
      else unsubMessages = unsub;
    });

    return () => {
      disposed = true;
      unsubAppointments?.();
      unsubMessages?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = useMemo(
    () => items.filter((item) => (UPCOMING_STATUSES as readonly string[]).includes(item.rawStatus)),
    [items],
  );
  const history = useMemo(
    () => items.filter((item) => (HISTORY_STATUSES as readonly string[]).includes(item.rawStatus)),
    [items],
  );
  const patients = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.patientId)) return false;
      seen.add(item.patientId);
      return true;
    });
  }, [items]);

  const handleApprove = async (item: DoctorConsultation) => {
    setBusyId(item.id);
    setActionError(null);
    try {
      await approveAppointment(item);
      await load(true);
    } catch (e: any) {
      setActionError(e?.message || 'Could not approve the appointment.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineConfirm = async () => {
    if (!declineTarget || declineBusy) return;
    setDeclineBusy(true);
    setActionError(null);
    try {
      await declineAppointment(declineTarget, declineReason);
      setDeclineTarget(null);
      setDeclineReason('');
      await load(true);
    } catch (e: any) {
      setActionError(e?.message || 'Could not decline the appointment.');
      setDeclineTarget(null);
    } finally {
      setDeclineBusy(false);
    }
  };

  const openEdit = async (item: DoctorConsultation) => {
    setEditTarget(item);
    setEditError(null);
    setEditTime(null);
    // Until the fetch lands, assume every day is workable so nothing is hidden.
    setEditAvail({ days: [...WEEKDAY_KEYS], blockedDates: [] });
    const parts = String(item.scheduledTime).split(' at ');
    const currentDate = parts[0] || '';
    const currentTime = parts[1] || '';
    const dates = generateRealLifeDates();
    let idx = dates.findIndex((d) => d.dateStr === currentDate);
    if (idx === -1 && currentDate) {
      dates.unshift({ label: 'Current', dateStr: currentDate });
      idx = 0;
    }
    setEditDateIdx(Math.max(idx, 0));
    try {
      const avail = await fetchDoctorAvailability();
      const slots = [...avail.slots];
      if (currentTime && !slots.includes(currentTime)) slots.unshift(currentTime);
      setEditSlots(slots);
      setEditAvail({ days: avail.days, blockedDates: avail.blockedDates });
      setEditTime(currentTime || slots[0] || null);
    } catch (e: any) {
      setEditSlots(currentTime ? [currentTime] : []);
      setEditTime(currentTime || null);
      setEditError(e?.message || 'Could not load your time slots.');
    }
  };

  const handleEditConfirm = async () => {
    if (!editTarget || !editTime || editBusy) return;
    const date = editDates[editDateIdx];
    if (!date) return;
    // The booked date itself may sit on a day off — changing it may not move one there.
    const currentScheduledDate = String(editTarget.scheduledTime).split(' at ')[0];
    if (
      date.dateStr !== currentScheduledDate &&
      isDateUnavailable(date.dateStr, editAvail.days, editAvail.blockedDates)
    ) {
      setEditError('You are off on that date. Pick another day, or update your working days first.');
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      await editAppointmentTime(editTarget, date.dateStr, editTime);
      setEditTarget(null);
      await load(true);
    } catch (e: any) {
      setEditError(e?.message || 'Could not reschedule the appointment.');
    } finally {
      setEditBusy(false);
    }
  };

  const openAvailability = async () => {
    setAvailOpen(true);
    setAvailError(null);
    setAvailNotice(null);
    setAvailDraft('');
    setAvailBlockDraft('');
    setAvailFee('');
    setAvailSlots([]);
    setAvailDays([...WEEKDAY_KEYS]);
    setAvailBlockedDates([]);
    try {
      const avail = await fetchDoctorAvailability();
      setAvailFee(String(avail.fee));
      setAvailSlots(avail.slots);
      setAvailDays(avail.days.length > 0 ? avail.days : [...WEEKDAY_KEYS]);
      setAvailBlockedDates(avail.blockedDates);
    } catch (e: any) {
      setAvailError(e?.message || 'Could not load your fee and slots.');
    }
  };

  const handleAvailSave = async () => {
    if (availBusy) return;
    if (availDays.length === 0) {
      setAvailError('Keep at least one working day.');
      return;
    }
    setAvailBusy(true);
    setAvailError(null);
    setAvailNotice(null);
    try {
      const next: DoctorAvailability = {
        fee: Number(availFee),
        slots: availSlots,
        days: availDays,
        blockedDates: availBlockedDates,
      };
      await saveDoctorAvailability(next);
      setAvailNotice('Saved. Patients now see your new fee, slots, and days off.');
    } catch (e: any) {
      setAvailError(e?.message || 'Could not save your fee and slots.');
    } finally {
      setAvailBusy(false);
    }
  };

  const addAvailSlot = () => {
    const value = availDraft.trim();
    if (!value) return;
    if (availSlots.includes(value)) {
      setAvailError('That time slot is already offered.');
      return;
    }
    setAvailSlots((prev) => [...prev, value]);
    setAvailDraft('');
    setAvailError(null);
  };

  const toggleAvailDay = (day: string) => {
    const has = availDays.includes(day);
    if (has && availDays.length === 1) {
      setAvailError('Keep at least one working day.');
      return;
    }
    setAvailDays(
      has
        ? availDays.filter((d) => d !== day)
        : WEEKDAY_KEYS.filter((d) => availDays.includes(d) || d === day),
    );
    setAvailError(null);
  };

  const addAvailBlockDate = () => {
    const value = availBlockDraft.trim();
    if (!value) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setAvailError('Use the YYYY-MM-DD format, e.g. 2026-10-05.');
      return;
    }
    if (availBlockedDates.includes(value)) {
      setAvailError('That date is already marked as a day off.');
      return;
    }
    setAvailBlockedDates((prev) => [...prev, value].sort());
    setAvailBlockDraft('');
    setAvailError(null);
  };

  const openThread = useCallback(async (item: DoctorConsultation, silent = false) => {
    setThread(item);
    if (!silent) {
      setThreadLoading(true);
      setThreadError(null);
      setPendingAttachment(null);
    }
    try {
      setThreadMessages(await fetchDoctorChatMessages(item.patientId));
      setThreadError(null);
      // Viewing the thread clears its unread badge.
      await markDoctorThreadRead(item.patientId);
      void loadThreads();
    } catch (e: any) {
      setThreadError(e?.message || 'Could not load the conversation.');
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, [loadThreads]);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!thread || sending) return;
    if (!text && !pendingAttachment) return;
    setSending(true);
    const outgoingAttachment = pendingAttachment;
    const outgoingCategory = pendingFileCategory;
    const patientId = thread.patientId;
    try {
      const sent = await sendDoctorChatMessage(patientId, text, outgoingAttachment);
      setThreadMessages((prev) => [...prev, sent]);
      setChatInput('');
      setPendingAttachment(null);
      setPendingFileCategory(null);
      void loadThreads();

      // Category chosen → also file the attachment into the patient's My Files.
      if (outgoingAttachment && outgoingCategory) {
        uploadPatientFile({
          patientId,
          category: outgoingCategory,
          title: outgoingAttachment.name,
          file: outgoingAttachment,
        }).catch((err: any) => {
          Alert.alert(
            'Sent, but not filed',
            err?.message || 'The message went through, but the file could not be added to My Files.',
          );
        });
      }
    } catch (e: any) {
      Alert.alert('Message not sent', e?.message || 'Please try again.');
      setPendingAttachment(outgoingAttachment);
      setPendingFileCategory(outgoingCategory);
    } finally {
      setSending(false);
    }
  };

  /** After a file is picked, ask where it should go: chat only, or My Files. */
  const chooseFileCategory = () => {
    Alert.alert('Save to My Files?', 'Send it in the chat only, or also file it for this patient.', [
      { text: 'Chat only', onPress: () => setPendingFileCategory(null) },
      { text: 'Prescription', onPress: () => setPendingFileCategory('prescription') },
      { text: 'Lab test', onPress: () => setPendingFileCategory('lab_test') },
      { text: 'Other note', onPress: () => setPendingFileCategory('other_note') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const attachFile = () => {
    Alert.alert('Add an attachment', 'What would you like to send?', [
      {
        text: 'Photo',
        onPress: () => {
          void pickImageAttachment().then((picked) => {
            if (picked) {
              setPendingAttachment(picked);
              setPendingFileCategory(null);
              chooseFileCategory();
            }
          });
        },
      },
      {
        text: 'Document',
        onPress: () => {
          void pickDocumentAttachment().then((picked) => {
            if (picked) {
              setPendingAttachment(picked);
              setPendingFileCategory(null);
              chooseFileCategory();
            }
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const editDates = useMemo(() => generateRealLifeDates(), [editTarget]);

  const renderItemCard = (item: DoctorConsultation, showHistory = false) => {
    const pill = STATUS_COLORS[item.rawStatus] ?? STATUS_COLORS.scheduled;
    const isBusy = busyId === item.id;
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            {item.avatarUrl
              ? <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{item.avatarInitials}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.patientName}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.studentId} · {item.patientEmail}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.text }]}>
              {STATUS_LABELS[item.rawStatus] ?? item.rawStatus}
            </Text>
          </View>
        </View>

        <View style={styles.cardTimeRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.cardTime}>{item.scheduledTime}</Text>
        </View>

        <View style={styles.cardTimeRow}>
          <Ionicons
            name={item.consultationMode === 'in_person' ? 'business-outline' : 'videocam-outline'}
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={styles.cardTime}>{consultationModeLabel(item.consultationMode)}</Text>
        </View>

        {showHistory && item.rawStatus === 'declined' && !!item.declineReason && (
          <Text style={styles.declineReason}>Reason: {item.declineReason}</Text>
        )}

        {!showHistory && item.rawStatus === 'scheduled' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn, isBusy && { opacity: 0.6 }]}
              onPress={() => void handleApprove(item)}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="checkmark" size={15} color={Colors.white} />
              )}
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={() => {
                setDeclineTarget(item);
                setDeclineReason('');
                setActionError(null);
              }}
            >
              <Ionicons name="close" size={15} color={Colors.tagRedText} />
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => void openEdit(item)}>
              <Ionicons name="time-outline" size={15} color={Colors.btnBlue} />
              <Text style={styles.editBtnText}>Edit time</Text>
            </TouchableOpacity>
          </View>
        )}

        {!showHistory && item.rawStatus === 'awaiting_payment' && (
          <View style={styles.actionsRow}>
            <View style={styles.waitingBadge}>
              <Ionicons name="card-outline" size={13} color={Colors.tagBlueText} />
              <Text style={styles.waitingBadgeText}>Waiting for the patient's payment</Text>
            </View>
            <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => void openEdit(item)}>
              <Ionicons name="time-outline" size={15} color={Colors.btnBlue} />
              <Text style={styles.editBtnText}>Edit time</Text>
            </TouchableOpacity>
          </View>
        )}

        {!showHistory && item.rawStatus === 'confirmed' && (
          <View style={styles.actionsRow}>
            {item.consultationMode === 'in_person' ? (
              <View style={styles.webNotice}>
                <Ionicons name="business-outline" size={14} color={Colors.tagBlueText} />
                <Text style={styles.webNoticeText}>
                  Face-to-face at the clinic — meet your patient in person. No call to join.
                </Text>
              </View>
            ) : (
              <View style={styles.webNotice}>
                <Ionicons name="globe-outline" size={14} color={Colors.tagBlueText} />
                <Text style={styles.webNoticeText}>
                  Join from the web — log in to the MindPulse website to start this call.
                </Text>
              </View>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => void openEdit(item)}>
              <Ionicons name="time-outline" size={15} color={Colors.btnBlue} />
              <Text style={styles.editBtnText}>Edit time</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Consultations</Text>
            <Text style={styles.headerSub}>Approve, reschedule, and talk to your patients</Text>
          </View>
          <View style={styles.headerBtns}>
            <DoctorNotifications onOpenMessages={() => setConsultTab('messages')} />
            <TouchableOpacity style={styles.gearBtn} onPress={() => void openAvailability()}>
              <Ionicons name="options-outline" size={20} color={Colors.primaryDark} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tabRow}>
          <TabPill label={`Upcoming${upcoming.length ? ` (${upcoming.length})` : ''}`} active={consultTab === 'upcoming'} onPress={() => setConsultTab('upcoming')} />
          <TabPill label="History" active={consultTab === 'history'} onPress={() => setConsultTab('history')} />
          <TabPill
            label={`Messages${totalUnread ? ` (${totalUnread > 9 ? '9+' : totalUnread})` : ''}`}
            active={consultTab === 'messages'}
            onPress={() => setConsultTab('messages')}
          />
        </View>
      </SafeAreaView>

      {actionError && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{actionError}</Text>
          <TouchableOpacity onPress={() => setActionError(null)}>
            <Ionicons name="close" size={16} color={Colors.tagRedText} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>Loading consultations…</Text>
        </View>
      ) : loadError && items.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerError}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {consultTab === 'upcoming' &&
            (upcoming.length === 0 ? (
              <Text style={styles.emptyText}>
                No upcoming appointments. New booking requests from patients will appear here.
              </Text>
            ) : (
              upcoming.map((item) => renderItemCard(item))
            ))}

          {consultTab === 'history' &&
            (history.length === 0 ? (
              <Text style={styles.emptyText}>Declined and completed appointments will appear here.</Text>
            ) : (
              history.map((item) => renderItemCard(item, true))
            ))}

          {consultTab === 'messages' &&
            (thread ? (
              <View style={styles.threadWrap}>
                <View style={styles.threadHeader}>
                  <TouchableOpacity
                    style={styles.threadBack}
                    onPress={() => {
                      setThread(null);
                      setPendingAttachment(null);
                    }}
                  >
                    <Ionicons name="arrow-back" size={18} color={Colors.btnBlue} />
                    <Text style={styles.threadBackText}>Patients</Text>
                  </TouchableOpacity>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {thread.patientName}
                  </Text>
                </View>

                {threadLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : threadError ? (
                  <Text style={styles.centerError}>{threadError}</Text>
                ) : (
                  <View style={styles.bubbleList}>
                    {threadMessages.length === 0 && (
                      <Text style={styles.emptyText}>No messages yet. Say hello to your patient.</Text>
                    )}
                    {threadMessages.map((msg) => {
                      const mine = msg.sender === 'doctor';
                      const openAttachment = () => {
                        if (msg.attachment?.url) void Linking.openURL(msg.attachment.url);
                      };
                      return (
                        <View key={msg.id} style={[styles.bubbleWrap, mine && styles.bubbleWrapMe]}>
                          <View style={[styles.bubble, mine && styles.bubbleMe]}>
                            {msg.attachment?.kind === 'image' && (
                              <TouchableOpacity
                                onPress={openAttachment}
                                activeOpacity={0.8}
                                disabled={!msg.attachment.url}
                              >
                                {msg.attachment.url ? (
                                  <Image source={{ uri: msg.attachment.url }} style={styles.bubbleImage} resizeMode="cover" />
                                ) : (
                                  <View style={[styles.bubbleImage, styles.bubbleImagePending]}>
                                    <Ionicons name="image-outline" size={22} color={Colors.textHint} />
                                  </View>
                                )}
                              </TouchableOpacity>
                            )}

                            {msg.attachment?.kind === 'document' && (
                              <TouchableOpacity
                                style={[styles.docRow, mine && styles.docRowMe]}
                                onPress={openAttachment}
                                activeOpacity={0.7}
                                disabled={!msg.attachment.url}
                              >
                                <Ionicons name="document-text-outline" size={16} color={mine ? Colors.white : Colors.btnBlue} />
                                <Text style={[styles.docName, mine && { color: Colors.white }]} numberOfLines={1}>
                                  {msg.attachment.name}
                                </Text>
                              </TouchableOpacity>
                            )}

                            {msg.text.length > 0 && (
                              <Text
                                style={[
                                  styles.bubbleText,
                                  mine && { color: Colors.white },
                                  msg.attachment && { marginTop: 6 },
                                ]}
                              >
                                {msg.text}
                              </Text>
                            )}
                          </View>
                          <View style={styles.bubbleMetaRow}>
                            <Text style={styles.bubbleTime}>{msg.timestamp}</Text>
                            {mine && (
                              <Text style={styles.receiptText}>{msg.readAt ? '✓✓ Read' : '✓ Sent'}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {pendingAttachment && (
                  <View style={styles.attachmentChip}>
                    <Ionicons
                      name={pendingAttachment.kind === 'image' ? 'image-outline' : 'document-text-outline'}
                      size={16}
                      color={Colors.btnBlue}
                    />
                    <Text style={styles.attachmentChipText} numberOfLines={1}>
                      {pendingAttachment.name}
                    </Text>
                    <TouchableOpacity
                      onPress={chooseFileCategory}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.attachmentChipCategory}>
                        {pendingFileCategory
                          ? PATIENT_FILE_CATEGORIES.find((category) => category.key === pendingFileCategory)?.label
                          : 'Chat only'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setPendingAttachment(null);
                        setPendingFileCategory(null);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.textHint} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={attachFile}
                    disabled={sending}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="attach" size={22} color={Colors.btnBlue} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.msgInput}
                    placeholder={`Message ${thread.patientName.split(' ')[0] || 'patient'}…`}
                    placeholderTextColor={Colors.textHint}
                    value={chatInput}
                    onChangeText={setChatInput}
                    editable={!sending}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                    onPress={() => void handleSend()}
                    disabled={sending || (!chatInput.trim() && !pendingAttachment)}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Ionicons name="send" size={17} color={Colors.white} />}
                  </TouchableOpacity>
                </View>
              </View>
            ) : patients.length === 0 ? (
              <Text style={styles.emptyText}>No patients yet. Conversations appear once patients book with you.</Text>
            ) : (
              patients.map((item) => {
                const summary = threads.get(item.patientId);
                return (
                  <TouchableOpacity key={item.patientId} style={styles.patientRow} onPress={() => void openThread(item)}>
                    <View style={styles.avatar}>
                      {item.avatarUrl
                        ? <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                        : <Text style={styles.avatarText}>{item.avatarInitials}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{item.patientName}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {summary
                          ? previewLabelFor(summary.lastText, summary.lastAttachmentKind, summary.lastAttachmentName)
                          : `${item.studentId} · ${item.patientEmail}`}
                      </Text>
                    </View>
                    <View style={styles.patientRowMeta}>
                      <Text style={styles.patientRowTime}>
                        {summary ? formatThreadTime(summary.lastAt) : ''}
                      </Text>
                      {!!summary && summary.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {summary.unreadCount > 9 ? '9+' : summary.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textHint} />
                  </TouchableOpacity>
                );
              })
            ))}
        </ScrollView>
      )}

      {/* ── Decline modal ── */}
      <Modal visible={!!declineTarget} transparent animationType="fade" onRequestClose={() => setDeclineTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Decline Appointment</Text>
            <Text style={styles.modalSub}>
              {declineTarget ? `${declineTarget.patientName} · ${declineTarget.scheduledTime}` : ''}
            </Text>
            <Text style={styles.fieldLabel}>Reason (required)</Text>
            <TextInput
              style={[styles.textArea, declineBusy && { opacity: 0.6 }]}
              placeholder="e.g. I have an emergency and need to reschedule."
              placeholderTextColor={Colors.textHint}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              editable={!declineBusy}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeclineTarget(null)} disabled={declineBusy}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDangerBtn, (!declineReason.trim() || declineBusy) && { opacity: 0.5 }]}
                onPress={() => void handleDeclineConfirm()}
                disabled={!declineReason.trim() || declineBusy}
              >
                {declineBusy ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmDangerBtnText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit time modal ── */}
      <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => setEditTarget(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { width: '92%' }]}>
            <Text style={styles.modalTitle}>Edit Appointment Time</Text>
            <Text style={styles.modalSub}>{editTarget ? editTarget.patientName : ''}</Text>

            <Text style={styles.fieldLabel}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {editDates.map((d, i) => {
                  // The appointment's own date stays selectable even if it now falls on a day off.
                  const isBookedDate =
                    d.dateStr === String(editTarget?.scheduledTime || '').split(' at ')[0];
                  const off =
                    !isBookedDate &&
                    isDateUnavailable(d.dateStr, editAvail.days, editAvail.blockedDates);
                  return (
                    <TouchableOpacity
                      key={`${d.dateStr}-${i}`}
                      style={[
                        styles.dateChip,
                        editDateIdx === i && styles.dateChipActive,
                        off && styles.dateChipDisabled,
                      ]}
                      onPress={() => {
                        if (off) return;
                        setEditDateIdx(i);
                        setEditTime(null);
                      }}
                      disabled={off}
                    >
                      <Text
                        style={[
                          styles.dateChipLabel,
                          editDateIdx === i && { color: Colors.white },
                          off && { color: Colors.textHint },
                        ]}
                      >
                        {d.label}
                      </Text>
                      <Text
                        style={[
                          styles.dateChipDate,
                          editDateIdx === i && { color: 'rgba(255,255,255,0.85)' },
                          off && { color: Colors.textHint },
                        ]}
                      >
                        {off ? 'Day off' : d.dateStr.split(',')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Time</Text>
            <View style={styles.slotGrid}>
              {editSlots.map((t) => {
                const currentDate = editDates[editDateIdx]?.dateStr ?? '';
                const currentItemTime = String(editTarget?.scheduledTime || '').split(' at ')[1];
                const isCurrent = t === currentItemTime && String(editTarget?.scheduledTime || '').startsWith(currentDate);
                const unavailable = !isCurrent && isSlotInPast(currentDate, t);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.slotChip, unavailable && styles.slotChipDisabled, editTime === t && styles.slotChipActive]}
                    onPress={() => !unavailable && setEditTime(t)}
                    disabled={unavailable}
                  >
                    <Text style={[styles.slotChipText, editTime === t && { color: Colors.white }, unavailable && styles.slotChipTextDisabled]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {editError && <Text style={styles.modalError}>{editError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditTarget(null)} disabled={editBusy}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!editTime || editBusy) && { opacity: 0.5 }]}
                onPress={() => void handleEditConfirm()}
                disabled={!editTime || editBusy}
              >
                {editBusy ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Fee & slots modal ── */}
      <Modal visible={availOpen} transparent animationType="slide" onRequestClose={() => setAvailOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalBox, { width: '92%', maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Fee & Time Slots</Text>
            <Text style={styles.modalSub}>Patients see these on the booking screen.</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={styles.fieldLabel}>Consultation fee (₱)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="500"
                placeholderTextColor={Colors.textHint}
                keyboardType="numeric"
                value={availFee}
                onChangeText={setAvailFee}
              />

              <Text style={styles.fieldLabel}>Offered time slots</Text>
              <View style={styles.slotGrid}>
                {availSlots.map((t) => (
                  <View key={t} style={styles.slotTag}>
                    <Text style={styles.slotTagText}>{t}</Text>
                    <TouchableOpacity
                      onPress={() => setAvailSlots((prev) => prev.filter((s) => s !== t))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={15} color={Colors.textHint} />
                    </TouchableOpacity>
                  </View>
                ))}
                {availSlots.length === 0 && (
                  <Text style={styles.emptyText}>No slots offered yet — add at least one below.</Text>
                )}
              </View>

              <View style={styles.addRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="e.g. 9:00 AM"
                  placeholderTextColor={Colors.textHint}
                  value={availDraft}
                  onChangeText={setAvailDraft}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addBtn} onPress={addAvailSlot}>
                  <Ionicons name="add" size={18} color={Colors.white} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Working days</Text>
              <View style={styles.slotGrid}>
                {WEEKDAY_KEYS.map((day) => {
                  const active = availDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => toggleAvailDay(day)}
                    >
                      <Text style={[styles.dayChipText, active && { color: Colors.white }]}>
                        {WEEKDAY_LABELS[day]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Days off (specific dates)</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="YYYY-MM-DD, e.g. 2026-10-05"
                  placeholderTextColor={Colors.textHint}
                  value={availBlockDraft}
                  onChangeText={setAvailBlockDraft}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addBtn} onPress={addAvailBlockDate}>
                  <Ionicons name="add" size={18} color={Colors.white} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.slotGrid}>
                {availBlockedDates.map((d) => (
                  <View key={d} style={styles.slotTag}>
                    <Text style={styles.slotTagText}>{d}</Text>
                    <TouchableOpacity
                      onPress={() => setAvailBlockedDates((prev) => prev.filter((x) => x !== d))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={15} color={Colors.textHint} />
                    </TouchableOpacity>
                  </View>
                ))}
                {availBlockedDates.length === 0 && (
                  <Text style={styles.emptyText}>No specific days off yet.</Text>
                )}
              </View>

              {availError && <Text style={styles.modalError}>{availError}</Text>}
              {availNotice && <Text style={styles.modalNotice}>{availNotice}</Text>}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAvailOpen(false)} disabled={availBusy}>
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, availBusy && { opacity: 0.5 }]}
                onPress={() => void handleAvailSave()}
                disabled={availBusy}
              >
                {availBusy ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  headerSafe: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  headerSub: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: 12 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.divider,
  },
  tabPillActive: { backgroundColor: toneBtn(Colors.primary) },
  tabPillText: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary },
  tabPillTextActive: { color: Colors.white },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.tagRedBg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  bannerText: { flex: 1, color: Colors.tagRedText, fontSize: 12.5, lineHeight: 17 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.lg },
  centerText: { color: Colors.textSecondary, fontSize: 13 },
  centerError: { color: Colors.tagRedText, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn: { backgroundColor: toneBtn(Colors.btnBlue), paddingHorizontal: 22, paddingVertical: 9, borderRadius: 18 },
  retryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  list: { flex: 1 },
  listContent: { padding: Spacing.md, paddingBottom: 24, gap: Spacing.sm },
  emptyText: {
    fontSize: 13,
    color: Colors.textHint,
    textAlign: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: toneBg('#E8ECFA'), alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: tone('#5B6EF5') },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  cardName: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  cardMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },
  cardTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTime: { fontSize: 12.5, fontWeight: '600', color: Colors.textSecondary },
  declineReason: {
    fontSize: 12,
    color: Colors.tagRedText,
    backgroundColor: Colors.tagRedBg,
    borderRadius: Radius.sm,
    padding: 8,
    lineHeight: 17,
  },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  approveBtn: { backgroundColor: toneBg('#27AE60') },
  approveBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12.5 },
  declineBtn: { backgroundColor: Colors.tagRedBg },
  declineBtnText: { color: Colors.tagRedText, fontWeight: '800', fontSize: 12.5 },
  editBtn: { backgroundColor: Colors.primaryLight },
  editBtnText: { color: Colors.btnBlue, fontWeight: '800', fontSize: 12.5 },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 230,
    backgroundColor: Colors.tagBlueBg,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  webNoticeText: { flex: 1, color: Colors.tagBlueText, fontWeight: '700', fontSize: 11.5, lineHeight: 16 },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.tagBlueBg,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  waitingBadgeText: { color: Colors.tagBlueText, fontWeight: '700', fontSize: 11.5 },

  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },

  threadWrap: { gap: 10 },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  threadBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  threadBackText: { color: Colors.btnBlue, fontWeight: '700', fontSize: 13 },
  threadName: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right' },
  bubbleList: { gap: 10, paddingVertical: 6 },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    maxWidth: '82%',
  },
  bubbleMe: { backgroundColor: toneBg('#5B6EF5'), borderColor: toneBg('#5B6EF5') },
  bubbleText: { fontSize: 13.5, color: Colors.textPrimary, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: Colors.textHint, marginTop: 3 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: toneBg('#5B6EF5'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  receiptText: { fontSize: 10, color: Colors.textHint, fontWeight: '600' },
  bubbleImage: { width: 200, height: 150, borderRadius: 10, backgroundColor: toneBg('#E4E7EF') },
  bubbleImagePending: { alignItems: 'center', justifyContent: 'center' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 140,
  },
  docRowMe: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.4)' },
  docName: { fontSize: 12.5, fontWeight: '600', color: Colors.textPrimary, flexShrink: 1 },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: toneBg('#EEF1FE'),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: toneBg('#D6DEFB'),
  },
  attachmentChipText: { flex: 1, fontSize: 12.5, color: Colors.btnBlue, fontWeight: '600' },
  attachmentChipCategory: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.btnBlue,
    backgroundColor: toneBg('#fff'),
    borderWidth: 1,
    borderColor: toneBg('#D6DEFB'),
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  patientRowMeta: { alignItems: 'flex-end', gap: 6 },
  patientRowTime: { fontSize: 11, color: Colors.textHint },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: toneBg('#E05C5C'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.white },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    width: '88%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
  modalSub: { fontSize: 12.5, color: Colors.textSecondary, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: {
    backgroundColor: Colors.pageBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  textArea: {
    backgroundColor: Colors.pageBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13.5 },
  confirmBtn: { backgroundColor: toneBtn(Colors.btnBlue), paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  confirmBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13.5 },
  confirmDangerBtn: { backgroundColor: toneBg('#E05C5C'), paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  confirmDangerBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13.5 },
  modalError: { color: Colors.tagRedText, fontSize: 12, lineHeight: 17 },
  modalNotice: { color: Colors.tagGreenText, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  dateChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: Radius.md,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    minWidth: 74,
  },
  dateChipActive: { backgroundColor: toneBtn(Colors.primary) },
  dateChipDisabled: { opacity: 0.45 },
  dateChipLabel: { fontSize: 11.5, fontWeight: '800', color: Colors.textPrimary },
  dateChipDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.divider,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotChipActive: { backgroundColor: toneBtn(Colors.primary), borderColor: toneBtn(Colors.primary) },
  slotChipDisabled: { opacity: 0.45 },
  slotChipText: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  slotChipTextDisabled: { color: Colors.textHint },
  slotTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  slotTagText: { fontSize: 12.5, fontWeight: '700', color: Colors.primaryDark },

  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.divider,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayChipActive: { backgroundColor: toneBtn(Colors.primary), borderColor: toneBtn(Colors.primary) },
  dayChipText: { fontSize: 12.5, fontWeight: '800', color: Colors.textPrimary },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: toneBtn(Colors.btnBlue),
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
  addBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
