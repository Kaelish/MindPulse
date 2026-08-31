import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppSpacing, Shadows } from '../../theme/tokens';
import {
  BookedAppointment,
  ChatMessage,
  TelehealthClinician,
  generateRealLifeDates,
  initialChatMessages,
  initialClinicians,
  saveBookedAppointment,
} from '../../services/appointments';

interface AppointmentBookingScreenProps {
  onStartVideoCall?: (doctorId?: string) => void;
  onNavigateTab?: (tab: 'home' | 'analysis' | 'clinics' | 'profile') => void;
}

export type TelehealthTab = 'clinicians' | 'messages';

const CheckmarkCircleIcon = () => (
  <View style={iconStyles.checkCircle}>
    <Text style={iconStyles.checkText}>✓</Text>
  </View>
);

export const AppointmentBookingScreen: React.FC<AppointmentBookingScreenProps> = ({
  onStartVideoCall,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<TelehealthTab>('clinicians');
  const [selectedClinician, setSelectedClinician] = useState<TelehealthClinician | null>(null);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number | null>(0);
  const [selectedTime, setSelectedTime] = useState<string | null>('3:30 PM');
  const [confirmedAppt, setConfirmedAppt] = useState<BookedAppointment | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeChatClinician, setActiveChatClinician] = useState<TelehealthClinician | null>(null);

  // Interactive Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [senderRole, setSenderRole] = useState<'patient' | 'doctor'>('patient');
  const [isDoctorTyping, setIsDoctorTyping] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCrisisModal, setShowCrisisModal] = useState(false);

  const realLifeDates = generateRealLifeDates();
  const timeSlots = ['9:00 AM', '10:30 AM', '11:45 AM', '1:30 PM', '2:15 PM', '3:30 PM', '4:45 PM', '5:30 PM'];

  const handleOpenBooking = (clinician: TelehealthClinician) => {
    setSelectedClinician(clinician);
    setSelectedDateIdx(0);
    setSelectedTime('3:30 PM');
    setShowBookingSheet(true);
  };

  const handleConfirmAppointment = async () => {
    if (!selectedClinician || selectedDateIdx === null || !selectedTime) return;

    const dateObj = realLifeDates[selectedDateIdx];
    const newAppt = await saveBookedAppointment({
      clinicianId: selectedClinician.id,
      clinicianName: selectedClinician.name,
      specialty: selectedClinician.specialty,
      selectedDate: dateObj.label === 'Today' || dateObj.label === 'Tomorrow' ? `${dateObj.label} (${dateObj.dateStr.split(',')[0]})` : dateObj.dateStr,
      selectedTime,
    });

    setConfirmedAppt(newAppt);
    setShowBookingSheet(false);
    setShowSuccessModal(true);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const currentRole = senderRole;
    const messageText = inputMessage.trim();
    const clinician = activeChatClinician || initialClinicians[0];

    setInputMessage('');

    // Save message via appointments service & Supabase
    const { sendChatMessage, generateDoctorReplyText } = await import('../../services/appointments');
    const newMsg = await sendChatMessage(clinician.id, currentRole, messageText);

    setChatMessages((prev) => [...prev, newMsg]);

    // If sent by patient, simulate real-time typing indicator & Doctor reply
    if (currentRole === 'patient') {
      setIsDoctorTyping(true);
      setTimeout(async () => {
        setIsDoctorTyping(false);
        const replyText = generateDoctorReplyText(messageText, clinician.name);
        const docMsg = await sendChatMessage(clinician.id, 'doctor', replyText);
        setChatMessages((prev) => [...prev, docMsg]);
      }, 1300);
    }
  };

  return (
    <View style={styles.screenRoot}>
      {/* 1. Header Area (TeleHealth) */}
      {!activeChatClinician ? (
        <View style={styles.headerArea}>
          <Text style={styles.headerTitle}>TeleHealth</Text>
          <Text style={styles.headerSub}>Connect with mental health professionals</Text>

          {/* Top Segment Switcher: Clinicians | Messages */}
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentTab, activeTab === 'clinicians' && styles.segmentTabActive]}
              onPress={() => setActiveTab('clinicians')}
            >
              <Text
                style={[styles.segmentText, activeTab === 'clinicians' && styles.segmentTextActive]}
              >
                Clinicians
              </Text>
              {activeTab === 'clinicians' && <View style={styles.activeLine} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentTab, activeTab === 'messages' && styles.segmentTabActive]}
              onPress={() => setActiveTab('messages')}
            >
              <Text
                style={[styles.segmentText, activeTab === 'messages' && styles.segmentTextActive]}
              >
                Messages
              </Text>
              {activeTab === 'messages' && <View style={styles.activeLine} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Chat Header Screen 7 */
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveChatClinician(null)}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.chatHeaderAvatar}>
            <Text style={{ fontSize: 18 }}>{activeChatClinician.avatar}</Text>
          </View>

          <View style={styles.chatHeaderTextWrap}>
            <Text style={styles.chatHeaderName}>{activeChatClinician.name}</Text>
            <Text style={styles.chatHeaderSpecialty}>{activeChatClinician.specialty}</Text>
          </View>

          <TouchableOpacity
            style={styles.callIconBtn}
            onPress={() => onStartVideoCall?.(activeChatClinician.id)}
          >
            <Text style={{ fontSize: 20 }}>📹</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Body */}
      {activeChatClinician ? (
        /* SCREEN 7: Direct Consultation Chat */
        <View style={styles.chatBody}>
          <ScrollView
            style={styles.chatScrollView}
            contentContainerStyle={styles.chatScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dateSeparatorWrap}>
              <Text style={styles.dateSeparatorText}>
                {confirmedAppt ? confirmedAppt.selectedDate : 'August 31, 2026'}
              </Text>
            </View>

            {chatMessages.map((msg) => {
              const isPatient = msg.sender === 'patient';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isPatient ? styles.messageRowRight : styles.messageRowLeft,
                  ]}
                >
                  {!isPatient && (
                    <View style={styles.chatMsgAvatar}>
                      <Text style={{ fontSize: 14 }}>{activeChatClinician.avatar}</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isPatient ? styles.bubblePatient : styles.bubbleDoctor,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isPatient ? styles.msgTextPatient : styles.msgTextDoctor,
                      ]}
                    >
                      {msg.text}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isPatient ? styles.msgTimePatient : styles.msgTimeDoctor,
                      ]}
                    >
                      {msg.timestamp} {isPatient ? '✓✓' : ''}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Doctor Typing Indicator */}
            {isDoctorTyping && (
              <View style={[styles.messageRow, styles.messageRowLeft]}>
                <View style={styles.chatMsgAvatar}>
                  <Text style={{ fontSize: 14 }}>{activeChatClinician.avatar}</Text>
                </View>
                <View style={[styles.messageBubble, styles.bubbleDoctor, { paddingVertical: 8, paddingHorizontal: 12 }]}>
                  <Text style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
                    {activeChatClinician.name} is typing...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Chat Input Bar */}
          <View style={styles.inputBarRow}>
            {/* Sender Role Toggle Pill */}
            <TouchableOpacity
              style={styles.senderRolePill}
              onPress={() => setSenderRole(senderRole === 'patient' ? 'doctor' : 'patient')}
            >
              <Text style={styles.senderRoleText}>
                {senderRole === 'patient' ? 'You 👤' : 'Doc 👩‍⚕️'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachBtn}>
              <Text style={{ fontSize: 18 }}>📎</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.chatInput}
              placeholder={senderRole === 'patient' ? 'Type message to doctor...' : 'Type message as doctor...'}
              placeholderTextColor="#94A3B8"
              value={inputMessage}
              onChangeText={setInputMessage}
              onSubmitEditing={handleSendMessage}
            />

            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <Text style={styles.sendBtnIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : activeTab === 'clinicians' ? (
        /* SCREEN 1: Clinicians View */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Crisis Support Banner */}
          <View style={styles.crisisBanner}>
            <Text style={styles.crisisIcon}>🆘</Text>
            <View style={styles.crisisTextWrap}>
              <Text style={styles.crisisTitle}>Crisis Support</Text>
              <Text style={styles.crisisSub}>24/7 Hotline: 1-800-273-TALK</Text>
            </View>

            <TouchableOpacity
              style={styles.callNowBtn}
              onPress={() => setShowCrisisModal(true)}
            >
              <Text style={styles.callNowText}>Call Now</Text>
            </TouchableOpacity>
          </View>

          {/* Available Clinicians Header */}
          <Text style={styles.sectionHeaderTitle}>Available Clinicians</Text>

          {/* Clinicians Cards List */}
          <View style={styles.clinicianList}>
            {initialClinicians.map((clinician) => (
              <View key={clinician.id} style={styles.clinicianCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.avatarWrap}>
                    <Text style={{ fontSize: 24 }}>{clinician.avatar}</Text>
                  </View>

                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.clinicianName}>{clinician.name}</Text>
                    <Text style={styles.clinicianSpecialty}>{clinician.specialty}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      clinician.status === 'Available' ? styles.statusAvailable : styles.statusOffline,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        clinician.status === 'Available'
                          ? styles.statusTextAvailable
                          : styles.statusTextOffline,
                      ]}
                    >
                      {clinician.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.bioText}>{clinician.bio}</Text>

                {/* Tag Chips & Book Button */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.tagRow}>
                    {clinician.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => handleOpenBooking(clinician)}
                  >
                    <Text style={styles.bookButtonText}>Book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* SCREEN 6: Messages Tab View */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
              <Text style={[styles.filterChipText, styles.filterChipTextActive]}>All Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Text style={styles.filterChipText}>Providers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Text style={styles.filterChipText}>Support</Text>
            </TouchableOpacity>
          </View>

          {/* Conversation List Item */}
          <View style={styles.conversationList}>
            <TouchableOpacity
              style={styles.convCard}
              onPress={() => setActiveChatClinician(initialClinicians[0])}
            >
              <View style={styles.convAvatar}>
                <Text style={{ fontSize: 22 }}>{initialClinicians[0].avatar}</Text>
              </View>

              <View style={styles.convTextWrap}>
                <View style={styles.convTitleRow}>
                  <Text style={styles.convName}>{initialClinicians[0].name}</Text>
                  <Text style={styles.convTime}>Today</Text>
                </View>
                <Text style={styles.convSub}>{initialClinicians[0].specialty}</Text>
                <Text style={styles.convPreview}>
                  {confirmedAppt
                    ? `Your appointment is confirmed for ${confirmedAppt.selectedDate} at ${confirmedAppt.selectedTime}`
                    : 'Your appointment is confirmed...'}
                </Text>
              </View>

              <Text style={{ fontSize: 18, color: '#94A3B8', marginLeft: 6 }}>›</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* SCREEN 2, 3, 4: Booking Bottom Sheet Modal */}
      {showBookingSheet && selectedClinician && (
        <Modal
          visible={showBookingSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBookingSheet(false)}
        >
          <View style={modalStyles.sheetOverlay}>
            <View style={modalStyles.sheetBox}>
              <View style={modalStyles.sheetHandle} />

              <View style={modalStyles.sheetHeaderRow}>
                <View>
                  <Text style={modalStyles.sheetTitle}>Schedule Session</Text>
                  <Text style={modalStyles.sheetSub}>
                    {selectedClinician.name} · {selectedClinician.specialty}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowBookingSheet(false)}>
                  <Text style={modalStyles.closeX}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Section 1: Select Day (Real-Life Dates) */}
              <Text style={modalStyles.sectionLabel}>📅 Select Day</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={modalStyles.dayPillsScroll}
              >
                {realLifeDates.map((dObj, idx) => {
                  const isSelected = selectedDateIdx === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[modalStyles.dayPill, isSelected && modalStyles.dayPillActive]}
                      onPress={() => setSelectedDateIdx(idx)}
                    >
                      <Text
                        style={[
                          modalStyles.dayPillText,
                          isSelected && modalStyles.dayPillTextActive,
                        ]}
                      >
                        {dObj.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Section 2: Select Time */}
              <Text style={modalStyles.sectionLabel}>⏰ Select Time</Text>
              <View style={modalStyles.timeGrid}>
                {timeSlots.map((time, idx) => {
                  const isSelected = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[modalStyles.timeCard, isSelected && modalStyles.timeCardActive]}
                      onPress={() => setSelectedTime(time)}
                    >
                      <Text
                        style={[
                          modalStyles.timeCardText,
                          isSelected && modalStyles.timeCardTextActive,
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Confirm Appointment Button */}
              <TouchableOpacity
                style={[
                  modalStyles.confirmBtn,
                  selectedDateIdx !== null && selectedTime
                    ? modalStyles.confirmBtnActive
                    : modalStyles.confirmBtnDisabled,
                ]}
                disabled={selectedDateIdx === null || !selectedTime}
                onPress={handleConfirmAppointment}
              >
                <Text style={modalStyles.confirmBtnText}>Confirm Appointment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* SCREEN 5: Appointment Booked Confirmation Modal */}
      {showSuccessModal && (
        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={modalStyles.sheetOverlay}>
            <View style={[modalStyles.sheetBox, { alignItems: 'center', paddingVertical: 30 }]}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 16, right: 16 }}
                onPress={() => {
                  setShowSuccessModal(false);
                  setActiveTab('messages');
                }}
              >
                <Text style={modalStyles.closeX}>✕</Text>
              </TouchableOpacity>

              <CheckmarkCircleIcon />

              <Text style={modalStyles.successTitle}>Appointment Booked!</Text>
              <Text style={modalStyles.successBody}>
                Your session with{' '}
                <Text style={{ fontWeight: '800' }}>{selectedClinician?.name}</Text> is set for{' '}
                <Text style={{ fontWeight: '800' }}>
                  {confirmedAppt ? confirmedAppt.selectedDate : 'Today'} at {selectedTime}
                </Text>
                .
              </Text>

              <TouchableOpacity
                style={[modalStyles.confirmBtn, modalStyles.confirmBtnActive, { width: '100%', marginTop: 24 }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  setActiveTab('messages');
                  setActiveChatClinician(selectedClinician);
                }}
              >
                <Text style={modalStyles.confirmBtnText}>Go to Messages</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Crisis Support Call Modal */}
      {showCrisisModal && (
        <Modal
          visible={showCrisisModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCrisisModal(false)}
        >
          <View style={modalStyles.sheetOverlay}>
            <View style={modalStyles.sheetBox}>
              <Text style={modalStyles.sheetTitle}>Crisis Support Hotline</Text>
              <Text style={modalStyles.sheetSub}>
                Connecting to 24/7 National Mental Health Emergency Line: 1-800-273-TALK.
              </Text>

              <TouchableOpacity
                style={[modalStyles.confirmBtn, { backgroundColor: '#E05C5C', marginTop: 16 }]}
                onPress={() => setShowCrisisModal(false)}
              >
                <Text style={modalStyles.confirmBtnText}>Dial 1-800-273-TALK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onNavigateTab?.('home')}
        >
          <Text style={styles.tabIconEmoji}>🏠</Text>
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onNavigateTab?.('analysis')}
        >
          <Text style={styles.tabIconEmoji}>🧠</Text>
          <Text style={styles.tabLabel}>Analysis</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onNavigateTab?.('clinics')}
        >
          <Text style={[styles.tabIconEmoji, { opacity: 1 }]}>🩺</Text>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Clinics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onNavigateTab?.('profile')}
        >
          <Text style={styles.tabIconEmoji}>👤</Text>
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const iconStyles = StyleSheet.create({
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },
});

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  headerArea: {
    backgroundColor: '#FAF8ED',
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.xl,
    paddingBottom: 0,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: AppSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  segmentTabActive: {},
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
  },
  activeLine: {
    position: 'absolute',
    bottom: -1,
    height: 3,
    width: '50%',
    backgroundColor: '#5B6EF5',
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: AppSpacing.md,
    paddingBottom: 85,
  },
  crisisBanner: {
    backgroundColor: '#FCE5DE',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  crisisIcon: {
    fontSize: 22,
  },
  crisisTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  crisisTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  crisisSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  callNowBtn: {
    backgroundColor: '#E05C5C',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  callNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  clinicianList: {
    gap: 12,
  },
  clinicianCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    ...Shadows.small,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    marginLeft: 10,
  },
  clinicianName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  clinicianSpecialty: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusAvailable: {
    backgroundColor: '#D6F5E3',
  },
  statusOffline: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextAvailable: {
    color: '#27AE60',
  },
  statusTextOffline: {
    color: '#64748B',
  },
  bioText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 10,
    lineHeight: 17,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#EEEDFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 10,
    color: '#5B6EF5',
    fontWeight: '700',
  },
  bookButton: {
    backgroundColor: '#5B6EF5',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    ...Shadows.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#5B6EF5',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  conversationList: {
    gap: 10,
  },
  convCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.small,
  },
  convAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  convTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  convName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  convTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  convSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  convPreview: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
    fontWeight: '500',
  },
  chatHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: AppSpacing.xl,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    paddingRight: 10,
  },
  backButtonText: {
    fontSize: 28,
    color: '#5B6EF5',
    fontWeight: '300',
  },
  chatHeaderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  chatHeaderName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  chatHeaderSpecialty: {
    fontSize: 11,
    color: '#64748B',
  },
  callIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBody: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  chatScrollView: {
    flex: 1,
  },
  chatScrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  chatMsgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: 12,
  },
  bubbleDoctor: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  bubblePatient: {
    backgroundColor: '#5B9EF7',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  msgTextDoctor: {
    color: '#0F172A',
  },
  msgTextPatient: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeDoctor: {
    color: '#94A3B8',
  },
  msgTimePatient: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  senderRolePill: {
    backgroundColor: '#EEEDFE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 4,
  },
  senderRoleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5B6EF5',
  },
  attachBtn: {
    padding: 6,
  },
  chatInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F8FAFC',
    borderRadius: 19,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0F172A',
    marginHorizontal: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5B9EF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 2,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#5B9EF7',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconEmoji: {
    fontSize: 18,
    opacity: 0.8,
  },
  tabLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

const modalStyles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeX: {
    fontSize: 18,
    color: '#94A3B8',
    padding: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 8,
  },
  dayPillsScroll: {
    marginBottom: 12,
  },
  dayPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  dayPillActive: {
    backgroundColor: '#5B6EF5',
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeCard: {
    width: '23%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeCardActive: {
    backgroundColor: '#5B6EF5',
  },
  timeCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  timeCardTextActive: {
    color: '#FFFFFF',
  },
  confirmBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(91, 110, 245, 0.4)',
  },
  confirmBtnActive: {
    backgroundColor: '#5B6EF5',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  successBody: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});
