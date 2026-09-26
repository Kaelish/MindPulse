import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  PaymentMethod,
  TelehealthClinician,
  fetchBookedSlotKeys,
  fetchChatMessages,
  fetchClinicians,
  fetchConversationClinician,
  fetchMyBookings,
  generateRealLifeDates,
  isSlotInPast,
  payForAppointment,
  saveBookedAppointment,
  sendChatMessage,
  subscribeToMyAppointments,
  subscribeToMyMessages,
} from '../../services/appointments';

interface AppointmentBookingScreenProps {
  onStartVideoCall?: (doctorId?: string, appointmentId?: string) => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

const TIME_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
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
  text, isMe, time,
}: { text: string; isMe: boolean; time: string }) => (
  <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      <Text style={[styles.bubbleText, isMe && { color: '#FFF' }]}>{text}</Text>
    </View>
    <Text style={styles.bubbleTime}>{time}</Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
export const AppointmentBookingScreen: React.FC<AppointmentBookingScreenProps> = ({
  onStartVideoCall,
}) => {
  const [activeTab, setActiveTab] = useState<'clinicians' | 'bookings' | 'messages'>('clinicians');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinician, setSelectedClinician] = useState<TelehealthClinician | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [lastBooking, setLastBooking] = useState<BookedAppointment | null>(null);
  const [chatInput, setChatInput] = useState('');

  const [clinicians, setClinicians] = useState<TelehealthClinician[]>([]);
  const [loadingClinicians, setLoadingClinicians] = useState(true);
  const [cliniciansError, setCliniciansError] = useState<string | null>(null);
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set());

  const [conversation, setConversation] = useState<TelehealthClinician | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

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

  const refreshConversation = async () => {
    try {
      const clinician = await fetchConversationClinician();
      setConversation(clinician);
      if (clinician) {
        const messages = await fetchChatMessages(clinician.id);
        setChatMessages(messages);
      } else {
        setChatMessages([]);
      }
      setChatError(null);
    } catch (e: any) {
      setChatError(e?.message || 'Could not load messages. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    void loadClinicians();
    void refreshConversation();
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
      void refreshConversation();
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
    setSelectedDateIdx(0);
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

      // Background refresh of availability and the Messages conversation.
      fetchBookedSlotKeys(selectedClinician.id)
        .then(setBookedKeys)
        .catch(() => { /* refreshed on next open */ });
      void refreshConversation();
    } catch (e: any) {
      Alert.alert('Booking failed', e?.message || 'Could not book the appointment. Please try again.');
    } finally {
      setBookingSaving(false);
    }
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !conversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      const sent = await sendChatMessage(conversation.id, text);
      setChatMessages(prev => [...prev, sent]);
      setChatInput('');
    } catch (e: any) {
      Alert.alert('Message not sent', e?.message || 'Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;

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
            <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>
              Messages
            </Text>
          </TouchableOpacity>
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
              <Text style={styles.crisisPhone}>988 · 24/7 free & confidential</Text>
            </View>
            <TouchableOpacity
              style={styles.callNowBtn}
              onPress={() => {
                Linking.openURL('tel:988').catch(() =>
                  Alert.alert('Crisis support', 'Call 988 for free, confidential crisis support — available 24/7.'),
                );
              }}
            >
              <Ionicons name="call" size={14} color="#FFF" />
              <Text style={styles.callNowText}>Call Now</Text>
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
          {chatLoading && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={Colors.btnBlue} />
              <Text style={styles.stateText}>Loading messages…</Text>
            </View>
          )}

          {!chatLoading && chatError && (
            <View style={styles.stateBox}>
              <Text style={styles.stateError}>{chatError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setChatLoading(true); void refreshConversation(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!chatLoading && !chatError && !conversation && (
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

          {!chatLoading && !chatError && conversation && (
            <>
              {/* Conversation preview */}
              <View style={styles.convoRow}>
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{conversation.avatar}</Text>
                </View>
                <View style={styles.convoInfo}>
                  <Text style={styles.convoName}>{conversation.name}</Text>
                  <Text style={styles.convoPreview} numberOfLines={1}>
                    {lastMessage ? lastMessage.text : 'No messages yet — say hello.'}
                  </Text>
                </View>
                <View style={styles.convoMeta}>
                  <Text style={styles.convoTime}>{lastMessage ? lastMessage.timestamp : ''}</Text>
                </View>
              </View>

              {/* Chat thread */}
              <ScrollView style={styles.chatScroll} contentContainerStyle={{ padding: Spacing.md, gap: 12 }}>
                {chatMessages.length === 0 && (
                  <Text style={styles.emptyThreadText}>
                    This is the start of your conversation with {conversation.name}.
                  </Text>
                )}
                {chatMessages.map(m => (
                  <ChatBubble
                    key={m.id}
                    text={m.text}
                    isMe={m.sender === 'patient'}
                    time={m.timestamp}
                  />
                ))}
              </ScrollView>

              {/* Input row */}
              <View style={styles.inputRow}>
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
                  disabled={sendingMessage}
                >
                  <Ionicons name="send" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
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
                {dates.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dateChip, selectedDateIdx === i && styles.dateChipActive]}
                    onPress={() => {
                      setSelectedDateIdx(i);
                      setSelectedTime(null);
                    }}
                  >
                    <Text style={[styles.dateChipDay, selectedDateIdx === i && { color: '#FFF' }]}>
                      {d.label}
                    </Text>
                    <Text style={[styles.dateChipDate, selectedDateIdx === i && { color: 'rgba(255,255,255,0.8)' }]}>
                      {d.dateStr.split(',')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

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
              style={[styles.confirmBtn, (!selectedTime || bookingSaving) && styles.confirmBtnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={!selectedTime || bookingSaving}
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
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
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
  convoMeta: { alignItems: 'flex-end' },
  convoTime: { fontSize: 11, color: Colors.textHint },
  chatScroll: { flex: 1 },
  emptyThreadText: { fontSize: 12, color: Colors.textHint, textAlign: 'center', marginVertical: 8 },
  bubbleWrap: { alignItems: 'flex-start', marginBottom: 6 },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleThem: { backgroundColor: '#F0F2F6', borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: Colors.textHint, marginTop: 3 },
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
});
