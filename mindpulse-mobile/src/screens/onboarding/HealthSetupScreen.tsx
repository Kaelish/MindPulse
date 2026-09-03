import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';

interface HealthSetupScreenProps {
  userName?: string;
  onContinue: () => void;
}

/* ─────────── Constants ─────────── */

const YEAR_OPTIONS = [
  '1st Year', '2nd Year', '3rd Year', '4th Year',
  '5th Year', 'Graduate / Postgrad', 'Faculty / Staff',
];

const LIVING_OPTIONS = [
  'With family',
  'On-campus dormitory',
  'Off-campus — alone',
  'With roommates / friends',
];

const MENTAL_HEALTH_OPTIONS = [
  'Anxiety or panic attacks',
  'Depression',
  'ADHD or attention difficulties',
  'Bipolar disorder or mood swings',
  'PTSD or trauma history',
  'Sleep disorders (insomnia, etc.)',
  'OCD or intrusive thoughts',
];

const PHYSICAL_HEALTH_OPTIONS = [
  'Heart condition or arrhythmia',
  'Thyroid condition',
  'Chronic pain or illness',
  'Regular prescription medication',
  'Respiratory conditions (asthma, etc.)',
  'Diabetes or blood sugar issues',
];

const LIFESTYLE_OPTIONS = [
  'Daily caffeine use (coffee, energy drinks)',
  'Heavy academic or work schedule',
  'Regular physical exercise (3+ times/week)',
  'Consistently poor sleep quality',
  'Currently experiencing a major life stressor',
  'Regular alcohol or substance use',
];

/* ─────────── Sub-components ─────────── */

const ProgressBar = ({ step }: { step: number }) => {
  const labels = ['Academic Info', 'Health Conditions', 'Review & Confirm'];
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressStep}>Step {step} of 3</Text>
        <Text style={styles.progressLabel}>{labels[step - 1]}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>
    </View>
  );
};

const InfoBanner = ({ text }: { text: string }) => (
  <View style={styles.infoBanner}>
    <View style={styles.infoIcon}>
      <Text style={styles.infoIconText}>!</Text>
    </View>
    <Text style={styles.infoBannerText}>{text}</Text>
  </View>
);

const RadioOption = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.radioRow, selected && styles.radioRowActive]}>
    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
      {selected && <View style={styles.radioInner} />}
    </View>
    <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
  </Pressable>
);

const CheckItem = ({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.checkRow}>
    <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
      {checked && <Text style={styles.checkMark}>✓</Text>}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
  </Pressable>
);

/* ─────────── Step 1 — Academic Info ─────────── */

interface Step1Props {
  year: string;
  setYear: (v: string) => void;
  program: string;
  setProgram: (v: string) => void;
  living: string;
  setLiving: (v: string) => void;
  onContinue: () => void;
}

const Step1: React.FC<Step1Props> = ({
  year, setYear, program, setProgram, living, setLiving, onContinue,
}) => {
  const isValid = year !== '' && living !== '';
  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}>
      <InfoBanner
        text="This information helps MindPulse contextualise your stress analysis results. All responses are stored locally and never shared externally. You may skip any item."
      />

      <Text style={styles.fieldLabel}>Year / Academic Level</Text>
      <View style={styles.chipGrid}>
        {YEAR_OPTIONS.map(opt => (
          <Pressable
            key={opt}
            onPress={() => setYear(opt)}
            style={[styles.chip, year === opt && styles.chipActive]}>
            <Text style={[styles.chipText, year === opt && styles.chipTextActive]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>
        Program / Course <Text style={styles.optional}>(optional)</Text>
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. BS Computer Science, AB Psychology..."
        placeholderTextColor="#B0B8C8"
        value={program}
        onChangeText={setProgram}
      />

      <Text style={styles.fieldLabel}>Living Situation</Text>
      <View style={styles.radioGroup}>
        {LIVING_OPTIONS.map(opt => (
          <RadioOption
            key={opt}
            label={opt}
            selected={living === opt}
            onPress={() => setLiving(opt)}
          />
        ))}
      </View>

      <Pressable
        onPress={onContinue}
        style={[styles.continueBtn, isValid && styles.continueBtnActive]}>
        <Text style={[styles.continueBtnText, isValid && styles.continueBtnTextActive]}>
          Continue
        </Text>
        <Text style={[styles.continueBtnArrow, isValid && styles.continueBtnTextActive]}>›</Text>
      </Pressable>
    </ScrollView>
  );
};

/* ─────────── Step 2 — Health Conditions ─────────── */

interface Step2Props {
  mentalChecked: string[];
  physicalChecked: string[];
  lifestyleChecked: string[];
  noneApply: boolean;
  toggleMental: (v: string) => void;
  togglePhysical: (v: string) => void;
  toggleLifestyle: (v: string) => void;
  toggleNone: () => void;
  onBack: () => void;
  onContinue: () => void;
}

const Step2: React.FC<Step2Props> = ({
  mentalChecked, physicalChecked, lifestyleChecked, noneApply,
  toggleMental, togglePhysical, toggleLifestyle, toggleNone,
  onBack, onContinue,
}) => {
  const hasAny =
    mentalChecked.length > 0 || physicalChecked.length > 0 ||
    lifestyleChecked.length > 0 || noneApply;

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}>
      <InfoBanner
        text="Check all that apply. This data is only used to add context to your analysis — it does not replace a medical diagnosis."
      />

      {/* Mental Health */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: '#EDE9FB' }]}>
          <Text style={styles.sectionIconText}>🧠</Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>Mental Health Background</Text>
          <Text style={styles.sectionSub}>prior or current conditions</Text>
        </View>
      </View>
      {MENTAL_HEALTH_OPTIONS.map(opt => (
        <CheckItem
          key={opt}
          label={opt}
          checked={mentalChecked.includes(opt)}
          onPress={() => toggleMental(opt)}
        />
      ))}

      {/* Physical */}
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <View style={[styles.sectionIcon, { backgroundColor: '#E8F4E8' }]}>
          <Text style={styles.sectionIconText}>🫀</Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>Physical Health Conditions</Text>
          <Text style={styles.sectionSub}>prior or current conditions</Text>
        </View>
      </View>
      {PHYSICAL_HEALTH_OPTIONS.map(opt => (
        <CheckItem
          key={opt}
          label={opt}
          checked={physicalChecked.includes(opt)}
          onPress={() => togglePhysical(opt)}
        />
      ))}

      {/* Lifestyle */}
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <View style={[styles.sectionIcon, { backgroundColor: '#FEF3E2' }]}>
          <Text style={styles.sectionIconText}>🌿</Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>Lifestyle & Habits</Text>
          <Text style={styles.sectionSub}>your daily patterns</Text>
        </View>
      </View>
      {LIFESTYLE_OPTIONS.map(opt => (
        <CheckItem
          key={opt}
          label={opt}
          checked={lifestyleChecked.includes(opt)}
          onPress={() => toggleLifestyle(opt)}
        />
      ))}

      {/* None */}
      <CheckItem
        label="None of the above apply to me"
        checked={noneApply}
        onPress={toggleNone}
      />

      {/* Navigation */}
      <View style={styles.navRow}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          style={[styles.continueBtn, styles.continueBtnActive, styles.continueBtnSmall]}>
          <Text style={styles.continueBtnTextActive}>Continue</Text>
          <Text style={styles.continueBtnTextActive}> ›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

