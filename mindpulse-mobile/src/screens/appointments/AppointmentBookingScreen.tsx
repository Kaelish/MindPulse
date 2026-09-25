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
  TelehealthClinician,
  fetchBookedSlotKeys,
  fetchChatMessages,
  fetchClinicians,
  fetchConversationClinician,
  generateRealLifeDates,
  saveBookedAppointment,
  sendChatMessage,
} from '../../services/appointments';

interface AppointmentBookingScreenProps {
  onStartVideoCall?: (doctorId?: string) => void;
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
  const [activeTab, setActiveTab] = useState<'clinicians' | 'messages'>('clinicians');
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

  const dates = generateRealLifeDates();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              {TIME_SLOTS.map(t => {
                const slotKey = `${dates[selectedDateIdx].dateStr}_${t}`;
                const isBooked = bookedKeys.has(slotKey);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeSlot,
                      selectedTime === t && styles.timeSlotActive,
                      isBooked && styles.timeSlotBooked,
                    ]}
                    onPress={() => !isBooked && setSelectedTime(t)}
                    disabled={isBooked}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        selectedTime === t && { color: '#FFF' },
                        isBooked && styles.timeSlotBookedText,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, (!selectedTime || bookingSaving) && styles.confirmBtnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={!selectedTime || bookingSaving}
            >
              <Text style={styles.confirmBtnText}>
                {bookingSaving ? 'Booking…' : 'Confirm Appointment'}
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
            <Text style={styles.successTitle}>Appointment Booked!</Text>
            <Text style={styles.successBody}>
              Your session with {lastBooking?.clinicianName || selectedClinician?.name}{' '}
              {lastBooking
                ? `on ${lastBooking.selectedDate} at ${lastBooking.selectedTime}`
                : ''}{' '}
              has been requested. The clinic will confirm shortly.
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => {
                setShowSuccessModal(false);
                onStartVideoCall?.(selectedClinician?.id);
              }}
            >
              <Text style={styles.successBtnText}>Start Video Call</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSuccessModal(false)}>
              <Text style={styles.successDismiss}>Dismiss</Text>
            </TouchableOpacity>
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
  timeSlotBooked: { backgroundColor: Colors.divider, opacity: 0.5 },
  timeSlotBookedText: { color: Colors.textHint, textDecorationLine: 'line-through' },
  timeSlotText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

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
});
