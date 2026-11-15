/**
 * Journal sheet behind the "Journal" tool on the assessment result screen.
 *
 * Deliberately local: entries go to AsyncStorage and nowhere else. The design
 * rationale (and the accepted tradeoffs) live at the top of
 * `src/services/journal.ts` — read that before changing where this stores data.
 *
 * The prompt copy (`hint`) is passed in from the tip bank so the advice text
 * only exists in one place; this component owns the form and nothing else.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';
import { useTranslation } from '../i18n/language';
import {
  deleteJournalEntry,
  entryPreview,
  entryStamp,
  JournalEntry,
  journalTemplateById,
  JournalId,
  loadJournalEntries,
  persistJournalEntry,
} from '../services/journal';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Which prompt to open. Unknown/absent renders nothing rather than a dead sheet. */
  templateId?: JournalId;
  /** Why this prompt exists — straight from the tip bank. */
  hint?: string;
}

const RECENT_LIMIT = 3;

export const JournalModal: React.FC<Props> = ({ visible, onClose, templateId, hint }) => {
  const { t } = useTranslation();
  const copy = t.results.tools;
  const jView = copy.views.journal;
  const [values, setValues] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The RECENT row the reader opened — null keeps every preview at 2 lines. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Rows whose preview genuinely overflows 2 lines — only those offer "read all". */
  const [truncated, setTruncated] = useState<Record<string, boolean>>({});

  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = templateId ? journalTemplateById(templateId) : undefined;

  useEffect(() => () => {
    if (flashRef.current) clearTimeout(flashRef.current);
  }, []);

  useEffect(() => {
    if (!visible) {
      setValues({});
      setError(null);
      setSaved(false);
      setExpandedId(null);
      return;
    }
    let alive = true;
    setValues({});
    setError(null);
    setSaved(false);
    setEntries([]);
    setExpandedId(null);
    setTruncated({});
    loadJournalEntries(templateId)
      .then((loaded) => {
        if (alive) setEntries(loaded);
      })
      .catch(() => {
        // loadJournalEntries already swallows; this is belt and braces.
      });
    return () => {
      alive = false;
    };
    // Re-arm only when the sheet opens or the prompt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, templateId]);

  if (!template) return null;

  const tplCopy = copy.journalTemplates[template.id];
  const dirty = template.fields.some((f) => (values[f.key] ?? '').trim().length > 0);

  const setField = (key: string, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
    if (error) setError(null);
  };

  const onSave = async () => {
    if (!template || saving) return;
    const clean: Record<string, string> = {};
    for (const f of template.fields) {
      const v = (values[f.key] ?? '').trim();
      if (v) clean[f.key] = v;
    }
    if (Object.keys(clean).length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const next = await persistJournalEntry(template.id, clean);
      setEntries(next.filter((e) => e.templateId === template.id));
      setValues({});
      setSaved(true);
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setSaved(false), 2200);
    } catch {
      setError(jView.error);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    void deleteJournalEntry(id);
  };

  const accent = toneBg(template.color);
  const recent = entries.slice(0, RECENT_LIMIT);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={copy.player.closeJournal}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <View style={styles.card}>
            <View style={[styles.head, { backgroundColor: accent }]}>
              <View style={styles.headIcon}>
                <Ionicons name={template.icon as any} size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headTitle}>{tplCopy.title}</Text>
                <Text style={styles.headSub}>{tplCopy.subtitle}</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel={copy.player.closeJournal}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              {hint ? (
                <Text style={styles.hint}>{hint}</Text>
              ) : null}

              {template.fields.map((f) => {
                const fieldCopy = tplCopy.fields[f.key];
                return (
                  <View key={f.key} style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>{fieldCopy.label}</Text>
                    <TextInput
                      style={styles.input}
                      value={values[f.key] ?? ''}
                      onChangeText={(text) => setField(f.key, text)}
                      placeholder={fieldCopy.placeholder}
                      placeholderTextColor={Colors.textHint}
                      multiline
                      numberOfLines={f.lines}
                      textAlignVertical="top"
                      accessibilityLabel={fieldCopy.label}
                    />
                  </View>
                );
              })}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color={tone('#C62828')} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {recent.length > 0 && (
                <View style={styles.recentBlock}>
                  <Text style={styles.recentLabel}>{jView.recentLabel}</Text>
                  {recent.map((e) => {
                    const expanded = expandedId === e.id;
                    const rowHint = expanded
                      ? jView.tapCollapse
                      : truncated[e.id]
                        ? jView.tapReadAll
                        : '';
                    return (
                      <View key={e.id} style={styles.recentRow}>
                        {/* The preview stays at 2 lines until tapped — a long
                            note opens in place instead of being cut off. */}
                        <TouchableOpacity
                          style={styles.recentText}
                          activeOpacity={0.7}
                          onPress={() => setExpandedId(expanded ? null : e.id)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            expanded
                              ? jView.collapseA11y
                              : jView.showAllFmt.replace('{preview}', entryPreview(e))
                          }
                        >
                          <Text
                            style={styles.recentPreview}
                            numberOfLines={expanded ? 0 : 2}
                            onTextLayout={
                              expanded
                                ? undefined
                                : (event) => {
                                    const overflows = event.nativeEvent.lines.length > 2;
                                    setTruncated((prev) =>
                                      prev[e.id] === overflows
                                        ? prev
                                        : { ...prev, [e.id]: overflows },
                                    );
                                  }
                            }
                          >
                            {entryPreview(e)}
                          </Text>
                          <Text style={styles.recentStamp}>
                            {[entryStamp(e.createdAt, jView.months), rowHint]
                              .filter(Boolean)
                              .join('  ·  ')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => onDelete(e.id)}
                          style={styles.deleteBtn}
                          accessibilityLabel={jView.hideA11y}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="eye-off-outline" size={16} color={Colors.textHint} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.privacyPill}>
                <Ionicons name="lock-closed-outline" size={11} color={tone('#55607A')} />
                <Text style={styles.privacyText}>{jView.privacy}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: accent },
                  (!dirty || saving) && { opacity: 0.45 },
                ]}
                onPress={onSave}
                disabled={!dirty || saving}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={saved ? 'checkmark-circle' : 'save-outline'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.saveText}>
                  {saving ? jView.saving : saved ? jView.saved : jView.saveBtn}
                </Text>
              </TouchableOpacity>

              <Pressable
                onPress={onClose}
                style={styles.doneLink}
                accessibilityLabel={copy.player.closeJournal}
              >
                <Text style={styles.doneLinkText}>{copy.player.done}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    kav: { width: '100%', maxWidth: 420 },
    card: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: 24,
      paddingBottom: 14,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
    headSub: { fontSize: 11, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 14,
      maxHeight: 340,
    },
    hint: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textSecondary,
      backgroundColor: toneBg('#F7F8FC'),
      borderRadius: Radius.md,
      padding: 10,
      marginBottom: 14,
    },
    fieldWrap: { marginBottom: 12 },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: Colors.textSecondary,
      marginBottom: 6,
      letterSpacing: 0.2,
    },
    input: {
      minHeight: 62,
      borderWidth: 1,
      borderColor: toneBg('#E2E4EC'),
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 14,
      color: Colors.textPrimary,
      backgroundColor: toneBg('#FCFCFD'),
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: toneBg('#FDECEC'),
      borderRadius: Radius.md,
      padding: 10,
      marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 12, color: tone('#C62828'), lineHeight: 17 },
    recentBlock: { marginTop: 4, marginBottom: 6 },
    recentLabel: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.1,
      color: Colors.textHint,
      marginBottom: 8,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: toneBg('#F7F8FC'),
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 7,
    },
    recentText: { flex: 1 },
    recentPreview: { fontSize: 12.5, color: Colors.textPrimary, lineHeight: 17 },
    recentStamp: { fontSize: 10.5, color: Colors.textHint, marginTop: 3 },
    deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    footer: { paddingHorizontal: 16, paddingTop: 12, gap: 9 },
    privacyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    privacyText: { fontSize: 11, fontWeight: '700', color: tone('#55607A') },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: Radius.full,
    },
    saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    doneLink: { alignItems: 'center', paddingVertical: 8 },
    doneLinkText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
