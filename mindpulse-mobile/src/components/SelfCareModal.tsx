import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/typography';
import {
  StressBand,
  tipsForBand,
} from '../services/selfCareTips';
import { useTranslation } from '../i18n/language';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

interface SelfCareModalProps {
  visible: boolean;
  band: StressBand;
  onClose: () => void;
  /** Low/moderate primary action: jump to the Analysis tab. */
  onOpenAnalysis?: () => void;
  /** High (and secondary) action: book a professional in Clinics. */
  onOpenClinics?: () => void;
}

interface BandPalette {
  grad: [string, string];
  soft: string;
  accent: string;
}

const palette = (band: StressBand): BandPalette => {
  if (band === 'high') return { grad: ['#E05C5C', '#C94A4A'], soft: '#FFF1F0', accent: '#E05C5C' };
  if (band === 'low') return { grad: ['#27AE60', '#66BCA4'], soft: '#EFFAF3', accent: '#27AE60' };
  return { grad: ['#F39C12', '#E08A00'], soft: '#FFF9EC', accent: '#E08A00' };
};

/**
 * Centered self-care popup: evidence-based suggestions for the stress band of
 * a tapped notification (or the Home card), with routing to Analysis or the
 * professional booking tab.
 */
export const SelfCareModal: React.FC<SelfCareModalProps> = ({
  visible,
  band,
  onClose,
  onOpenAnalysis,
  onOpenClinics,
}) => {
  const colors = palette(band);
  const { t } = useTranslation();
  const copy = t.selfCare.modal;
  const tips = tipsForBand(band);

  const headline =
    band === 'high'
      ? copy.headlineHigh
      : band === 'low'
        ? copy.headlineLow
        : copy.headlineModerate;
  const subline =
    band === 'high'
      ? copy.subHigh
      : band === 'low'
        ? copy.subLow
        : copy.subModerate;

  const primary =
    band === 'high'
      ? { label: copy.bookSession, onPress: onOpenClinics }
      : { label: copy.viewAnalysis, onPress: onOpenAnalysis };

  /** Chip text — `null` band has no label of its own, so the chip is hidden. */
  const bandChipText =
    band === 'high'
      ? t.results.bandHigh
      : band === 'low'
        ? t.results.bandLow
        : band === 'moderate'
          ? t.results.bandModerate
          : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={copy.close} />
        <View style={styles.dialog}>
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            colors={colors.grad}
            style={styles.head}
          >
            <View style={styles.headIcon}>
              <Ionicons name="bulb" size={17} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>{headline}</Text>
              {bandChipText != null && (
                <View style={[styles.bandChip, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                  <Text style={styles.bandChipText}>{bandChipText}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel={copy.close}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>

          <Text style={styles.subline}>{subline}</Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {tips.map((tip) => (
              <View key={tip.id} style={[styles.tipRow, { borderColor: tone(colors.soft) }]}>
                <View style={[styles.tipIcon, { backgroundColor: tone(colors.soft) }]}>
                  {tip.material ? (
                    <MaterialCommunityIcons name={tip.icon as any} size={18} color={tone(colors.accent)} />
                  ) : (
                    <Ionicons name={tip.icon as any} size={18} color={tone(colors.accent)} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t.selfCare.tips[tip.id].title}</Text>
                  <Text style={styles.tipDesc}>{t.selfCare.tips[tip.id].desc}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.footerNote}>{copy.footer}</Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: toneBg(colors.accent) }]}
              onPress={() => {
                onClose();
                primary.onPress?.();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name={band === 'high' ? 'calendar' : 'analytics'} size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>{primary.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.laterBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.laterText}>{copy.maybeLater}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  bandChip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  bandChipText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subline: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  list: { maxHeight: 360, marginTop: 10 },
  listContent: { paddingHorizontal: 14, gap: 8, paddingBottom: 6 },
  tipRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    padding: 11,
  },
  tipIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  tipDesc: { fontSize: 11.5, color: Colors.textSecondary, lineHeight: 16, marginTop: 2 },
  footerNote: {
    fontSize: 11,
    color: Colors.textHint,
    fontStyle: 'italic',
    lineHeight: 15,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  actions: { paddingHorizontal: 14, paddingTop: 10, gap: 6 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.full,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  laterBtn: { alignItems: 'center', paddingVertical: 8 },
  laterText: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
