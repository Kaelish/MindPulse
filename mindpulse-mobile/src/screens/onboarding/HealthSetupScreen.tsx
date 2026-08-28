import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../theme/colors';

interface HealthSetupScreenProps {
  onContinue: () => void;
}

const livingOptions = ['With family', 'On-campus dormitory', 'Off-campus - alone', 'With roommates / friends'];

export const HealthSetupScreen: React.FC<HealthSetupScreenProps> = ({ onContinue }) => {
  const [year, setYear] = useState('1st Year');
  const [living, setLiving] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.step}>Step 1 of 3</Text>
      <Text style={styles.title}>Health Background</Text>
      <Text style={styles.subtitle}>Welcome, John! One last step.</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>This information helps MindPulse contextualise your stress analysis results. All responses are stored locally and never shared externally.</Text>
      </View>

      <Text style={styles.label}>Year / Academic Level</Text>
      <View style={styles.optionGrid}>
        {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduate / Postgrad', 'Faculty / Staff'].map(option => (
          <Pressable key={option} onPress={() => setYear(option)} style={[styles.option, year === option && styles.optionActive]}>
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Program / Course <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput placeholder="e.g. BS Computer Science, AB Psychology..." placeholderTextColor="#A2A2A2" style={styles.input} />

      <Text style={styles.label}>Living Situation</Text>
      {livingOptions.map(option => (
        <Pressable key={option} onPress={() => setLiving(option)} style={styles.livingRow}>
          <View style={[styles.radio, living === option && styles.radioActive]} />
          <Text style={styles.livingText}>{option}</Text>
        </Pressable>
      ))}

      <Pressable onPress={onContinue} style={styles.continueButton}>
        <Text style={styles.continueText}>Continue</Text>
        <Text style={styles.arrow}>↓</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEFFF2', paddingHorizontal: 44, paddingTop: 44 },
  step: { color: '#000', fontSize: 10, fontWeight: '700', marginTop: 26 },
  title: { color: '#000', fontSize: 25, fontWeight: '800', marginTop: 48 },
  subtitle: { color: 'rgba(0,0,0,0.4)', fontSize: 15, textAlign: 'center', marginTop: 5 },
  notice: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 26 },
  noticeText: { color: '#92400E', fontSize: 12, lineHeight: 17 },
  label: { color: '#000', fontSize: 15, fontWeight: '600', marginTop: 24, marginBottom: 10 },
  optional: { color: '#B9B9B9', fontWeight: '400' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 15, paddingVertical: 7, paddingHorizontal: 12 },
  optionActive: { backgroundColor: '#FCEAE4', borderColor: '#D58046' },
  optionText: { color: '#3E3E3E', fontSize: 12 },
  input: { backgroundColor: Colors.white, borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 15, height: 44, paddingHorizontal: 20, fontSize: 12 },
  livingRow: { height: 45, flexDirection: 'row', alignItems: 'center', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, marginBottom: 8, backgroundColor: Colors.white },
  radio: { width: 16, height: 16, borderRadius: 8, borderColor: '#D1D5DB', borderWidth: 1, marginRight: 12 },
  radioActive: { backgroundColor: '#D58046', borderColor: '#D58046' },
  livingText: { color: '#3E3E3E', fontSize: 12 },
  continueButton: { height: 52, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 16 },
  continueText: { color: '#64748B', fontSize: 15, fontWeight: '700' },
  arrow: { color: '#64748B', fontSize: 16 },
});