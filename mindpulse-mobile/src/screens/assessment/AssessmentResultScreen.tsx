import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { loadAssessmentState, saveAssessmentState, AssessmentState } from './StressAssessmentHubScreen';
import { saveNewStressSession } from '../../services/dashboard';

interface Props {
  onBack: () => void;
}

export const AssessmentResultScreen: React.FC<Props> = ({ onBack }) => {
  const [clinicsExpanded, setClinicsExpanded] = useState(false);
  const [stateData, setStateData] = useState<AssessmentState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAssessmentState().then(setStateData);
  }, []);

  if (!stateData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6B79F2" />
      </View>
    );
  }

  // Real inputs only — the face scan is a demo and is excluded from scoring.
  // Weights are renormalized across the components that are actually present.
  const surveyVal = stateData.surveyScore;
  const hrBpm = stateData.heartRateBpm;
  const rxMs = stateData.reactionTimeMs;

  // Heart rate → stress (60 bpm baseline; higher bpm = more stress)
  const hrVal = hrBpm != null ? Math.min(100, Math.max(0, (hrBpm - 60) * 2)) : null;
  // Reaction time → stress (250ms baseline; slower reactions = more stress)
  const rxVal = rxMs != null ? Math.min(100, Math.max(0, (rxMs - 250) / 3)) : null;

  const components: { value: number; weight: number }[] = [];
  if (surveyVal != null) components.push({ value: surveyVal, weight: 0.625 });
  if (hrVal != null) components.push({ value: hrVal, weight: 0.25 });
  if (rxVal != null) components.push({ value: rxVal, weight: 0.125 });
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const finalScore =
    totalWeight > 0
      ? Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight)
      : 0;

  // Bands match dashboard levelForScore (High > 60, Moderate > 35, Low ≤ 35)
  const isHighStress = finalScore > 60;
  const isModerateStress = finalScore > 35 && finalScore <= 60;
  const isLowStress = finalScore <= 35;

  const showHelpResources = isHighStress || isModerateStress;

  const getTheme = () => {
    if (isLowStress) return { bg: '#E8F5E9', text: '#2E7D32', pillBg: '#4CAF50', pillText: '#FFF', label: 'Low Stress' };
    if (isModerateStress) return { bg: '#FFF3E0', text: '#E65100', pillBg: '#FF9800', pillText: '#FFF', label: 'Moderate Stress' };
    return { bg: '#FDECE6', text: '#D32F2F', pillBg: '#F44336', pillText: '#FFF', label: 'High Stress' };
  };

  const theme = getTheme();

  const handleSaveResult = async () => {
    setIsSaving(true);
    try {
      await saveNewStressSession(
        finalScore,
        `Multi-modal assessment completed. HR: ${hrBpm ?? 'n/a'}bpm, Reaction: ${rxMs ?? 'n/a'}ms`,
        hrBpm,
        surveyVal,
        rxMs,
      );
      
      // Reset the assessment state back to start
      await saveAssessmentState({
        survey: 'unlocked',
        faceScan: 'locked',
        heartRate: 'locked',
        reaction: 'locked',
      });

      onBack();
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setIsSaving(false);
    }
  };

  return (
    <StressAnalysisLayout
      activeModule="reaction"
      activeSection="results"
      heartRateDone
      onBack={onBack}
    >
      {/* Final Stress Score Card */}
      <View style={[styles.scoreCard, { backgroundColor: theme.bg }]}>
        <Text style={styles.scoreTitle}>Final Stress Score</Text>
        
        <View style={styles.scoreContent}>
          <View style={[styles.scoreCircle, { borderColor: theme.pillBg }]}>
            <Text style={[styles.scoreNumber, { color: theme.text }]}>{finalScore}</Text>
            <Text style={styles.scoreOutof}>out of 100</Text>
          </View>
          
          <View style={styles.scoreLegend}>
            <View style={[styles.scorePill, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.scorePillText, { color: theme.pillText }]}>{theme.label}</Text>
            </View>
            
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>Low (0-35)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
              <Text style={styles.legendText}>Moderate (36-60)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.legendText}>High (61-100)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Multi-Modal Fusion Card */}
      <View style={styles.fusionCard}>
        <Text style={styles.fusionTitle}>Multi-Modal Fusion (Survey 62.5% · Heart Rate 25% · Reaction 12.5%)</Text>

        {surveyVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>Survey (PSS + Physio)</Text>
              <View style={[styles.fusionBadge, { backgroundColor: '#E8EAF6' }]}><Text style={[styles.fusionBadgeText, { color: '#3F51B5' }]}>62.5%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, surveyVal))}%`, backgroundColor: '#5C6BC0' }]} />
            </View>
            <Text style={[styles.fusionScore, { color: '#3F51B5' }]}>{Math.round(surveyVal)}</Text>
          </View>
        )}

        {/* Face scan is a demo — shown for transparency, excluded from the score */}
        <View style={styles.fusionRow}>
          <View style={styles.fusionLabelRow}>
            <Text style={styles.fusionLabel}>Facial Emotion</Text>
            <View style={[styles.fusionBadge, { backgroundColor: '#FFF3E0' }]}><Text style={[styles.fusionBadgeText, { color: '#E08A00' }]}>Demo</Text></View>
          </View>
          <View style={styles.fusionTrack} />
          <Text style={[styles.fusionScore, { color: '#999' }]}>—</Text>
        </View>

        {hrVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>Heart Rate</Text>
              <View style={[styles.fusionBadge, { backgroundColor: '#FFEBEE' }]}><Text style={[styles.fusionBadgeText, { color: '#F44336' }]}>25%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, hrVal))}%`, backgroundColor: '#EF5350' }]} />
            </View>
            <Text style={[styles.fusionScore, { color: '#F44336' }]}>{Math.round(hrVal)}</Text>
          </View>
        )}

        {rxVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>Reaction Time</Text>
              <View style={[styles.fusionBadge, { backgroundColor: '#FFF8E1' }]}><Text style={[styles.fusionBadgeText, { color: '#FFB300' }]}>12.5%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, rxVal))}%`, backgroundColor: '#FFA000' }]} />
            </View>
            <Text style={[styles.fusionScore, { color: '#FFB300' }]}>{Math.round(rxVal)}</Text>
          </View>
        )}
      </View>

      {/* Advisory Card */}
      {isLowStress ? (
        <View style={[styles.advisoryCard, { backgroundColor: '#E8F5E9' }]}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="leaf-outline" size={28} color="#2E7D32" />
            <Text style={[styles.advisoryTitle, { color: '#2E7D32' }]}>You seem relaxed today.</Text>
          </View>
          <Text style={styles.advisoryBody}>
            Maintain healthy routines — good sleep, regular physical activity, and social connections keep stress low.
          </Text>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2E7D32" />
            <Text style={styles.advisoryCheckText}>Keep up your sleep schedule</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2E7D32" />
            <Text style={styles.advisoryCheckText}>Stay hydrated and eat well</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2E7D32" />
            <Text style={styles.advisoryCheckText}>Continue positive activities you enjoy</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.advisoryCard, { backgroundColor: '#FDECE6' }]}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="warning-outline" size={28} color="#D32F2F" />
            <Text style={[styles.advisoryTitle, { color: '#D32F2F' }]}>Your stress indicators are elevated</Text>
          </View>
          <Text style={styles.advisoryBody}>
            Try resting or practicing relaxation techniques. Consider reaching out to a mental health professional for support.
          </Text>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#D32F2F" />
            <Text style={styles.advisoryCheckText}>Rest and avoid overloading tasks</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#D32F2F" />
            <Text style={styles.advisoryCheckText}>Practice deep breathing or meditation</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#D32F2F" />
            <Text style={styles.advisoryCheckText}>Reach out to campus counseling</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#D32F2F" />
            <Text style={styles.advisoryCheckText}>Consider a telehealth consultation</Text>
          </View>
        </View>
      )}

      {/* Conditional Resources */}
      {showHelpResources && (
        <>
          <View style={styles.clinicsCard}>
            <TouchableOpacity 
              style={styles.clinicsHeader} 
              onPress={() => setClinicsExpanded(!clinicsExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.clinicsIconWrap}>
                <Ionicons name="location-outline" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.clinicsTitle}>Find Nearby Psych Clinics</Text>
                <Text style={styles.clinicsSub}>Suggested based on your stress level</Text>
              </View>
              <Ionicons name={clinicsExpanded ? "chevron-up" : "chevron-forward"} size={20} color="#D32F2F" />
            </TouchableOpacity>

            {clinicsExpanded && (
              <View style={styles.clinicsContent}>
                {/* Guidance placeholder — no fabricated locations or distances */}
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="people-outline" size={32} color="#D32F2F" style={{ position: 'absolute', top: 44, alignSelf: 'center' }} />
                </View>

                <View style={styles.clinicItem}>
                  <View style={styles.clinicInfo}>
                    <Text style={styles.clinicName}>Verified telehealth professionals</Text>
                    <Text style={styles.clinicHours}>Open the Clinics tab to browse real clinicians and book a session.</Text>
                    <View style={styles.clinicTag}><Text style={styles.clinicTagText}>In-app directory</Text></View>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.hotlinesCard}>
            <Text style={styles.hotlinesTitle}>Emergency Mental Health Hotlines</Text>
            
            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:988').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: '#F44336' }]}>
                <Ionicons name="call" size={18} color="#FFF" />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>National Crisis Hotline</Text>
                <Text style={styles.hotlineDesc}>988 • 24/7 free & confidential</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:09178001123').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="call" size={18} color="#FFF" />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>In Touch Crisis Line (PH)</Text>
                <Text style={styles.hotlineDesc}>0917-800-1123 • 24/7 support</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:1553').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="call" size={18} color="#FFF" />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>NCMH Crisis Hotline</Text>
                <Text style={styles.hotlineDesc}>1553 • Free, Mon-Fri 8AM - 5PM</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('sms:741741').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: '#03A9F4' }]}>
                <Ionicons name="call" size={18} color="#FFF" />
              </View>
              <View style={styles.hotlineTextWrap}>
                <Text style={styles.hotlineName}>Crisis Text Line</Text>
                <Text style={styles.hotlineDesc}>Text HOME to 741741 • Text-based support</Text>
              </View>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Bottom Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
          onPress={handleSaveResult}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Result'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpBtn}>
          <Text style={styles.helpBtnText}>Get Help</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

    </StressAnalysisLayout>
  );
};

const styles = StyleSheet.create({
  scoreCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  scoreTitle: { fontSize: 16, fontWeight: '700', color: '#666', textAlign: 'center', marginBottom: 16 },
  scoreContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  scoreNumber: { fontSize: 40, fontWeight: '900' },
  scoreOutof: { fontSize: 12, color: '#888', marginTop: -4 },
  scoreLegend: { gap: 8 },
  scorePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4 },
  scorePillText: { fontSize: 12, fontWeight: '800' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { fontSize: 11, color: '#666' },

  fusionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  fusionTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 16 },
  fusionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  fusionLabelRow: { width: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  fusionLabel: { fontSize: 11, color: '#888' },
  fusionBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  fusionBadgeText: { fontSize: 8, fontWeight: '800' },
  fusionTrack: { flex: 1, height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, marginHorizontal: 8 },
  fusionFill: { height: '100%', borderRadius: 3 },
  fusionScore: { fontSize: 12, fontWeight: '800', width: 24, textAlign: 'right' },

  advisoryCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  advisoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  advisoryTitle: { fontSize: 18, fontWeight: '800' },
  advisoryBody: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 16 },
  advisoryCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  advisoryCheckText: { fontSize: 12, color: '#555' },

  clinicsCard: { backgroundColor: '#FDECE6', borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  clinicsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  clinicsIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center' },
  clinicsTitle: { fontSize: 14, fontWeight: '800', color: '#D32F2F' },
  clinicsSub: { fontSize: 11, color: '#D32F2F' },
  clinicsContent: { padding: 16, paddingTop: 0 },
  mapPlaceholder: { height: 120, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, opacity: 0.8 },
  clinicItem: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clinicInfo: { flex: 1 },
  clinicName: { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  clinicHours: { fontSize: 11, color: '#888', marginBottom: 4 },
  clinicTag: { backgroundColor: '#FDECE6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  clinicTagText: { fontSize: 9, color: '#D32F2F', fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E53935', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: 4 },
  callBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  clinicDist: { fontSize: 10, color: '#D32F2F', fontWeight: '600' },

  hotlinesCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  hotlinesTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 16 },
  hotlineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hotlineIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hotlineTextWrap: { flex: 1, marginLeft: 12 },
  hotlineName: { fontSize: 13, fontWeight: '800', color: '#1A1A1A' },
  hotlineDesc: { fontSize: 11, color: '#666', marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  saveBtn: { flex: 1, height: 50, backgroundColor: '#81C784', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  helpBtn: { flex: 1, height: 50, backgroundColor: '#6B79F2', borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  helpBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