/* ─────────── Step 3 — Review & Confirm ─────────── */

interface Step3Props {
  userName: string;
  year: string;
  program: string;
  living: string;
  mentalChecked: string[];
  physicalChecked: string[];
  lifestyleChecked: string[];
  noneApply: boolean;
  onEdit: () => void;
  onSave: () => void;
}

const Step3: React.FC<Step3Props> = ({
  userName, year, program, living,
  mentalChecked, physicalChecked, lifestyleChecked, noneApply,
  onEdit, onSave,
}) => {
  const flaggedConditions = [
    ...mentalChecked,
    ...physicalChecked,
    ...lifestyleChecked,
  ];
  const noConditions = noneApply || flaggedConditions.length === 0;

  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}>
      {/* Success illustration */}
      <View style={styles.successCircle}>
        <Text style={styles.successCheck}>✓</Text>
      </View>
      <Text style={styles.reviewHeading}>Looking good, {userName}!</Text>
      <Text style={styles.reviewSubheading}>
        Here's a summary of your health background profile.
      </Text>

      {/* Academic Info card */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>ACADEMIC INFORMATION</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Year Level</Text>
          <Text style={styles.summaryValue}>{year || 'Not specified'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Program</Text>
          <Text style={styles.summaryValue}>{program || 'Not specified'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Living With</Text>
          <Text style={styles.summaryValue}>{living || 'Not specified'}</Text>
        </View>
      </View>

      {/* Health Conditions card */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>HEALTH CONDITIONS FLAGGED</Text>
        {noConditions ? (
          <Text style={styles.summaryNone}>None Flagged</Text>
        ) : (
          flaggedConditions.map(c => (
            <View key={c} style={styles.summaryRow}>
              <Text style={styles.summaryBullet}>•</Text>
              <Text style={styles.summaryValue}>{c}</Text>
            </View>
          ))
        )}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyNoteText}>
            🔒 Your health profile is stored only on this device. It will be used to provide more contextualised stress analysis — never shared or used for medical decisions.
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.reviewNavRow}>
        <Pressable onPress={onEdit} style={styles.editBtn}>
          <Text style={styles.editBtnText}>← Edit</Text>
        </Pressable>
        <Pressable onPress={onSave} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save & Start Using MindPulse</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

/* ─────────── Main HealthSetupScreen ─────────── */

export const HealthSetupScreen: React.FC<HealthSetupScreenProps> = ({
  userName = 'John',
  onContinue,
}) => {
  const [step, setStep] = useState(1);

  /* Step 1 state */
  const [year, setYear] = useState('');
  const [program, setProgram] = useState('');
  const [living, setLiving] = useState('');

  /* Step 2 state */
  const [mentalChecked, setMentalChecked] = useState<string[]>([]);
  const [physicalChecked, setPhysicalChecked] = useState<string[]>([]);
  const [lifestyleChecked, setLifestyleChecked] = useState<string[]>([]);
  const [noneApply, setNoneApply] = useState(false);

  const toggle = (
    list: string[],
    setter: (v: string[]) => void,
    val: string,
  ) => {
    setNoneApply(false);
    setter(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);
  };

  const toggleNone = () => {
    setNoneApply(prev => {
      if (!prev) {
        setMentalChecked([]);
        setPhysicalChecked([]);
        setLifestyleChecked([]);
      }
      return !prev;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Health Background</Text>
        <Text style={styles.headerSubtitle}>Welcome, {userName}! One last step.</Text>
        <ProgressBar step={step} />
      </View>

      {/* Step content */}
      {step === 1 && (
        <Step1
          year={year}
          setYear={setYear}
          program={program}
          setProgram={setProgram}
          living={living}
          setLiving={setLiving}
          onContinue={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          mentalChecked={mentalChecked}
          physicalChecked={physicalChecked}
          lifestyleChecked={lifestyleChecked}
          noneApply={noneApply}
          toggleMental={v => toggle(mentalChecked, setMentalChecked, v)}
          togglePhysical={v => toggle(physicalChecked, setPhysicalChecked, v)}
          toggleLifestyle={v => toggle(lifestyleChecked, setLifestyleChecked, v)}
          toggleNone={toggleNone}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <Step3
          userName={userName}
          year={year}
          program={program}
          living={living}
          mentalChecked={mentalChecked}
          physicalChecked={physicalChecked}
          lifestyleChecked={lifestyleChecked}
          noneApply={noneApply}
          onEdit={() => setStep(1)}
          onSave={onContinue}
        />
      )}
    </SafeAreaView>
  );
};

/* ─────────── Styles ─────────── */

const ORANGE = '#D98543';
const DARK = '#1A2340';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';
const WHITE = Colors.white;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFFF2',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FEFFF2',
  },
  headerTitle: {
    color: DARK,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },

  /* Progress bar */
  progressWrap: { marginTop: 4, marginBottom: 2 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStep: { color: DARK, fontSize: 11, fontWeight: '700' },
  progressLabel: { color: MUTED, fontSize: 11 },
  progressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: ORANGE,
    borderRadius: 2,
  },

  /* Scroll */
  stepScroll: { flex: 1 },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },

  /* Info banner */
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  infoIconText: { color: WHITE, fontSize: 11, fontWeight: '800' },
  infoBannerText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17 },

  /* Field labels */
  fieldLabel: {
    color: DARK,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  optional: { color: '#B9B9B9', fontWeight: '400' },

  /* Chip grid */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 13,
    backgroundColor: WHITE,
  },
  chipActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  chipText: { color: '#3E3E3E', fontSize: 12 },
  chipTextActive: { color: WHITE, fontWeight: '600' },

  /* Text input */
  textInput: {
    backgroundColor: WHITE,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 13,
    color: DARK,
  },

  /* Radio group */
  radioGroup: { gap: 8 },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: WHITE,
    gap: 12,
  },
  radioRowActive: {
    borderColor: ORANGE,
    backgroundColor: '#FEF6EE',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: ORANGE },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: ORANGE,
  },
  radioLabel: { color: '#3E3E3E', fontSize: 13 },
  radioLabelActive: { color: DARK, fontWeight: '500' },

  /* Continue button */
  continueBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
  },
  continueBtnActive: {
    backgroundColor: ORANGE,
  },
  continueBtnSmall: { flex: 1, height: 48, marginTop: 0 },
  continueBtnText: { color: MUTED, fontSize: 15, fontWeight: '700' },
  continueBtnTextActive: { color: WHITE, fontSize: 15, fontWeight: '700' },
  continueBtnArrow: { color: MUTED, fontSize: 20, lineHeight: 20 },

  /* Nav row */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  backBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  backBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },

  /* Checklist */
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F6',
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  checkMark: { color: WHITE, fontSize: 11, fontWeight: '800' },
  checkLabel: { flex: 1, color: '#3E3E3E', fontSize: 13, lineHeight: 18 },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconText: { fontSize: 18 },
  sectionTitle: { color: DARK, fontSize: 14, fontWeight: '700' },
  sectionSub: { color: MUTED, fontSize: 11 },

  /* Review / Step 3 */
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D4EDDA',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  successCheck: { color: '#27AE60', fontSize: 32, fontWeight: '800' },
  reviewHeading: {
    color: DARK,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  reviewSubheading: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  summarySection: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryTitle: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  summaryKey: { color: MUTED, fontSize: 13, flex: 1 },
  summaryValue: { color: DARK, fontSize: 13, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  summaryNone: { color: MUTED, fontSize: 13, fontStyle: 'italic' },
  summaryBullet: { color: MUTED, fontSize: 13, marginRight: 4 },
  privacyNote: {
    marginTop: 10,
    backgroundColor: '#F0F8F0',
    borderRadius: 8,
    padding: 10,
  },
  privacyNoteText: { color: '#2D6A4F', fontSize: 11, lineHeight: 16 },
  reviewNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  editBtn: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  editBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  saveBtnText: { color: WHITE, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});