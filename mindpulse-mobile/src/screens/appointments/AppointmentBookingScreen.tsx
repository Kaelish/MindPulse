import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import { Spacing } from '../../theme/typography';
import {
  BookedAppointment,
  ChatMessage,
  MyBooking,
  PatientConversation,
  PaymentMethod,
  TelehealthClinician,
  fetchBookedSlotKeys,
  fetchChatMessages,
  fetchClinicians,
  fetchMyBookings,
  fetchPatientConversations,
  formatConversationTime,
  generateRealLifeDates,
  isDateUnavailable,
  isSlotInPast,
  markConversationRead,
  payForAppointment,
  saveBookedAppointment,
  sendChatMessage,
  subscribeToMyAppointments,
  subscribeToMyMessages,
} from '../../services/appointments';
import {
  ChatAttachment,
  PickedAttachment,
  pickDocumentAttachment,
  pickImageAttachment,
} from '../../services/chat';

type ClinicTab = 'clinicians' | 'bookings' | 'messages' | 'support';

/** Set by App.tsx when a notification routes into a specific sub-tab. */
export interface ClinicTabRequest {
  tab: ClinicTab;
  /** Bumped per request so the same tab can be asked for twice in a row. */
  nonce: number;
}

interface AppointmentBookingScreenProps {
  onStartVideoCall?: (doctorId?: string, appointmentId?: string) => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
  openTabRequest?: ClinicTabRequest | null;
}

const TIME_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
];

// ─── Philippine support hotlines (researched & verified) ─────────────────────
type SupportCategory = 'crisis' | 'emergency' | 'community';

interface SupportNumber {
  label: string;
  value: string;
}

