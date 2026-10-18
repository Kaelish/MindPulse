import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { tone } from '../../../theme/theme';

interface HelpGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

interface HelpTopic {
  icon: string;
  title: string;
  keywords: string;
  steps: string[];
}

const HELP_TOPICS: HelpTopic[] = [
  {
    icon: 'apps-outline',
    title: 'Moving around the app',
    keywords: 'navigation tabs home analysis clinics profile menu where',
    steps: [
      'The bottom bar has four tabs: Home, Analysis, Clinics, and Profile.',
      'Home shows your greeting, quick actions, and today\'s wellness tips.',
      'Analysis holds your stress history and trends over time.',
      'Clinics (TeleHealth) is where you find doctors, book, chat, and join sessions.',
      'Profile holds your account, settings, notifications — and this Help guide.',
    ],
  },
  {
    icon: 'clipboard-outline',
    title: 'Taking a stress assessment',
    keywords: 'assessment survey questionnaire start test submit stress score how',
    steps: [
      'On Home, tap the assessment action to start a new stress survey.',
      'Questions ask about "the last 24 hours" — answer for today, not in general.',
      'Answer every item honestly; a few questions are phrased positively and are scored in reverse.',
      'Submit to see your score and band right away.',
    ],
  },
  {
    icon: 'analytics-outline',
    title: 'Understanding your score',
    keywords: 'score band low moderate high 61 results level interpretation history trend',
    steps: [
      'Bands: Low 0–35, Moderate 36–60, High 61–100.',
      'Your latest score, band, and self-care tips appear on Home after each session.',
      'Open Analysis to review past sessions and see whether stress is rising or falling.',
      'A High score is a prompt to talk to someone — it is not a diagnosis.',
    ],
  },
  {
    icon: 'calendar-outline',
    title: 'Booking a consultation',
    keywords: 'book consultation clinics doctor search find pay payment receipt connect appointment schedule cash walk in walkin gcash maya card',
    steps: [
      'Open the Clinics tab → Clinicians.',
      'Use the search bar to find a doctor by name or specialization.',
      'Tap a doctor\'s card to open their full profile — bio, verified status, fee, and availability (their license and personal contact stay private; chat happens in-app).',
      'Pick a date and time inside their availability and confirm the booking. Times that have already passed are greyed out.',
      'Pay the consultation fee with GCash, Maya, or card — your receipt pops up right after payment and has a back button.',
      'Walked in and paid at the clinic instead? The doctor records the payment for you — it appears in your transactions as Cash with an MP-WALKIN reference, and the booking confirms automatically.',
      'Wait for the doctor to approve; you\'ll get a notification when it\'s confirmed.',
    ],
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Bookings & messages',
    keywords: 'bookings status chat message clinic declined approved upcoming history note summary shared',
    steps: [
      'Clinics → Bookings lists your appointments and their current status.',
      'Clinics → Messages is your chat with the clinic — send files as well as text.',
      'If a booking is declined, the doctor\'s reason is shown on that booking.',
      'Tap a booking to see its details and receipt — plus the doctor\'s consultation note once it is shared with you.',
    ],
  },
  {
    icon: 'videocam-outline',
    title: 'Your video session',
    keywords: 'video call session join jitsi confirmed meeting telehealth therapy progress note summary shared pending',
    steps: [
      'When the session time arrives and your booking is confirmed, join from your booking or notification.',
      'Keep the app open and your connection stable during the call.',
      'After the session the doctor writes a Therapy Progress Note. You see its patient-facing parts once the doctor shares it with you — until then the booking simply shows that a note is pending, and you\'ll get a notification when it\'s shared.',
      'Any files the doctor shares appear with the same booking.',
    ],
  },
  {
    icon: 'notifications-outline',
    title: 'Notifications & reminders',
    keywords: 'notification bell alert reminder approve reply sound',
    steps: [
      'The bell in the app header shows approvals, replies, and reminders.',
      'Profile → Notifications lets you manage your reminder preferences.',
    ],
  },
  {
    icon: 'person-outline',
    title: 'Account, settings & privacy',
    keywords: 'account settings profile dark mode privacy data export delete sign out email name',
    steps: [
      'Profile → Account Info updates your name and email.',
      'Dark mode and other preferences live in Profile → Settings.',
      'Profile → Privacy & Data lets you review, export, or delete your data.',
      'Sign Out is at the bottom of the Profile tab.',
    ],
  },
  {
    icon: 'heart-outline',
    title: 'If you\'re in crisis',
    keywords: 'crisis emergency help severe distress 988 counseling suicide support',
    steps: [
      'If you\'re in severe distress, contact your school\'s counseling services immediately or call 988.',
      'MindPulse is an educational tool — it does not replace professional help.',
      'To report an app problem, go to Profile → About MindPulse → Report a Problem.',
    ],
  },
];

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ visible, onClose }) => {
  const [query, setQuery] = useState('');
  /** Expanded FAQ items — everything starts collapsed so the list stays scannable. */
  const [openTitles, setOpenTitles] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return HELP_TOPICS;
    return HELP_TOPICS.filter((topic) =>
      [topic.title, topic.keywords, ...topic.steps].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [query]);

  // While searching, every match expands so the answer is visible immediately.
  useEffect(() => {
    if (!query.trim()) return;
    setOpenTitles(new Set(filtered.map((topic) => topic.title)));
  }, [query, filtered]);

  // Reopening starts from a clean, collapsed list.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setOpenTitles(new Set());
    }
  }, [visible]);

  const toggleTopic = (title: string) =>
    setOpenTitles((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const allOpen = filtered.length > 0 && filtered.every((topic) => openTitles.has(topic.title));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="help-circle-outline" size={20} color={tone('#5B6EF5')} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Help & Guide</Text>
                <Text style={styles.headerSub}>Tap a topic to expand it</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={tone('#64748B')} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={tone('#94A3B8')} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search: e.g. booking, score, receipt…"
                placeholderTextColor={tone('#94A3B8')}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={tone('#94A3B8')} />
                </Pressable>
              )}
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultCount}>
                {filtered.length} of {HELP_TOPICS.length} guides
              </Text>
              {filtered.length > 0 && (
                <Pressable
                  onPress={() =>
                    setOpenTitles(allOpen ? new Set() : new Set(filtered.map((topic) => topic.title)))
                  }
                  hitSlop={8}
                >
                  <Text style={styles.expandAll}>{allOpen ? 'Collapse all' : 'Expand all'}</Text>
                </Pressable>
              )}
            </View>

            {filtered.map((topic) => {
              const open = openTitles.has(topic.title);
              return (
                <View style={[styles.card, open && styles.cardOpen]} key={topic.title}>
                  <Pressable
                    style={styles.cardHead}
                    onPress={() => toggleTopic(topic.title)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    hitSlop={4}
                  >
                    <View style={styles.cardIconBox}>
                      <Ionicons name={topic.icon as any} size={16} color={tone('#5B6EF5')} />
                    </View>
                    <Text style={styles.cardTitle}>{topic.title}</Text>
                    <Ionicons
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={tone('#94A3B8')}
                    />
                  </Pressable>
                  {open &&
                    topic.steps.map((step, index) => (
                      <View style={styles.stepRow} key={index}>
                        <View style={styles.stepDot}>
                          <Text style={styles.stepDotText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                </View>
              );
            })}

            {filtered.length === 0 && (
              <View style={styles.emptyBox}>
                <Ionicons name="search-outline" size={22} color={tone('#94A3B8')} />
                <Text style={styles.emptyTitle}>No matching guides</Text>
                <Text style={styles.emptyText}>Try another keyword — e.g. “booking”, “score”, or “receipt”.</Text>
              </View>
            )}

            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={16} color={tone('#E08A00')} />
              <Text style={styles.tipText}>
                Still stuck? Profile → About MindPulse → Report a Problem reaches the MindPulse team
                from your own email app.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F6F8FB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7EDF5',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: Colors.textPrimary, paddingVertical: 0 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 2,
  },
  resultCount: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  expandAll: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#5B6EF5',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EEF5',
    padding: 14,
    marginTop: 12,
    gap: 9,
  },
  cardOpen: {
    borderColor: '#C9D2F8',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  cardIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepDotText: { fontSize: 10, fontWeight: '800', color: '#5B6EF5' },
  stepText: { flex: 1, fontSize: 12.5, lineHeight: 18.5, color: Colors.textSecondary },
  emptyBox: { alignItems: 'center', gap: 6, paddingVertical: 30 },
  emptyTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: '#FFF8EC',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#8A6A2F' },
});
