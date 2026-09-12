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
import { Radius, Spacing, Typography } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';

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
  'Regular prescribed medication',
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

const RadioOption = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.radioRow, selected && styles.radioRowActive]}>
    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
      {selected && <View style={styles.radioInner} />}
    </View>
    <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
  </Pressable>
);

const CheckItem = ({ label, checked, onPress, color }: { label: string; checked: boolean; onPress: () => void, color?: string }) => (
  <Pressable onPress={onPress} style={styles.checkRow}>
    <View style={[styles.checkBox, checked && { backgroundColor: color || '#27AE60', borderColor: color || '#27AE60' }]}>
      {checked && <Text style={styles.checkMark}>✓</Text>}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
  </Pressable>
);

/* ─────────── Shared Category Card ─────────── */
const CategoryCard = ({ iconName, title, subtitle, options, checkedList, toggleFn, themeColor, bgColor }: any) => (
  <View style={[styles.categoryCard, { borderColor: themeColor }]}>
    <View style={[styles.categoryHeader, { backgroundColor: bgColor }]}>
      <View style={[styles.categoryIconWrap, { backgroundColor: themeColor }]}>
        <Ionicons name={iconName} size={18} color={Colors.white} />
      </View>
      <View>
        <Text style={[styles.categoryTitle, { color: Colors.textPrimary }]}>{title}</Text>
        <Text style={styles.categorySub}>{subtitle}</Text>
      </View>
    </View>
    <View style={styles.categoryBody}>
      {options.map((opt: string) => (
        <CheckItem
          key={opt}
          label={opt}
          checked={checkedList.includes(opt)}
          onPress={() => toggleFn(opt)}
          color={themeColor}
        />
      ))}
    </View>
  </View>
);

