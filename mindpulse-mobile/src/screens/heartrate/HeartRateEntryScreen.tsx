/**
 * Screen 2 – Manual Heart Rate Entry
 * Matches reference design:
 *  - White card: "Enter your beat count" headline, large centred input,
 *    inline "×4 = ? BPM" live formula on the right
 *  - BPM Reference card with three colour-coded range badges
 *  - Grey disabled / blue active "Calculate My BPM" full-width button
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { registerThemeStyles, tone, toneBg, toneBtn } from '../../theme/theme';
import { useTranslation } from '../../i18n/language';

interface Props {
  onBack: () => void;
  /** Called with (bpm, rawBeats) so the result screen can show the formula summary */
  onCalculate: (bpm: number, beats: number) => void;
}

// Fixed 15-second window (matches reference design)
const MULTIPLIER = 4;

// ─── BPM reference row ────────────────────────────────────────────────────────
interface RefRowProps {
  range: string;
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
}
const RefRow: React.FC<RefRowProps> = ({ range, badgeLabel, badgeBg, badgeText }) => (
  <View style={ref.row}>
    <Text style={ref.range}>{range}</Text>
    <View style={[ref.badge, { backgroundColor: badgeBg }]}>
      <Text style={[ref.badgeText, { color: badgeText }]}>{badgeLabel}</Text>
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export const HeartRateEntryScreen: React.FC<Props> = ({ onBack, onCalculate }) => {
  const { t } = useTranslation();
  const [beatsInput, setBeatsInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const beats = parseInt(beatsInput, 10);
  const bpm: number | null =
    beatsInput.length > 0 && !isNaN(beats) && beats > 0
      ? beats * MULTIPLIER
      : null;

  const isValid = bpm !== null && bpm >= 40 && bpm <= 250;

  const handleCalculate = () => {
    if (isValid && bpm !== null) {
      Keyboard.dismiss();
      onCalculate(bpm, beats);
    }
  };

  return (
    <StressAnalysisLayout
      activeModule="heartRate"
      onBack={onBack}>

      {/* ── Beat count input card ── */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={[screen.card, focused && screen.cardFocused]}>

        <Text style={screen.cardTitle}>{t.heartRate.entry.title}</Text>
        <Text style={screen.cardSubtitle}>
          {t.heartRate.entry.subtitle}
        </Text>

        {/* Input row: large number field  +  ×4 = BPM */}
        <View style={screen.inputRow}>
          {/* Number input box */}
          <View style={[screen.inputBox, focused && screen.inputBoxFocused]}>
            <TextInput
              ref={inputRef}
              style={screen.input}
              keyboardType="number-pad"
              placeholder={t.heartRate.entry.placeholder}
              placeholderTextColor={Colors.textHint}
              value={beatsInput}
              onChangeText={t => setBeatsInput(t.replace(/[^0-9]/g, ''))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={3}
              returnKeyType="done"
              onSubmitEditing={handleCalculate}
              accessibilityLabel="Number of beats counted"
              textAlign="center"
            />
          </View>

          {/* Formula preview */}
          <View style={screen.formulaGroup}>
            <Text style={screen.formulaOp}>× {MULTIPLIER} =</Text>
            <Text
              style={[
                screen.formulaBpm,
                bpm !== null && screen.formulaBpmActive,
              ]}>
              {bpm !== null ? bpm : '?'}
            </Text>
            <Text style={screen.formulaUnit}>BPM</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── BPM Reference card ── */}
      <View style={screen.refCard}>
        <Text style={screen.refTitle}>{t.heartRate.entry.refTitle}</Text>
        <RefRow
          range="Below 60 BPM"
          badgeLabel={t.heartRate.status.low.label}
          badgeBg={Colors.badgeLowBg}
          badgeText={Colors.badgeLowText}
        />
        <RefRow
          range="60-80 BPM"
          badgeLabel={t.heartRate.status.normal.label}
          badgeBg={Colors.badgeNormalBg}
          badgeText={Colors.badgeNormalText}
        />
        <RefRow
          range="81-95 BPM"
          badgeLabel={t.heartRate.status.elevated.label}
          badgeBg={Colors.badgeElevatedBg}
          badgeText={Colors.badgeElevatedText}
        />
        <RefRow
          range="96+ BPM"
          badgeLabel={t.heartRate.status.high.label}
          badgeBg={Colors.badgeHighBg}
          badgeText={Colors.badgeHighText}
        />
      </View>

      {/* ── Calculate button ── */}
      <TouchableOpacity
        onPress={handleCalculate}
        disabled={!isValid}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Calculate My BPM"
        style={[screen.calcBtn, isValid && screen.calcBtnActive]}>
        <Text style={[screen.calcBtnLabel, isValid && screen.calcBtnLabelActive]}>
          {t.heartRate.entry.calc}
        </Text>
      </TouchableOpacity>

    </StressAnalysisLayout>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeScreen = () => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: `${0}px ${2 }px ${6}px rgba(0,0,0,${0.04})` },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2  } }
    }),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardFocused: {
    borderColor: Colors.primary,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  inputBox: {
    flex: 1,
    backgroundColor: toneBg('#F2F3F7'),
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 0,
  },
  formulaGroup: {
    alignItems: 'center',
    minWidth: 52,
  },
  formulaOp: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  formulaBpm: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textHint,
    lineHeight: 34,
  },
  formulaBpmActive: {
    color: Colors.primary,
  },
  formulaUnit: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  refCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 10,
    elevation: 1,
    ...Platform.select({
      web: { boxShadow: `${0}px ${2 }px ${6}px rgba(0,0,0,${0.04})` },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2  } }
    }),
  },
  refTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  calcBtn: {
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: toneBg('#DDE3EE'),
    marginTop: Spacing.xs,
  },
  calcBtnActive: {
    backgroundColor: toneBtn(Colors.primary),
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: `${0}px ${4 }px ${8}px rgba(0,0,0,${0.3})` },
      default: { shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4  } }
    }),
  },
  calcBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: tone('#A0AABC'),
  },
  calcBtnLabelActive: {
    color: Colors.white,
  },
});

let screen = makeScreen();
registerThemeStyles(() => { screen = makeScreen(); });

const makeRef = () => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  range: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

let ref = makeRef();
registerThemeStyles(() => { ref = makeRef(); });