interface SupportHotline {
  id: string;
  name: string;
  operator: string;
  tagline: string;
  availability: string;
  description: string;
  numbers: SupportNumber[];
  source: string;
  category: SupportCategory;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const SUPPORT_SECTIONS: { key: SupportCategory; label: string }[] = [
  { key: 'crisis', label: 'Crisis Support — 24/7' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'community', label: 'Community & Other Helplines' },
];

const SUPPORT_HOTLINES: SupportHotline[] = [
  {
    id: 'ncmh',
    name: 'NCMH Crisis Hotline',
    operator: 'Department of Health — National Center for Mental Health',
    tagline: "The country's national 24/7 mental health crisis line",
    availability: '24/7 · Free',
    description:
      'The national crisis hotline under the Mental Health Act (RA 11036). Trained responders provide crisis intervention, suicide prevention support, psychological first aid, and referrals to mental health professionals and facilities.',
    numbers: [
      { label: 'Toll-free landline (nationwide)', value: '1553' },
      { label: 'Toll-free (Smart / TNT)', value: '1800-1888-1553' },
      { label: 'Smart / TNT', value: '0919-057-1553' },
      { label: 'Globe / TM', value: '0917-899-8727' },
      { label: 'Globe / TM', value: '0966-351-4518' },
      { label: 'Landline (Metro Manila)', value: '(02) 7-989-8727' },
    ],
    source: 'NCMH / DOH (doh.gov.ph)',
    category: 'crisis',
    icon: 'heart',
  },
  {
    id: 'intouch',
    name: 'In Touch Community Services',
    operator: 'In Touch Community Services, Inc.',
    tagline: 'Free, anonymous emotional support',
    availability: '24/7 · Free · Anonymous',
    description:
      'A free, confidential, and anonymous crisis line run by a non-profit mental health organisation. Trained volunteer responders listen and provide emotional support, information, and referrals for anyone in distress.',
    numbers: [
      { label: 'Landline (Metro Manila)', value: '(02) 8893-7603' },
      { label: 'Smart / TNT', value: '0919-056-0709' },
      { label: 'Globe / TM', value: '0917-800-1123' },
      { label: 'Globe / TM', value: '0917-108-5412' },
      { label: 'Mobile', value: '0922-893-8944' },
    ],
    source: 'In Touch Community Services (in-touch.org)',
    category: 'crisis',
    icon: 'chatbubble-ellipses',
  },
  {
    id: 'hopeline',
    name: 'HOPE LINE',
    operator: 'NGF Mindstrong (formerly Natasha Goulbourn Foundation)',
    tagline: 'Suicide prevention & emotional crisis helpline',
    availability: '24/7 · Free',
    description:
      'A suicide prevention and emotional crisis helpline staffed by social workers, psychologists, and psychiatric nurses who listen and help callers work through moments of distress.',
    numbers: [
      { label: 'Landline (Metro Manila)', value: '(02) 8804-4673' },
      { label: 'Globe / TM', value: '0917-558-4673' },
      { label: 'Smart', value: '0918-873-4673' },
    ],
    source: 'HOPE LINE / DOH',
    category: 'crisis',
    icon: 'hand-left',
  },
  {
    id: 'emergency-911',
    name: 'Emergency 911',
    operator: 'Emergency 911 National Office',
    tagline: 'Police, fire, and medical emergencies',
    availability: '24/7',
    description:
      "The Philippines' national emergency number, in service since 2018. Call 911 if you or someone near you is in immediate physical danger, needs urgent medical help, or requires police assistance.",
    numbers: [{ label: 'National emergency number', value: '911' }],
    source: 'Emergency 911 National Office',
    category: 'emergency',
    icon: 'alarm',
  },
  {
    id: 'bantay-bata',
    name: 'Bantay Bata Helpline 163',
    operator: 'ABS-CBN Foundation, Inc.',
    tagline: 'Child abuse & welfare helpline',
    availability: 'Free · Call or message',
    description:
      "The Philippines' pioneering child helpline (since 1997). Licensed social workers receive reports of child abuse and neglect and provide guidance, counselling, and psychological first aid for children and families. Reachable by calling 163 and through Bantay Bata's Facebook Messenger.",
    numbers: [{ label: 'Child helpline', value: '163' }],
    source: 'ABS-CBN Foundation — Bantay Bata',
    category: 'community',
    icon: 'people',
  },
  {
    id: 'tawag-paglaum',
    name: 'Tawag Paglaum – Centro Bisaya',
    operator: 'Centro Bisaya, Inc. (Cebu)',
    tagline: 'Community mental health support — Central Visayas',
    availability: 'Hours vary · Cebu / Region VII',
    description:
      'A community-based mental health and psychosocial support line in Cebu serving Central Visayas (Region VII).',
    numbers: [
      { label: 'Mobile', value: '0966-467-9626' },
      { label: 'Mobile', value: '0939-937-5433' },
      { label: 'Mobile', value: '0939-936-5433' },
    ],
    source: 'MentalHealthPH helpline directory',
    category: 'community',
    icon: 'call',
  },
  {
    id: 'wisupport',
    name: 'DSWD WiSupport',
    operator: 'Department of Social Welfare and Development',
    tagline: 'Text-based mental health & psychosocial support',
    availability: 'SMS · Free',
    description:
      "The DSWD's wireless mental health and psychosocial support service. Text your concern to the hotline — responders guide you online, and emergency cases are referred to partner mental health institutions such as NCMH.",
    numbers: [{ label: 'SMS text line', value: '0918-912-2813' }],
    source: 'DSWD (dswd.gov.ph)',
    category: 'community',
    icon: 'chatbox-ellipses',
  },
];

// ─── Avatar circle ────────────────────────────────────────────────────────────
const ClinicianAvatar = ({ initials }: { initials: string }) => (
  <View style={styles.avatarWrap}>
    <View style={styles.avatarCircle}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
    <View style={[styles.avatarDot, { backgroundColor: '#27AE60' }]} />
  </View>
);

// ─── Clinician card ───────────────────────────────────────────────────────────
const ClinicianCard = ({
  clinician, onConnect,
}: { clinician: TelehealthClinician; onConnect: () => void }) => (
  <View style={styles.clinicianCard}>
    <ClinicianAvatar initials={clinician.avatar} />
    <View style={styles.clinicianInfo}>
      <View style={styles.nameRow}>
        <Text style={styles.clinicianName}>{clinician.name}</Text>
        {clinician.verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
      </View>
      <Text style={styles.clinicianSpec}>{clinician.specialty}</Text>
      <Text style={styles.clinicianBio} numberOfLines={2}>{clinician.bio}</Text>
      <View style={styles.tagRow}>
        {clinician.tags.slice(0, 3).map(t => (
          <View key={t} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
    <TouchableOpacity style={styles.connectBtn} onPress={onConnect}>
      <Text style={styles.connectBtnText}>Connect</Text>
    </TouchableOpacity>
  </View>
);

// ─── Booking status pill ─────────────────────────────────────────────────────
const BOOKING_PILLS: Record<string, { label: string; bg: string; fg: string }> = {
  scheduled: { label: 'Awaiting Approval', bg: '#FEF3C7', fg: '#B45309' },
  awaiting_payment: { label: 'Approved · Pay Now', bg: '#DBEAFE', fg: '#1D4ED8' },
  declined: { label: 'Declined', bg: '#FEE2E2', fg: '#B91C1C' },
  confirmed: { label: 'Confirmed', bg: '#D6F5E3', fg: '#1E7E43' },
  completed: { label: 'Completed', bg: '#D6F5E3', fg: '#1E7E43' },
  cancelled: { label: 'Cancelled', bg: '#EEF1F6', fg: '#64748B' },
};

const BookingPill = ({ status }: { status: MyBooking['status'] }) => {
  const pill = BOOKING_PILLS[status] ?? BOOKING_PILLS.scheduled;
  return (
    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
      <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
    </View>
  );
};

// ─── Chat bubble ──────────────────────────────────────────────────────────────
const ChatBubble = ({
  text, isMe, time, attachment, readAt,
}: {
  text: string;
  isMe: boolean;
  time: string;
  attachment?: ChatAttachment | null;
  readAt?: string | null;
}) => {
  const openAttachment = () => {
    if (attachment?.url) void Linking.openURL(attachment.url);
  };

  return (
    <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {attachment?.kind === 'image' && (
          <TouchableOpacity onPress={openAttachment} activeOpacity={0.8} disabled={!attachment.url}>
            {attachment.url ? (
              <Image source={{ uri: attachment.url }} style={styles.bubbleImage} resizeMode="cover" />
            ) : (
              <View style={[styles.bubbleImage, styles.bubbleImagePending]}>
                <Ionicons name="image-outline" size={22} color={Colors.textHint} />
              </View>
            )}
          </TouchableOpacity>
        )}

        {attachment?.kind === 'document' && (
          <TouchableOpacity
            style={[styles.docRow, isMe && styles.docRowMe]}
            onPress={openAttachment}
            activeOpacity={0.7}
            disabled={!attachment.url}
          >
            <Ionicons name="document-text-outline" size={16} color={isMe ? '#FFF' : ACCENT} />
            <Text style={[styles.docName, isMe && { color: '#FFF' }]} numberOfLines={1}>
              {attachment.name}
            </Text>
          </TouchableOpacity>
        )}

        {text.length > 0 && (
          <Text style={[styles.bubbleText, isMe && { color: '#FFF' }, attachment && { marginTop: 6 }]}>
            {text}
          </Text>
        )}
      </View>
      <View style={styles.bubbleMetaRow}>
        <Text style={styles.bubbleTime}>{time}</Text>
        {isMe && <Text style={styles.receiptText}>{readAt ? '✓✓ Read' : '✓ Sent'}</Text>}
      </View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export const AppointmentBookingScreen: React.FC<AppointmentBookingScreenProps> = ({
  onStartVideoCall,
  openTabRequest = null,
}) => {
  const [activeTab, setActiveTab] = useState<ClinicTab>(openTabRequest?.tab ?? 'clinicians');

  // A notification can ask for a specific sub-tab ("Messages" for chat rows).
  useEffect(() => {
    if (openTabRequest) setActiveTab(openTabRequest.tab);
  }, [openTabRequest]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinician, setSelectedClinician] = useState<TelehealthClinician | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedHotline, setSelectedHotline] = useState<SupportHotline | null>(null);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [lastBooking, setLastBooking] = useState<BookedAppointment | null>(null);
  const [chatInput, setChatInput] = useState('');

  const [clinicians, setClinicians] = useState<TelehealthClinician[]>([]);
  const [loadingClinicians, setLoadingClinicians] = useState(true);
  const [cliniciansError, setCliniciansError] = useState<string | null>(null);
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set());

  const [conversation, setConversation] = useState<PatientConversation | null>(null);
  const [conversations, setConversations] = useState<PatientConversation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PickedAttachment | null>(null);
  const conversationRef = useRef<PatientConversation | null>(null);
  conversationRef.current = conversation;

  // My bookings + mock payment flow
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<MyBooking | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payDone, setPayDone] = useState<MyBooking | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const dates = generateRealLifeDates();
  const slotOptions = selectedClinician?.slots?.length ? selectedClinician.slots : TIME_SLOTS;

  // Dates this doctor won't accept: not a working day or a blocked day off.
  const isDayOff = (dateStr: string) =>
    selectedClinician
      ? isDateUnavailable(
          dateStr,
          selectedClinician.availableDays ?? [],
          selectedClinician.blockedDates ?? [],
        )
      : false;

  const firstAvailableDateIdx = dates.findIndex(d => !isDayOff(d.dateStr));
  const hasAvailableDate = firstAvailableDateIdx >= 0;

  const openPayment = (booking: MyBooking) => {
    setPayTarget(booking);
    setPayMethod(null);
    setPayError(null);
    setPayDone(null);
  };

  const closePayment = () => {
    if (payBusy) return;
    setPayTarget(null);
    setPayMethod(null);
    setPayError(null);
    setPayDone(null);
  };

  const handlePay = async () => {
    if (!payTarget || !payMethod || payBusy) return;
    if (
      payMethod === 'card' &&
      (!cardNumber.trim() || !cardName.trim() || !cardExpiry.trim() || !cardCvv.trim())
    ) {
      setPayError('Fill in the card details to continue.');
      return;
    }

    setPayBusy(true);
    setPayError(null);
    try {
      // Mock gateway processing time.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await payForAppointment(payTarget, payMethod);
      setPayDone(payTarget);
      void loadBookings(false);
      void fetchBookedSlotKeysQuietly();
    } catch (e: any) {
      setPayError(e?.message || 'The payment failed. Please try again.');
    } finally {
      setPayBusy(false);
    }
  };

  const loadClinicians = async () => {
    setLoadingClinicians(true);
    setCliniciansError(null);
    try {
      const list = await fetchClinicians();
      setClinicians(list);
    } catch (e: any) {
      setCliniciansError(e?.message || 'Could not load clinicians. Please try again.');
    } finally {
      setLoadingClinicians(false);
    }
  };

  const loadBookings = async (withSpinner = true) => {
    if (withSpinner) setBookingsLoading(true);
    try {
      const list = await fetchMyBookings();
      setBookings(list);
      setBookingsError(null);
    } catch (e: any) {
      setBookingsError(e?.message || 'Could not load your bookings. Please try again.');
    } finally {
      if (withSpinner) setBookingsLoading(false);
    }
  };

  const fetchBookedSlotKeysQuietly = async () => {
    if (!selectedClinician) return;
    try {
      setBookedKeys(await fetchBookedSlotKeys(selectedClinician.id));
    } catch {
      /* refreshed on next open */
    }
  };

  /** Conversation list (previews + unread badges), never throws into the UI. */
  const refreshConversations = async () => {
    try {
      const list = await fetchPatientConversations();
      setConversations(list);
      setChatError(null);
      // Keep an open thread's summary row in sync (name, preview, unread).
      setConversation((current) =>
        current ? list.find((row) => row.clinicianId === current.clinicianId) ?? current : null,
      );
    } catch (e: any) {
      setChatError(e?.message || 'Could not load messages. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  const refreshThread = async (target: PatientConversation, silent = true) => {
    try {
      const messages = await fetchChatMessages(target.clinicianId);
      setChatMessages(messages);
      setChatError(null);
      // Viewing the thread clears its unread badge.
      await markConversationRead(target.clinicianId);
      void refreshConversations();
    } catch (e: any) {
      if (!silent) setChatError(e?.message || 'Could not load messages. Please try again.');
    }
  };

  const openConversation = (target: PatientConversation) => {
    setConversation(target);
    setChatMessages([]);
    setPendingAttachment(null);
    setChatLoading(true);
    void refreshThread(target, false).finally(() => setChatLoading(false));
  };

  const closeConversation = () => {
    setConversation(null);
    setPendingAttachment(null);
    void refreshConversations();
  };

  useEffect(() => {
    void loadClinicians();
    void refreshConversations();
    void loadBookings();

    // Realtime: approvals, declines, reschedules, and new messages show up
    // without the patient having to pull-to-refresh.
    let disposed = false;
    let unsubAppointments: (() => void) | null = null;
    let unsubMessages: (() => void) | null = null;

    void subscribeToMyAppointments(() => {
      void loadBookings(false);
      void fetchBookedSlotKeysQuietly();
    }).then((unsub) => {
      if (disposed) unsub();
      else unsubAppointments = unsub;
    });

    void subscribeToMyMessages(() => {
      void refreshConversations();
      const current = conversationRef.current;
      if (current) void refreshThread(current);
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

  // Refresh bookings each time the tab is opened.
  useEffect(() => {
    if (activeTab === 'bookings') void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filtered = clinicians.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConnect = async (c: TelehealthClinician) => {
    setSelectedClinician(c);
    // Land on the first date this doctor actually works (they may have days off).
    const firstOpen = dates.findIndex(
      d => isDateUnavailable(d.dateStr, c.availableDays ?? [], c.blockedDates ?? []),
    );
    setSelectedDateIdx(firstOpen >= 0 ? firstOpen : 0);
    setSelectedTime(null);
    try {
      // Availability must be fresh before offering times.
      setBookedKeys(await fetchBookedSlotKeys(c.id));
      setShowBookingModal(true);
    } catch (e: any) {
      Alert.alert('Could not load availability', e?.message || 'Please try again.');
    }
  };

  const handleConfirm = async () => {
    if (!selectedClinician || !selectedTime || bookingSaving) return;
    const date = dates[selectedDateIdx];
    if (isDayOff(date.dateStr)) {
      Alert.alert('Doctor unavailable', 'The doctor is off on that date. Please pick another day.');
      return;
    }
    if (isSlotInPast(date.dateStr, selectedTime)) {
      Alert.alert('Time already passed', 'That time has already passed. Please pick a later slot.');
      return;
    }

    setBookingSaving(true);
    try {
      const booked = await saveBookedAppointment({
        clinicianId: selectedClinician.id,
        clinicianName: selectedClinician.name,
        specialty: selectedClinician.specialty,
        selectedDate: date.dateStr,
        selectedTime,
      });
      setLastBooking(booked);
      setShowBookingModal(false);
      setShowSuccessModal(true);
      setSelectedTime(null);

      // Background refresh of availability and the conversation list (a brand
      // new booking opens a fresh thread row).
      fetchBookedSlotKeys(selectedClinician.id)
        .then(setBookedKeys)
        .catch(() => { /* refreshed on next open */ });
      void refreshConversations();
    } catch (e: any) {
      Alert.alert('Booking failed', e?.message || 'Could not book the appointment. Please try again.');
    } finally {
      setBookingSaving(false);
    }
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!conversation || sendingMessage) return;
    if (!text && !pendingAttachment) return;

    setSendingMessage(true);
    try {
      const sent = await sendChatMessage(conversation.clinicianId, text, pendingAttachment);
      setChatMessages(prev => [...prev, sent]);
      setChatInput('');
      setPendingAttachment(null);
      void refreshConversations();
    } catch (e: any) {
      Alert.alert('Message not sent', e?.message || 'Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const attachFile = () => {
    Alert.alert('Add an attachment', 'What would you like to send?', [
      {
        text: 'Photo',
        onPress: () => {
          void pickImageAttachment().then((picked) => {
            if (picked) setPendingAttachment(picked);
          });
        },
      },
      {
        text: 'Document',
        onPress: () => {
          void pickDocumentAttachment().then((picked) => {
            if (picked) setPendingAttachment(picked);
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const totalUnread = conversations.reduce((sum, row) => sum + row.unreadCount, 0);

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>TeleHealth</Text>
            <Text style={styles.headerSub}>Connect with mental health professionals</Text>
          </View>
        </View>

        {/* Tab row */}
        <View style={styles.tabRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRowInner}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'clinicians' && styles.tabBtnActive]}
              onPress={() => setActiveTab('clinicians')}
            >
              <Text style={[styles.tabText, activeTab === 'clinicians' && styles.tabTextActive]}>
                Clinicians
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'bookings' && styles.tabBtnActive]}
              onPress={() => setActiveTab('bookings')}
            >
              <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>
                Bookings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'messages' && styles.tabBtnActive]}
              onPress={() => setActiveTab('messages')}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>
                  Messages
                </Text>
                {totalUnread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'support' && styles.tabBtnActive]}
              onPress={() => setActiveTab('support')}
            >
              <Text style={[styles.tabText, activeTab === 'support' && styles.tabTextActive]}>
                Support
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* ── Clinicians Tab ── */}
      {activeTab === 'clinicians' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Crisis Support Banner */}
          <View style={styles.crisisBanner}>
            <View style={styles.crisisLeft}>
              <View style={styles.onlinePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
              <Text style={styles.crisisTitle}>Crisis Support</Text>
              <Text style={styles.crisisPhone}>1553 · NCMH Crisis Hotline — 24/7 &amp; free</Text>
            </View>
            <TouchableOpacity style={styles.callNowBtn} onPress={() => setActiveTab('support')}>
              <Text style={styles.callNowText}>Hotlines</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textHint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clinicians..."
              placeholderTextColor={Colors.textHint}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <Text style={styles.sectionLabel}>Available Clinicians</Text>

          {loadingClinicians && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={Colors.btnBlue} />
              <Text style={styles.stateText}>Loading clinicians…</Text>
            </View>
          )}

          {!loadingClinicians && cliniciansError && (
            <View style={styles.stateBox}>
              <Text style={styles.stateError}>{cliniciansError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => void loadClinicians()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loadingClinicians && !cliniciansError && filtered.length === 0 && (
            <View style={styles.stateBox}>
              <Ionicons name="people-outline" size={28} color={Colors.textHint} />
              <Text style={styles.stateText}>
                {clinicians.length === 0
                  ? 'No clinicians are available yet. Please check back soon.'
                  : 'No clinicians match your search.'}
              </Text>
            </View>
          )}

          {!loadingClinicians && !cliniciansError && filtered.map(c => (
            <ClinicianCard key={c.id} clinician={c} onConnect={() => void handleConnect(c)} />
          ))}
        </ScrollView>
      )}

      {/* ── Bookings Tab ── */}
      {activeTab === 'bookings' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>My Appointments</Text>

          {bookingsLoading && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={Colors.btnBlue} />
              <Text style={styles.stateText}>Loading your bookings…</Text>
            </View>
          )}

          {!bookingsLoading && bookingsError && (
            <View style={styles.stateBox}>
              <Text style={styles.stateError}>{bookingsError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => void loadBookings()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!bookingsLoading && !bookingsError && bookings.length === 0 && (
            <View style={styles.stateBox}>
              <Ionicons name="calendar-outline" size={28} color={Colors.textHint} />
              <Text style={styles.stateText}>
                You have no appointments yet. Book a session and it will show up here after the
                doctor reviews it.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setActiveTab('clinicians')}>
                <Text style={styles.retryText}>Browse clinicians</Text>
              </TouchableOpacity>
            </View>
          )}

          {!bookingsLoading && !bookingsError && bookings.map(b => {
            const initials = b.doctorName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'DR';
            return (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingTop}>
                  <ClinicianAvatar initials={initials} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clinicianName}>{b.doctorName}</Text>
                    <Text style={styles.clinicianSpec}>{b.specialty}</Text>
                    <Text style={styles.bookingWhen}>{b.scheduledFor}</Text>
                  </View>
                  <BookingPill status={b.status} />
                </View>

                {b.status === 'declined' && b.declineReason ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonText}>Reason: {b.declineReason}</Text>
                  </View>
                ) : null}

                {b.status === 'scheduled' && (
                  <Text style={styles.waitNote}>
                    Waiting for the doctor to approve your request. You'll get a notification.
                  </Text>
                )}

                {b.status === 'awaiting_payment' && (
                  <View style={styles.bookingActions}>
                    <Text style={styles.feeText}>Consultation fee ₱{b.fee}</Text>
                    <TouchableOpacity style={styles.payBtn} onPress={() => openPayment(b)}>
                      <Ionicons name="card" size={15} color="#FFF" />
                      <Text style={styles.payBtnText}>Pay &amp; Confirm</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {b.status === 'confirmed' && (
                  <View style={styles.bookingActions}>
                    <Text style={styles.confirmedNote}>
                      Payment received — your video room opens at the scheduled time.
                    </Text>
                    <TouchableOpacity
                      style={styles.joinBtn}
                      onPress={() => onStartVideoCall?.(b.doctorId, b.id)}
                    >
                      <Ionicons name="videocam" size={15} color="#FFF" />
                      <Text style={styles.payBtnText}>Join Video Call</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {b.status === 'cancelled' && (
                  <Text style={styles.waitNote}>This appointment was cancelled.</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Messages Tab ── */}
      {activeTab === 'messages' && (
        <View style={styles.body}>
          {chatLoading && !conversation && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={Colors.btnBlue} />
              <Text style={styles.stateText}>Loading messages…</Text>
            </View>
          )}

          {!chatLoading && chatError && !conversation && (
            <View style={styles.stateBox}>
              <Text style={styles.stateError}>{chatError}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { setChatLoading(true); void refreshConversations(); }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!chatLoading && !chatError && !conversation && conversations.length === 0 && (
            <View style={styles.stateBox}>
              <Ionicons name="chatbubbles-outline" size={28} color={Colors.textHint} />
              <Text style={styles.stateText}>
                No conversations yet. Book a session with a clinician to start chatting.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setActiveTab('clinicians')}>
                <Text style={styles.retryText}>Browse clinicians</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Conversation list */}
          {!chatLoading && !chatError && !conversation && conversations.length > 0 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {conversations.map((row) => (
                <TouchableOpacity
                  key={row.clinicianId}
                  style={styles.convoRow}
                  onPress={() => openConversation(row)}
                >
                  <View style={styles.convoAvatar}>
                    <Text style={styles.convoAvatarText}>{row.clinician?.avatar ?? 'DR'}</Text>
                  </View>
                  <View style={styles.convoInfo}>
                    <Text style={styles.convoName} numberOfLines={1}>
                      {row.clinician?.name ?? 'Clinician'}
                    </Text>
                    <Text style={styles.convoPreview} numberOfLines={1}>
                      {row.preview}
                    </Text>
                  </View>
                  <View style={styles.convoMeta}>
                    <Text style={styles.convoTime}>{formatConversationTime(row.lastAt)}</Text>
                    {row.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {row.unreadCount > 9 ? '9+' : row.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Open thread */}
          {conversation && (
            <>
              <View style={styles.threadTopBar}>
                <TouchableOpacity style={styles.threadBack} onPress={closeConversation}>
                  <Ionicons name="arrow-back" size={18} color={Colors.btnBlue} />
                  <Text style={styles.threadBackText}>Chats</Text>
                </TouchableOpacity>
                <Text style={styles.threadTitle} numberOfLines={1}>
                  {conversation.clinician?.name ?? 'Clinician'}
                </Text>
              </View>

              {chatLoading ? (
                <View style={styles.stateBox}>
                  <ActivityIndicator size="small" color={Colors.btnBlue} />
                </View>
              ) : chatError ? (
                <View style={styles.stateBox}>
                  <Text style={styles.stateError}>{chatError}</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => { setChatLoading(true); void refreshThread(conversation, false).finally(() => setChatLoading(false)); }}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.chatScroll} contentContainerStyle={{ padding: Spacing.md, gap: 12 }}>
                  {chatMessages.length === 0 && (
                    <Text style={styles.emptyThreadText}>
                      This is the start of your conversation with {conversation.clinician?.name ?? 'your clinician'}.
                    </Text>
                  )}
                  {chatMessages.map(m => (
                    <ChatBubble
                      key={m.id}
                      text={m.text}
                      isMe={m.sender === 'patient'}
                      time={m.timestamp}
                      attachment={m.attachment}
                      readAt={m.readAt}
                    />
                  ))}
                </ScrollView>
              )}

              {pendingAttachment && (
                <View style={styles.attachmentChip}>
                  <Ionicons
                    name={pendingAttachment.kind === 'image' ? 'image-outline' : 'document-text-outline'}
                    size={16}
                    color={ACCENT}
                  />
                  <Text style={styles.attachmentChipText} numberOfLines={1}>
                    {pendingAttachment.name}
                  </Text>
                  <TouchableOpacity onPress={() => setPendingAttachment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textHint} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Input row */}
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={attachFile}
                  disabled={sendingMessage}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="attach" size={22} color={ACCENT} />
                </TouchableOpacity>
                <TextInput
                  style={styles.msgInput}
                  placeholder="Type your message here..."
                  placeholderTextColor={Colors.textHint}
                  value={chatInput}
                  onChangeText={setChatInput}
                  editable={!sendingMessage}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendBtn, sendingMessage && { opacity: 0.6 }]}
                  onPress={() => void sendMessage()}
                  disabled={sendingMessage || (!chatInput.trim() && !pendingAttachment)}
                >
                  {sendingMessage
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Ionicons name="send" size={18} color="#FFF" />}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Support Tab ── */}
      {activeTab === 'support' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.supportIntro}>
            <Ionicons name="information-circle" size={22} color="#E05C5C" />
            <Text style={styles.supportIntroText}>
              You are not alone. Free, confidential help is available — the numbers below are
              listed for reference and can be dialed from any phone. In an emergency, call 911.
            </Text>
          </View>

          {SUPPORT_SECTIONS.map(section => {
            const list = SUPPORT_HOTLINES.filter(h => h.category === section.key);
            if (list.length === 0) return null;
            return (
              <View key={section.key} style={{ gap: 10 }}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                {list.map(h => (
                  <TouchableOpacity
                    key={h.id}
                    style={styles.supportCard}
                    onPress={() => setSelectedHotline(h)}
                  >
                    <View style={styles.supportIcon}>
                      <Ionicons name={h.icon} size={20} color="#E05C5C" />
                    </View>
                    <View style={styles.supportInfo}>
                      <Text style={styles.supportName}>{h.name}</Text>
                      <Text style={styles.supportTagline} numberOfLines={2}>{h.tagline}</Text>
                      <View style={styles.supportAvailPill}>
                        <Text style={styles.supportAvailText}>{h.availability}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textHint} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}

          <Text style={styles.supportDisclaimer}>
            Hotline numbers can change over time. If a line does not connect, try the next
            option or go to the nearest hospital.
          </Text>
        </ScrollView>
      )}

      {/* ── Booking Modal ── */}
      <Modal visible={showBookingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Schedule Session</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedClinician?.name} · {selectedClinician?.specialty}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionLabel}>Select Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {dates.map((d, i) => {
                  const off = isDayOff(d.dateStr);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dateChip,
                        selectedDateIdx === i && styles.dateChipActive,
                        off && styles.dateChipDisabled,
                      ]}
                      onPress={() => {
                        if (off) return;
                        setSelectedDateIdx(i);
                        setSelectedTime(null);
                      }}
                      disabled={off}
                    >
                      <Text
                        style={[
                          styles.dateChipDay,
                          selectedDateIdx === i && { color: '#FFF' },
                          off && { color: Colors.textHint },
                        ]}
                      >
                        {d.label}
                      </Text>
                      <Text
                        style={[
                          styles.dateChipDate,
                          selectedDateIdx === i && { color: 'rgba(255,255,255,0.8)' },
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

            {!hasAvailableDate && (
              <Text style={styles.timeGridHint}>
                {selectedClinician?.name ?? 'This doctor'} isn&apos;t accepting bookings in the next 7 days. Please
                check back later.
              </Text>
            )}

            <Text style={styles.modalSectionLabel}>Select Time</Text>
            <View style={styles.timeGrid}>
              {slotOptions.map(t => {
                const slotKey = `${dates[selectedDateIdx].dateStr}_${t}`;
                const isBooked = bookedKeys.has(slotKey);
                const isPast = isSlotInPast(dates[selectedDateIdx].dateStr, t);
                const isUnavailable = isBooked || isPast;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeSlot,
                      selectedTime === t && styles.timeSlotActive,
                      isUnavailable && styles.timeSlotPast,
                    ]}
                    onPress={() => !isUnavailable && setSelectedTime(t)}
                    disabled={isUnavailable}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        selectedTime === t && { color: '#FFF' },
                        isUnavailable && styles.timeSlotPastText,
                        isBooked && styles.timeSlotBookedText,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {slotOptions.every(t => isSlotInPast(dates[selectedDateIdx].dateStr, t)) && (
              <Text style={styles.timeGridHint}>
                All times for this day have already passed. Please choose another day.
              </Text>
            )}

            <View style={styles.feeRow}>
              <Ionicons name="card-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.feeRowText}>
                Consultation fee ₱{selectedClinician?.fee ?? 500} · payable after the doctor approves
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!selectedTime || bookingSaving || !hasAvailableDate) && styles.confirmBtnDisabled,
              ]}
              onPress={() => void handleConfirm()}
              disabled={!selectedTime || bookingSaving || !hasAvailableDate}
            >
              <Text style={styles.confirmBtnText}>
                {bookingSaving ? 'Sending Request…' : 'Request Appointment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successSheet}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#FFF" />
            </View>
            <Text style={styles.successTitle}>Request Sent!</Text>
            <Text style={styles.successBody}>
              Your session with {lastBooking?.clinicianName || selectedClinician?.name}{' '}
              {lastBooking
                ? `on ${lastBooking.selectedDate} at ${lastBooking.selectedTime}`
                : ''}{' '}
              is waiting for the doctor's approval. Once approved, you can pay the consultation
              fee here to confirm it.
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => {
                setShowSuccessModal(false);
                setActiveTab('bookings');
              }}
            >
              <Text style={styles.successBtnText}>View My Bookings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSuccessModal(false)}>
              <Text style={styles.successDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Payment Modal (mock online payment) ── */}
      <Modal visible={payTarget !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {payDone ? 'Payment Successful' : 'Pay Consultation Fee'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {payTarget
                    ? `${payTarget.doctorName} · ${payTarget.scheduledFor}`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={closePayment}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {payDone ? (
              <View style={{ alignItems: 'center', paddingBottom: 12 }}>
                <View style={[styles.successIcon, { marginBottom: 14 }]}>
                  <Ionicons name="checkmark" size={34} color="#FFF" />
                </View>
                <Text style={styles.payAmount}>₱{payDone.fee} paid</Text>
                <Text style={styles.waitNote}>
                  Your appointment is confirmed. Join the video room when it's time for your
                  session.
                </Text>
                <TouchableOpacity
                  style={[styles.payBtn, { width: '100%', marginTop: 18 }]}
                  onPress={() => {
                    const booking = payDone;
                    setPayTarget(null);
                    setPayDone(null);
                    onStartVideoCall?.(booking.doctorId, booking.id);
                  }}
                >
                  <Ionicons name="videocam" size={15} color="#FFF" />
                  <Text style={styles.payBtnText}>Join Video Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPayTarget(null);
                    setPayDone(null);
                  }}
                  style={{ marginTop: 12 }}
                >
                  <Text style={styles.successDismiss}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.feeRow}>
                  <Ionicons name="wallet-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.feeRowText}>
                    Amount due: ₱{payTarget?.fee ?? 0} · mock payment, no real charge
                  </Text>
                </View>

                <Text style={styles.modalSectionLabel}>Payment Method</Text>
                <View style={styles.methodRow}>
                  {([
                    { key: 'card', label: 'Card', icon: 'card' },
                    { key: 'gcash', label: 'GCash', icon: 'phone-portrait' },
                    { key: 'maya', label: 'Maya', icon: 'wallet' },
                  ] as const).map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.methodChip, payMethod === m.key && styles.methodChipActive]}
                      onPress={() => {
                        setPayMethod(m.key);
                        setPayError(null);
                      }}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={16}
                        color={payMethod === m.key ? '#FFF' : ACCENT}
                      />
                      <Text
                        style={[
                          styles.methodChipText,
                          payMethod === m.key && { color: '#FFF' },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {payMethod === 'card' && (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    <TextInput
                      style={styles.cardInput}
                      placeholder="Card number (e.g. 4242 4242 4242 4242)"
                      placeholderTextColor={Colors.textHint}
                      value={cardNumber}
                      onChangeText={setCardNumber}
                      keyboardType="number-pad"
                    />
                    <TextInput
                      style={styles.cardInput}
                      placeholder="Name on card"
                      placeholderTextColor={Colors.textHint}
                      value={cardName}
                      onChangeText={setCardName}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={[styles.cardInput, { flex: 1 }]}
                        placeholder="MM/YY"
                        placeholderTextColor={Colors.textHint}
                        value={cardExpiry}
                        onChangeText={setCardExpiry}
                      />
                      <TextInput
                        style={[styles.cardInput, { flex: 1 }]}
                        placeholder="CVV"
                        placeholderTextColor={Colors.textHint}
                        value={cardCvv}
                        onChangeText={setCardCvv}
                        keyboardType="number-pad"
                        secureTextEntry
                      />
                    </View>
                  </View>
                )}

                {(payMethod === 'gcash' || payMethod === 'maya') && (
                  <Text style={[styles.waitNote, { marginTop: 10 }]}>
                    You'll approve the ₱{payTarget?.fee ?? 0} payment inside your{' '}
                    {payMethod === 'gcash' ? 'GCash' : 'Maya'} wallet.
                  </Text>
                )}

                {payError && (
                  <View style={[styles.reasonBox, { marginTop: 12 }]}>
                    <Text style={[styles.reasonText, { color: '#B91C1C' }]}>{payError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.payBtn,
                    { width: '100%', marginTop: 18 },
                    (!payMethod || payBusy) && { opacity: 0.45 },
                  ]}
                  disabled={!payMethod || payBusy}
                  onPress={() => void handlePay()}
                >
                  <ActivityIndicator size="small" color="#FFF" style={payBusy ? undefined : { display: 'none' }} />
                  <Text style={styles.payBtnText}>
                    {payBusy ? 'Processing…' : `Pay ₱${payTarget?.fee ?? 0}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={closePayment} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={styles.successDismiss}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Hotline info modal ── */}
      <Modal visible={selectedHotline !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.modalTitle}>{selectedHotline?.name}</Text>
                  <Text style={styles.modalSubtitle}>{selectedHotline?.operator}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedHotline(null)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.supportDetailBadge}>
                <Ionicons name="time-outline" size={13} color={ACCENT} />
                <Text style={styles.supportDetailBadgeText}>{selectedHotline?.availability}</Text>
              </View>

              <Text style={styles.supportDetailText}>{selectedHotline?.description}</Text>

              <Text style={styles.modalSectionLabel}>Phone numbers</Text>
              <View style={styles.supportNumbers}>
                {selectedHotline?.numbers.map(n => (
                  <View key={`${n.label}-${n.value}`} style={styles.supportNumberRow}>
                    <Text style={styles.supportNumberLabel}>{n.label}</Text>
                    <Text style={styles.supportNumberValue}>{n.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.supportSourceBox}>
                <Text style={styles.supportSourceText}>
                  Source: {selectedHotline?.source}. Numbers are shown for reference — dial them
                  from any phone. In an emergency, call 911.
                </Text>
              </View>

              <TouchableOpacity style={styles.confirmBtn} onPress={() => setSelectedHotline(null)}>
                <Text style={styles.confirmBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const ACCENT = '#5B6EF5';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },

  /* Header */
  headerSafe: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  /* Tabs */
  tabRow: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRowInner: { flexDirection: 'row', paddingHorizontal: 20 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 16 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: ACCENT },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: ACCENT },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 14, paddingBottom: 100 },

  /* Crisis Banner */
  crisisBanner: {
    backgroundColor: '#FFF1F1',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  crisisLeft: { gap: 3 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#27AE60' },
  onlineText: { fontSize: 11, color: '#27AE60', fontWeight: '700' },
  crisisTitle: { fontSize: 15, fontWeight: '800', color: '#E05C5C' },
  crisisPhone: { fontSize: 11, color: Colors.textSecondary },
  callNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E05C5C',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  callNowText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: -4 },

  /* Loading / empty / error states */
  stateBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stateText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  stateError: { fontSize: 13, color: '#E05C5C', textAlign: 'center', lineHeight: 19 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: ACCENT },
  retryText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  /* Clinician card */
  clinicianCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarWrap: { position: 'relative' },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 16, fontWeight: '800', color: ACCENT },
  avatarDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },
  clinicianInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicianName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  verifiedBadge: { fontSize: 9, fontWeight: '800', color: '#1E7E43', backgroundColor: '#D6F5E3', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  clinicianSpec: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  clinicianBio: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  tag: { backgroundColor: '#EEF0FB', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, color: ACCENT, fontWeight: '600' },
  connectBtn: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  connectBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  /* Messages */
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  convoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF0FB', alignItems: 'center', justifyContent: 'center' },
  convoAvatarText: { fontSize: 14, fontWeight: '800', color: ACCENT },
  convoInfo: { flex: 1 },
  convoName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  convoPreview: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  convoMeta: { alignItems: 'flex-end', gap: 6 },
  convoTime: { fontSize: 11, color: Colors.textHint },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#E05C5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatScroll: { flex: 1 },
  emptyThreadText: { fontSize: 12, color: Colors.textHint, textAlign: 'center', marginVertical: 8 },
  threadTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  threadBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  threadBackText: { color: Colors.btnBlue, fontWeight: '700', fontSize: 13 },
  threadTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right' },
  bubbleWrap: { alignItems: 'flex-start', marginBottom: 6 },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleThem: { backgroundColor: '#F0F2F6', borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  bubbleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  bubbleTime: { fontSize: 10, color: Colors.textHint },
  receiptText: { fontSize: 10, color: Colors.textHint, fontWeight: '600' },
  bubbleImage: { width: 200, height: 150, borderRadius: 10, backgroundColor: '#E4E7EF' },
  bubbleImagePending: { alignItems: 'center', justifyContent: 'center' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E4E7EF',
  },
  docRowMe: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.4)' },
  docName: { fontSize: 12.5, fontWeight: '600', color: Colors.textPrimary, flexShrink: 1 },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EEF1FE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DEFB',
  },
  attachmentChipText: { flex: 1, fontSize: 12.5, color: ACCENT, fontWeight: '600' },
  attachBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  msgInput: {
    flex: 1,
    backgroundColor: Colors.divider,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Booking modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  modalSectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10 },

  dateChip: {
    alignItems: 'center',
    backgroundColor: Colors.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 64,
  },
  dateChipActive: { backgroundColor: ACCENT },
  dateChipDisabled: { opacity: 0.5, borderStyle: 'dashed', borderColor: Colors.border },
  dateChipDay: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  dateChipDate: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  timeSlot: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.surface,
  },
  timeSlotActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  timeSlotPast: { backgroundColor: Colors.divider, opacity: 0.5 },
  timeSlotPastText: { color: Colors.textHint },
  timeSlotBookedText: { textDecorationLine: 'line-through' },
  timeSlotText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  timeGridHint: { fontSize: 12, color: Colors.textHint, marginTop: 8, textAlign: 'center' },

  confirmBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },

  /* Success modal */
  successSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
    alignItems: 'center',
    paddingBottom: 48,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  successBody: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  successDismiss: { fontSize: 13, color: Colors.textSecondary },

  /* Bookings */
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookingTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookingWhen: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', marginTop: 3 },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '800' },
  reasonBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
  },
  reasonText: { fontSize: 12, color: '#B91C1C', lineHeight: 17, fontWeight: '600' },
  waitNote: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  confirmedNote: { fontSize: 12, color: '#1E7E43', lineHeight: 17, fontWeight: '600' },
  bookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  feeText: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#27AE60',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  payBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  payAmount: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },

  /* Payment modal */
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.divider,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  feeRowText: { fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  methodChipActive: { backgroundColor: ACCENT },
  methodChipText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  cardInput: {
    backgroundColor: Colors.divider,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: Colors.textPrimary,
  },

  /* Support tab */
  supportIntro: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFF1F1',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD6D6',
    padding: 14,
    alignItems: 'flex-start',
  },
  supportIntroText: { flex: 1, fontSize: 12, color: '#9B3B3B', lineHeight: 18 },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportInfo: { flex: 1, gap: 3 },
  supportName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  supportTagline: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  supportAvailPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF0FB',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 3,
  },
  supportAvailText: { fontSize: 10, fontWeight: '700', color: ACCENT },
  supportDisclaimer: { fontSize: 11, color: Colors.textHint, textAlign: 'center', lineHeight: 16 },

  /* Hotline detail modal */
  supportDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#EEF0FB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  supportDetailBadgeText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  supportDetailText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  supportNumbers: { gap: 8, marginBottom: 14 },
  supportNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  supportNumberLabel: { flex: 1, fontSize: 11, color: Colors.textSecondary },
  supportNumberValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.3 },
  supportSourceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: 18,
  },
  supportSourceText: { fontSize: 11, color: Colors.textHint, lineHeight: 16 },
});