/* ─────────── Step 1 — Academic Info ─────────── */
const Step1 = ({ year, setYear, program, setProgram, living, setLiving, onContinue }: any) => {
  const isValid = year !== '' && living !== '';
  return (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <InfoBanner text="This information helps MindPulse contextualise your stress analysis results. All responses are stored locally and never shared externally. You may skip any item." />

      <Text style={styles.fieldLabel}>Year / Academic Level</Text>
      <View style={styles.chipGrid}>
        {YEAR_OPTIONS.map(opt => (
          <Pressable key={opt} onPress={() => setYear(opt)} style={[styles.chip, year === opt && styles.chipActive]}>
            <Text style={[styles.chipText, year === opt && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Program / Course <Text style={styles.optional}>(optional)</Text></Text>
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
          <RadioOption key={opt} label={opt} selected={living === opt} onPress={() => setLiving(opt)} />
        ))}
      </View>

      <Pressable onPress={onContinue} style={[styles.continueBtn, isValid && styles.continueBtnActive]}>
        <Text style={[styles.continueBtnText, isValid && styles.continueBtnTextActive]}>Continue  ›</Text>
      </Pressable>
    </ScrollView>
  );
};

/* ─────────── Step 2 — Health Conditions ─────────── */
const Step2 = ({ 
  mentalChecked, physicalChecked, lifestyleChecked, noneApply, 
  toggleMental, togglePhysical, toggleLifestyle, toggleNone, 
  onBack, onContinue 
}: any) => {
  return (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.infoBanner, { backgroundColor: '#E9F5E9', borderColor: '#A3D9A5' }]}>
        <View style={[styles.infoIcon, { backgroundColor: '#27AE60' }]}>
          <Text style={styles.infoIconText}>✓</Text>
        </View>
        <Text style={[styles.infoBannerText, { color: '#1B5E20' }]}>Check all that apply. This data is only used to add context to your analysis — it does not replace a medical diagnosis.</Text>
      </View>

      <CategoryCard 
        iconName="heart-half-outline" title="Mental Health Conditions" subtitle="Affects stress baselines"
        options={MENTAL_HEALTH_OPTIONS} checkedList={mentalChecked} toggleFn={toggleMental}
        themeColor="#9E85F9" bgColor="#F0EBFE"
      />

      <CategoryCard 
        iconName="medical-outline" title="Physical Health Conditions" subtitle="May affect biometric readings"
        options={PHYSICAL_HEALTH_OPTIONS} checkedList={physicalChecked} toggleFn={togglePhysical}
        themeColor="#4A90E2" bgColor="#E9F5FF"
      />

      <CategoryCard 
        iconName="leaf-outline" title="Lifestyle & Habits" subtitle="Daily patterns that affect stress"
        options={LIFESTYLE_OPTIONS} checkedList={lifestyleChecked} toggleFn={toggleLifestyle}
        themeColor="#27AE60" bgColor="#E6F8ED"
      />

      <Pressable onPress={toggleNone} style={[styles.noneBox, noneApply && styles.noneBoxActive]}>
        <View style={[styles.checkBox, noneApply && { backgroundColor: '#27AE60', borderColor: '#27AE60' }]}>
          {noneApply && <Ionicons name="checkmark" size={12} color={Colors.white} />}
        </View>
        <Text style={[styles.checkLabel, noneApply && { fontWeight: '700' }]}>None of the above apply to me</Text>
      </Pressable>

      <View style={styles.navRow}>
        <Pressable onPress={onBack} style={styles.backBtn}><Text style={styles.backBtnText}>← Back</Text></Pressable>
        <Pressable onPress={onContinue} style={[styles.continueBtn, styles.continueBtnActive, styles.continueBtnSmall]}>
          <Text style={styles.continueBtnTextActive}>Continue  ›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

/* ─────────── Step 3 — Review & Confirm ─────────── */
const Step3 = ({ userName, year, program, living, mentalChecked, physicalChecked, lifestyleChecked, noneApply, onEdit, onSave }: any) => {
  const flaggedConditions = [...mentalChecked, ...physicalChecked, ...lifestyleChecked];
  const noConditions = noneApply || flaggedConditions.length === 0;

  return (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.successCircle}>
        <Ionicons name="checkmark" size={32} color={Colors.white} />
      </View>
      <Text style={styles.reviewHeading}>Looking good, {userName}!</Text>
      <Text style={styles.reviewSubheading}>Here's a summary of your health background profile.</Text>

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

      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>HEALTH CONDITIONS FLAGGED</Text>
        {noConditions ? (
          <View style={styles.summaryRow}>
            <Ionicons name="checkmark-circle" size={16} color="#27AE60" style={{marginRight: 6}} />
            <Text style={styles.summaryValue}>No conditions specified</Text>
          </View>
        ) : (
          flaggedConditions.map((c: string, idx: number) => (
            <View key={idx} style={styles.summaryRow}>
              <Ionicons name="ellipse" size={6} color={Colors.textSecondary} style={{marginRight: 8, marginTop: 6}} />
              <Text style={styles.summaryValue}>{c}</Text>
            </View>
          ))
        )}
      </View>
      
      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>
          ⓘ Your health profile is stored locally on this device only. It will be used solely to provide more contextualised stress analysis — never shared or used for medical decisions.
        </Text>
      </View>

      <View style={styles.reviewNavRow}>
        <Pressable onPress={onEdit} style={styles.backBtn}><Text style={styles.backBtnText}>← Edit</Text></Pressable>
        <Pressable onPress={onSave} style={[styles.continueBtn, styles.continueBtnActive, styles.continueBtnSmall]}>
          <Text style={styles.continueBtnTextActive}>Save & Start Using MindPulse</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

/* ─────────── Main Screen ─────────── */
export const HealthSetupScreen: React.FC<HealthSetupScreenProps> = ({ userName = 'John', onContinue }) => {
  const [step, setStep] = useState(1);
  const [year, setYear] = useState('');
  const [program, setProgram] = useState('');
  const [living, setLiving] = useState('');
  const [mentalChecked, setMentalChecked] = useState<string[]>([]);
  const [physicalChecked, setPhysicalChecked] = useState<string[]>([]);
  const [lifestyleChecked, setLifestyleChecked] = useState<string[]>([]);
  const [noneApply, setNoneApply] = useState(false);

  const toggle = (list: string[], setter: (v: string[]) => void, val: string) => {
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Health Background</Text>
        <Text style={styles.headerSubtitle}>Welcome, {userName}! One last step.</Text>
        <ProgressBar step={step} />
      </View>

      {step === 1 && <Step1 year={year} setYear={setYear} program={program} setProgram={setProgram} living={living} setLiving={setLiving} onContinue={() => setStep(2)} />}
      {step === 2 && <Step2 mentalChecked={mentalChecked} physicalChecked={physicalChecked} lifestyleChecked={lifestyleChecked} noneApply={noneApply} toggleMental={v => toggle(mentalChecked, setMentalChecked, v)} togglePhysical={v => toggle(physicalChecked, setPhysicalChecked, v)} toggleLifestyle={v => toggle(lifestyleChecked, setLifestyleChecked, v)} toggleNone={toggleNone} onBack={() => setStep(1)} onContinue={() => setStep(3)} />}
      {step === 3 && <Step3 userName={userName} year={year} program={program} living={living} mentalChecked={mentalChecked} physicalChecked={physicalChecked} lifestyleChecked={lifestyleChecked} noneApply={noneApply} onEdit={() => setStep(1)} onSave={onContinue} />}
    </SafeAreaView>
  );
};

/* ─────────── Styles ─────────── */
const ORANGE = Colors.btnOrange;
const WHITE = Colors.white;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.pageBg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, backgroundColor: Colors.pageBg },
  headerTitle: { color: Colors.textPrimary, ...Typography.h2, textAlign: 'center' },
  headerSubtitle: { color: Colors.textSecondary, ...Typography.body2, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  progressWrap: { marginTop: 4, marginBottom: 2 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressStep: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  progressLabel: { color: '#B0B8C8', fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: ORANGE, borderRadius: 3 },
  stepScroll: { flex: 1 },
  stepContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  
  infoBanner: { flexDirection: 'row', backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 24, gap: 10, alignItems: 'center' },
  infoIcon: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D97706', alignItems: 'center', justifyContent: 'center' },
  infoIconText: { color: '#D97706', fontSize: 12, fontWeight: '800' },
  infoBannerText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 18 },

  fieldLabel: { color: Colors.textPrimary, ...Typography.h3, marginTop: 16, marginBottom: 12 },
  optional: { color: '#B0B8C8', fontWeight: '400', fontSize: 14 },
  
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  chip: { borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: WHITE },
  chipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: WHITE },

  textInput: { backgroundColor: WHITE, borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 16, height: 52, paddingHorizontal: 16, fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  
  radioGroup: { gap: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', height: 56, borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, backgroundColor: WHITE, gap: 12 },
  radioRowActive: { borderColor: ORANGE },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: ORANGE },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  radioLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },
  radioLabelActive: { color: Colors.textPrimary, fontWeight: '700' },

  continueBtn: { height: 56, borderRadius: 16, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 32 },
  continueBtnActive: { backgroundColor: ORANGE },
  continueBtnSmall: { flex: 1, marginTop: 0 },
  continueBtnText: { color: '#94A3B8', fontSize: 16, fontWeight: '800' },
  continueBtnTextActive: { color: WHITE },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32 },
  backBtn: { height: 56, paddingHorizontal: 24, borderRadius: 16, backgroundColor: '#F0F2F6', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },

  categoryCard: { backgroundColor: WHITE, borderRadius: 16, borderWidth: 2, marginBottom: 20, overflow: 'hidden' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  categoryIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  cardIconText: { display: 'none' },
  categoryTitle: { fontSize: 15, fontWeight: '800' },
  categorySub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  categoryBody: { padding: 16, paddingTop: 4, gap: 16 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  checkMark: { display: 'none' },
  checkLabel: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },

  noneBox: { flexDirection: 'row', alignItems: 'center', height: 56, borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, backgroundColor: WHITE, gap: 12, marginBottom: 12 },
  noneBoxActive: { borderColor: '#27AE60', backgroundColor: '#F0F8F0' },

  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E6F8ED', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20, marginTop: 10 },
  successCheck: { color: '#27AE60', fontSize: 40, fontWeight: '800' },
  reviewHeading: { color: Colors.textPrimary, ...Typography.h1, textAlign: 'center', marginBottom: 8 },
  reviewSubheading: { color: Colors.textSecondary, ...Typography.body2, textAlign: 'center', marginBottom: 32 },

  summarySection: { backgroundColor: WHITE, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryTitle: { color: '#A0B4CC', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  summaryKey: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  summaryValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1.5, textAlign: 'right' },
  
  noneFlaggedWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },

  privacyNote: { backgroundColor: '#F0E8FB', borderRadius: 12, padding: 16, marginTop: 10, marginBottom: 32 },
  privacyNoteText: { color: '#7C4DCC', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  
  reviewNavRow: { flexDirection: 'row', gap: 12 },
});