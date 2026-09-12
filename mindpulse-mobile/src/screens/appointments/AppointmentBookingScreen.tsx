import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import {
  TelehealthClinician,
  generateRealLifeDates,
  initialClinicians,
} from '../../services/appointments';

const { width: SW } = Dimensions.get('window');

interface AppointmentBookingScreenProps {
  onStartVideoCall?: (doctorId?: string) => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

// ─── Extended clinicians list (reference has 3) ───────────────────────────────
const CLINICIANS: TelehealthClinician[] = [
  {
    id: '1',
    name: 'Dr. Sarah Chen',
    specialty: 'Clinical Psychologist',
    avatar: 'SC',
    status: 'Available',
    bio: 'Specializing in cognitive behavioral therapy for student stress, burnout, and anxiety disorders.',
    tags: ['CBT', 'Stress', 'Anxiety'],
    email: 'sarah.chen@mindpulse.org',
  },
  {
    id: '2',
    name: 'Dr. James Delos',
    specialty: 'Behavioral Therapist',
    avatar: 'JD',
    status: 'Available',
    bio: 'Expert in behavioral interventions and emotional regulation management.',
    tags: ['Behavioral', 'Trauma', 'Depression'],
    email: 'james.delos@mindpulse.org',
  },
  {
    id: '3',
    name: 'Dr. Taylor Swift',
    specialty: 'Mindfulness Coach',
    avatar: 'TS',
    status: 'Offline',
    bio: 'Certified mindfulness coach specializing in stress reduction and relaxation techniques.',
    tags: ['Mindfulness', 'Meditation', 'Stress'],
    email: 'taylor.swift@mindpulse.org',
  },
];

const TIME_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM',
  '1:30 PM', '2:15 PM', '3:30 PM',
  '4:45 PM', '5:30 PM',
];

// ─── Avatar circle ────────────────────────────────────────────────────────────
const ClinicianAvatar = ({ initials, available }: { initials: string; available: boolean }) => (
  <View style={styles.avatarWrap}>
    <View style={styles.avatarCircle}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
    <View style={[styles.avatarDot, { backgroundColor: available ? '#27AE60' : '#B0B8C8' }]} />
  </View>
);

// ─── Clinician card ───────────────────────────────────────────────────────────
const ClinicianCard = ({
  clinician, onConnect,
}: { clinician: TelehealthClinician; onConnect: () => void }) => (
  <View style={styles.clinicianCard}>
    <ClinicianAvatar initials={clinician.avatar} available={clinician.status === 'Available'} />
    <View style={styles.clinicianInfo}>
      <Text style={styles.clinicianName}>{clinician.name}</Text>
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
    <TouchableOpacity
      style={[
        styles.connectBtn,
        clinician.status !== 'Available' && styles.connectBtnDisabled,
      ]}
      onPress={onConnect}
      disabled={clinician.status !== 'Available'}
    >
      <Text style={styles.connectBtnText}>
        {clinician.status === 'Available' ? 'Connect' : 'Offline'}
      </Text>
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
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'clinicians' | 'messages'>('clinicians');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinician, setSelectedClinician] = useState<TelehealthClinician | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [msgFilter, setMsgFilter] = useState<'all' | 'providers' | 'support'>('all');
  const [chatMessages, setChatMessages] = useState([
    { id: '1', sender: 'doctor', text: 'Hello! How are you feeling today?', time: '9:41 AM' },
    { id: '2', sender: 'patient', text: 'I\'ve been feeling a bit anxious lately.', time: '9:42 AM' },
    { id: '3', sender: 'doctor', text: 'That\'s understandable. Let\'s schedule a session to talk through it.', time: '9:43 AM' },
  ]);

  const dates = generateRealLifeDates();

  const filtered = CLINICIANS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConnect = (c: TelehealthClinician) => {
    setSelectedClinician(c);
    setShowBookingModal(true);
  };

  const handleConfirm = () => {
    setShowBookingModal(false);
    setShowSuccessModal(true);
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [
      ...prev,
      { id: Date.now().toString(), sender: 'patient', text: chatInput.trim(), time: 'now' },
    ]);
    setChatInput('');
  };

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
            <TouchableOpacity style={styles.callNowBtn}>
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

          {filtered.map(c => (
            <ClinicianCard key={c.id} clinician={c} onConnect={() => handleConnect(c)} />
          ))}
        </ScrollView>
      )}

      {/* ── Messages Tab ── */}
      {activeTab === 'messages' && (
        <View style={styles.body}>
          {/* Filter pills */}
          <View style={styles.msgFilterRow}>
            {(['all', 'providers', 'support'] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, msgFilter === f && styles.filterPillActive]}
                onPress={() => setMsgFilter(f)}
              >
                <Text style={[styles.filterText, msgFilter === f && styles.filterTextActive]}>
                  {f === 'all' ? 'All Messages' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Conversation preview */}
          <TouchableOpacity style={styles.convoRow}>
            <View style={styles.convoAvatar}>
              <Text style={styles.convoAvatarText}>SC</Text>
            </View>
            <View style={styles.convoInfo}>
              <Text style={styles.convoName}>Dr. Sarah Chen</Text>
              <Text style={styles.convoPreview} numberOfLines={1}>
                Let's schedule a session to talk through it.
              </Text>
            </View>
            <View style={styles.convoMeta}>
              <Text style={styles.convoTime}>Today</Text>
            </View>
          </TouchableOpacity>

          {/* Chat thread */}
          <ScrollView style={styles.chatScroll} contentContainerStyle={{ padding: Spacing.md, gap: 12 }}>
            {chatMessages.map(m => (
              <ChatBubble
                key={m.id}
                text={m.text}
                isMe={m.sender === 'patient'}
                time={m.time}
              />
            ))}
          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn}>
              <Ionicons name="attach" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={styles.msgInput}
              placeholder="Type your message here..."
              placeholderTextColor={Colors.textHint}
              value={chatInput}
              onChangeText={setChatInput}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Ionicons name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
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
                    onPress={() => setSelectedDateIdx(i)}
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
              {TIME_SLOTS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeSlot, selectedTime === t && styles.timeSlotActive]}
                  onPress={() => setSelectedTime(t)}
                >
                  <Text style={[styles.timeSlotText, selectedTime === t && { color: '#FFF' }]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, !selectedTime && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!selectedTime}
            >
              <Text style={styles.confirmBtnText}>Confirm Appointment</Text>
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
              Your session with {selectedClinician?.name} has been confirmed.{'\n'}
              Check the Terms and Conditions.
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

      {/* ── Bottom Tab ── */}
      <BottomTabBar activeTab="clinics" onNavigate={tab => onNavigateTab?.(tab)} />
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
  clinicianName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
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
  connectBtnDisabled: { backgroundColor: Colors.border },
  connectBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  /* Messages */
  msgFilterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.divider },
  filterPillActive: { backgroundColor: ACCENT },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#FFF' },
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
  attachBtn: { padding: 6 },
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
