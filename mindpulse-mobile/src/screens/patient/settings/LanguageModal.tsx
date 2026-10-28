import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { registerThemeStyles, tone, toneBg } from '../../../theme/theme';
import { LANGUAGE_NAMES, setLanguage, useTranslation } from '../../../i18n/language';
import type { Language } from '../../../i18n/types';

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
}

const OPTIONS: { code: Language; descKey: 'descEnglish' | 'descFilipino' | 'descCebuano' }[] = [
  { code: 'en', descKey: 'descEnglish' },
  { code: 'fil', descKey: 'descFilipino' },
  { code: 'ceb', descKey: 'descCebuano' },
];

/**
 * Language picker for the stress assessment. Selecting a row applies the
 * language immediately (the assessment screens re-render through
 * `useTranslation`) and persists it via `setLanguage`.
 */
export const LanguageModal: React.FC<LanguageModalProps> = ({ visible, onClose }) => {
  const { lang, t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="language-outline" size={20} color={tone('#5B6EF5')} />
              </View>
              <View>
                <Text style={styles.headerTitle}>{t.settings.languageTitle}</Text>
                <Text style={styles.headerSub}>{t.settings.languageSub}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={tone('#64748B')} />
            </Pressable>
          </View>

          {/* Options */}
          {OPTIONS.map((option) => {
            const selected = lang === option.code;
            return (
              <TouchableOpacity
                key={option.code}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                onPress={() => {
                  // Applies immediately: every assessment screen re-renders
                  // through `useTranslation`, and the choice is persisted.
                  setLanguage(option.code);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.optionName, selected && styles.optionNameSelected]}>
                    {LANGUAGE_NAMES[option.code]}
                  </Text>
                  <Text style={styles.optionDesc}>{t.settings[option.descKey]}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={tone('#5B6EF5')} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={tone('#CBD5E1')} />
                )}
              </TouchableOpacity>
            );
          })}

          <Text style={styles.note}>{t.settings.languageNote}</Text>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: toneBg('#FAF8F3'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 4,
  },
  handle: { width: 36, height: 4, backgroundColor: toneBg('#CBD5E1'), borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: toneBg('#EEEDFE'), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: toneBg('#E2E8F0'), alignItems: 'center', justifyContent: 'center' },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  optionRowSelected: { borderColor: toneBg('#5B6EF5'), backgroundColor: toneBg('#EEEDFE') },
  optionText: { flex: 1, gap: 2 },
  optionName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  optionNameSelected: { color: tone('#5B6EF5') },
  optionDesc: { fontSize: 11, color: Colors.textSecondary },

  note: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 16 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
