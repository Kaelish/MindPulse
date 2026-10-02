import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing, Typography } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StressAnalysisLayout } from '../../components/StressAnalysisLayout';
import { loadAssessmentState, saveAssessmentState, markDayComplete, isDayComplete, AssessmentState } from './StressAssessmentHubScreen';
import { saveNewStressSession } from '../../services/dashboard';
import { fetchDoctorPanel, PanelDoctor } from '../../services/appointments';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';

interface Props {
  onBack: () => void;
  /** Opens the Clinics tab so the patient can book with one of the panel doctors. */
  onBookSession?: () => void;
}

export const AssessmentResultScreen: React.FC<Props> = ({ onBack, onBookSession }) => {
  const [clinicsExpanded, setClinicsExpanded] = useState(false);
  const [stateData, setStateData] = useState<AssessmentState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // "Get Help" must never be a dead button: it reveals the resource cards even
  // for a low-stress result, where they are otherwise hidden.
  const [helpRequested, setHelpRequested] = useState(false);
  // High-stress results offer a tap-to-call panel before the crisis hotlines.
  const [panel, setPanel] = useState<PanelDoctor[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setPanelLoading(true);
    fetchDoctorPanel()
      .then((docs) => {
        if (alive) setPanel(docs);
      })
      .catch(() => {
        // A missing panel must never mask the assessment result itself.
        if (alive) setPanel([]);
      })
      .finally(() => {
        if (alive) setPanelLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    loadAssessmentState().then(setStateData);
  }, []);

  if (!stateData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tone('#6B79F2')} />
      </View>
    );
  }

  // Real inputs only — the face scan is a demo and is excluded from scoring.
  // Weights are renormalized across the components that are actually present.
  const surveyVal = stateData.surveyScore;
  const hrBpm = stateData.heartRateBpm;
  const rxMs = stateData.reactionTimeMs;

  // Re-opening these results after saving must not create a second row today.
  const alreadySavedToday = isDayComplete(stateData);

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

  const showHelpResources = helpRequested || isHighStress || isModerateStress;

  const handleGetHelp = () => {
    setHelpRequested(true);
    setClinicsExpanded(true);
  };

  const getTheme = () => {
    if (isLowStress) return { bg: toneBg('#E8F5E9'), text: tone('#2E7D32'), pillBg: toneBg('#4CAF50'), pillText: tone('#FFF'), label: 'Low Stress' };
    if (isModerateStress) return { bg: toneBg('#FFF3E0'), text: tone('#E65100'), pillBg: toneBg('#FF9800'), pillText: tone('#FFF'), label: 'Moderate Stress' };
    return { bg: toneBg('#FDECE6'), text: tone('#D32F2F'), pillBg: toneBg('#F44336'), pillText: tone('#FFF'), label: 'High Stress' };
  };

  const theme = getTheme();

  const handleSaveResult = async () => {
    if (alreadySavedToday) return;
    setIsSaving(true);
    try {
      await saveNewStressSession(
        finalScore,
        `Multi-modal assessment completed. HR: ${hrBpm ?? 'n/a'}bpm, Reaction: ${rxMs ?? 'n/a'}ms`,
        hrBpm,
        surveyVal,
        rxMs,
      );

      // Today is now spent: keep the numbers for review, close every step, and
      // let the hub show "Today's assessment is complete!" until midnight.
      await saveAssessmentState(markDayComplete(stateData));

      onBack();
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setIsSaving(false);
    }
  };

  return (
    <StressAnalysisLayout
      activeModule="reaction"
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
              <View style={[styles.legendDot, { backgroundColor: toneBg('#4CAF50') }]} />
              <Text style={styles.legendText}>Low (0-35)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: toneBg('#FF9800') }]} />
              <Text style={styles.legendText}>Moderate (36-60)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: toneBg('#F44336') }]} />
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
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#E8EAF6') }]}><Text style={[styles.fusionBadgeText, { color: tone('#3F51B5') }]}>62.5%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, surveyVal))}%`, backgroundColor: toneBg('#5C6BC0') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#3F51B5') }]}>{Math.round(surveyVal)}</Text>
          </View>
        )}

        {/* Face scan is a demo — shown for transparency, excluded from the score */}
        <View style={styles.fusionRow}>
          <View style={styles.fusionLabelRow}>
            <Text style={styles.fusionLabel}>Facial Emotion</Text>
            <View style={[styles.fusionBadge, { backgroundColor: toneBg('#FFF3E0') }]}><Text style={[styles.fusionBadgeText, { color: tone('#E08A00') }]}>Demo</Text></View>
          </View>
          <View style={styles.fusionTrack} />
          <Text style={[styles.fusionScore, { color: tone('#999') }]}>—</Text>
        </View>

        {hrVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>Heart Rate</Text>
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#FFEBEE') }]}><Text style={[styles.fusionBadgeText, { color: tone('#F44336') }]}>25%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, hrVal))}%`, backgroundColor: toneBg('#EF5350') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#F44336') }]}>{Math.round(hrVal)}</Text>
          </View>
        )}

        {rxVal != null && (
          <View style={styles.fusionRow}>
            <View style={styles.fusionLabelRow}>
              <Text style={styles.fusionLabel}>Reaction Time</Text>
              <View style={[styles.fusionBadge, { backgroundColor: toneBg('#FFF8E1') }]}><Text style={[styles.fusionBadgeText, { color: tone('#FFB300') }]}>12.5%</Text></View>
            </View>
            <View style={styles.fusionTrack}>
              <View style={[styles.fusionFill, { width: `${Math.min(100, Math.max(0, rxVal))}%`, backgroundColor: toneBg('#FFA000') }]} />
            </View>
            <Text style={[styles.fusionScore, { color: tone('#FFB300') }]}>{Math.round(rxVal)}</Text>
          </View>
        )}
      </View>

      {/* Advisory Card */}
      {isLowStress ? (
        <View style={[styles.advisoryCard, { backgroundColor: toneBg('#E8F5E9') }]}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="leaf-outline" size={28} color={tone('#2E7D32')} />
            <Text style={[styles.advisoryTitle, { color: tone('#2E7D32') }]}>You seem relaxed today.</Text>
          </View>
          <Text style={styles.advisoryBody}>
            Maintain healthy routines — good sleep, regular physical activity, and social connections keep stress low.
          </Text>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#2E7D32')} />
            <Text style={styles.advisoryCheckText}>Keep up your sleep schedule</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#2E7D32')} />
            <Text style={styles.advisoryCheckText}>Stay hydrated and eat well</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#2E7D32')} />
            <Text style={styles.advisoryCheckText}>Continue positive activities you enjoy</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.advisoryCard, { backgroundColor: toneBg('#FDECE6') }]}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="warning-outline" size={28} color={tone('#D32F2F')} />
            <Text style={[styles.advisoryTitle, { color: tone('#D32F2F') }]}>Your stress indicators may be elevated</Text>
          </View>
          <Text style={styles.advisoryBody}>
            Try resting or practicing relaxation techniques. Consider reaching out to a mental health professional for support.
          </Text>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#D32F2F')} />
            <Text style={styles.advisoryCheckText}>Rest and avoid overloading tasks</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#D32F2F')} />
            <Text style={styles.advisoryCheckText}>Practice deep breathing or meditation</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#D32F2F')} />
            <Text style={styles.advisoryCheckText}>Reach out to campus counseling</Text>
          </View>
          <View style={styles.advisoryCheck}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tone('#D32F2F')} />
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
                <Ionicons name="location-outline" size={20} color={tone('#FFF')} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.clinicsTitle}>Find Nearby Psych Clinics</Text>
                <Text style={styles.clinicsSub}>Suggested based on your stress level</Text>
              </View>
              <Ionicons name={clinicsExpanded ? "chevron-up" : "chevron-forward"} size={20} color={tone('#D32F2F')} />
            </TouchableOpacity>

            {clinicsExpanded && (
              <View style={styles.clinicsContent}>
                {/* Guidance placeholder — no fabricated locations or distances */}
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="people-outline" size={32} color={tone('#D32F2F')} style={{ position: 'absolute', top: 44, alignSelf: 'center' }} />
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

          {/* High stress: reach a real doctor before the crisis hotlines */}
          {isHighStress && (
            <View style={styles.doctorPanelCard}>
              <View style={styles.doctorPanelHeader}>
                <View style={styles.doctorPanelIconWrap}>
                  <Ionicons name="medkit-outline" size={18} color={tone('#FFF')} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.doctorPanelTitle}>Call One of Our Doctors</Text>
                  <Text style={styles.doctorPanelSub}>Verified professionals on the MindPulse panel</Text>
                </View>
              </View>

              {panelLoading && (
                <ActivityIndicator size="small" color={tone('#D32F2F')} style={{ marginVertical: 12 }} />
              )}

              {!panelLoading && panel.length === 0 && (
                <Text style={styles.doctorPanelEmpty}>
                  No panel doctors are listed right now. Please use the crisis hotlines below.
                </Text>
              )}

              {!panelLoading &&
                panel.map((doc) => (
                  <View key={doc.id} style={styles.doctorRow}>
                    <View style={styles.doctorAvatar}>
                      <Text style={styles.doctorAvatarText}>
                        {doc.name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.doctorName}>{doc.name}</Text>
                      <Text style={styles.doctorSpec} numberOfLines={1}>{doc.specialty}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.doctorCallBtn, !doc.contactNumber && { opacity: 0.5 }]}
                      onPress={() => doc.contactNumber && Linking.openURL(`tel:${doc.contactNumber}`).catch(() => {})}
                      disabled={!doc.contactNumber}
                      activeOpacity={0.8}>
                      <Ionicons name="call" size={13} color={tone('#FFF')} />
                      <Text style={styles.doctorCallText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                ))}

              {onBookSession && (
                <TouchableOpacity style={styles.doctorBookBtn} onPress={onBookSession} activeOpacity={0.85}>
                  <Text style={styles.doctorBookText}>Book a session</Text>
                  <Ionicons name="arrow-forward" size={16} color={tone('#FFF')} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.hotlinesCard}>
            <Text style={styles.hotlinesTitle}>Emergency Mental Health Hotlines</Text>
            
            <TouchableOpacity
              style={styles.hotlineItem}
              onPress={() => Linking.openURL('tel:988').catch(() => {})}
              activeOpacity={0.7}
            >
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#F44336') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
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
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#FF9800') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
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
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#9C27B0') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
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
              <View style={[styles.hotlineIconWrap, { backgroundColor: toneBg('#03A9F4') }]}>
                <Ionicons name="call" size={18} color={tone('#FFF')} />
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
          style={[styles.saveBtn, (isSaving || alreadySavedToday) && { opacity: 0.7 }]} 
          onPress={handleSaveResult}
          disabled={isSaving || alreadySavedToday}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Saving...' : alreadySavedToday ? 'Saved for today' : 'Save Result'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpBtn} onPress={handleGetHelp}>
          <Text style={styles.helpBtnText}>Get Help</Text>
          <Ionicons name="arrow-forward" size={16} color={tone('#FFF')} />
        </TouchableOpacity>
      </View>

    </StressAnalysisLayout>
  );
};

const makeStyles = () => StyleSheet.create({
  scoreCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  scoreTitle: { fontSize: 16, fontWeight: '700', color: tone('#666'), textAlign: 'center', marginBottom: 16 },
  scoreContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: toneBg('#FFF') },
  scoreNumber: { fontSize: 40, fontWeight: '900' },
  scoreOutof: { fontSize: 12, color: tone('#888'), marginTop: -4 },
  scoreLegend: { gap: 8 },
  scorePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4 },
  scorePillText: { fontSize: 12, fontWeight: '800' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { fontSize: 11, color: tone('#666') },

  fusionCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: toneBg('#EEE') },
  fusionTitle: { fontSize: 14, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 16 },
  fusionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  fusionLabelRow: { width: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  fusionLabel: { fontSize: 11, color: tone('#888') },
  fusionBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  fusionBadgeText: { fontSize: 8, fontWeight: '800' },
  fusionTrack: { flex: 1, height: 6, backgroundColor: toneBg('#E0E0E0'), borderRadius: 3, marginHorizontal: 8 },
  fusionFill: { height: '100%', borderRadius: 3 },
  fusionScore: { fontSize: 12, fontWeight: '800', width: 24, textAlign: 'right' },

  advisoryCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  advisoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  advisoryTitle: { fontSize: 18, fontWeight: '800' },
  advisoryBody: { fontSize: 13, color: tone('#666'), lineHeight: 20, marginBottom: 16 },
  advisoryCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  advisoryCheckText: { fontSize: 12, color: tone('#555') },

  clinicsCard: { backgroundColor: toneBg('#FDECE6'), borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  clinicsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  clinicsIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: toneBg('#E53935'), alignItems: 'center', justifyContent: 'center' },
  clinicsTitle: { fontSize: 14, fontWeight: '800', color: tone('#D32F2F') },
  clinicsSub: { fontSize: 11, color: tone('#D32F2F') },
  clinicsContent: { padding: 16, paddingTop: 0 },
  mapPlaceholder: { height: 120, backgroundColor: toneBg('#FFF'), borderRadius: 12, marginBottom: 16, opacity: 0.8 },
  clinicItem: { backgroundColor: toneBg('#FFF'), borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clinicInfo: { flex: 1 },
  clinicName: { fontSize: 13, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 2 },
  clinicHours: { fontSize: 11, color: tone('#888'), marginBottom: 4 },
  clinicTag: { backgroundColor: toneBg('#FDECE6'), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  clinicTagText: { fontSize: 9, color: tone('#D32F2F'), fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#E53935'), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: 4 },
  callBtnText: { color: tone('#FFF'), fontSize: 12, fontWeight: '700', marginLeft: 4 },
  clinicDist: { fontSize: 10, color: tone('#D32F2F'), fontWeight: '600' },

  doctorPanelCard: { backgroundColor: toneBg('#FFF5F5'), borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: toneBg('#FFCDD2') },
  doctorPanelHeader: { flexDirection: 'row', alignItems: 'center' },
  doctorPanelIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: toneBg('#D32F2F'), alignItems: 'center', justifyContent: 'center' },
  doctorPanelTitle: { fontSize: 15, fontWeight: '800', color: tone('#1A1A1A') },
  doctorPanelSub: { fontSize: 11, color: tone('#8A6A6A'), marginTop: 2 },
  doctorPanelEmpty: { fontSize: 12, color: tone('#8A6A6A'), marginVertical: 12, lineHeight: 18 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#FFF'), borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: toneBg('#FBE9E7') },
  doctorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: toneBg('#FDECE6'), alignItems: 'center', justifyContent: 'center' },
  doctorAvatarText: { fontSize: 13, fontWeight: '800', color: tone('#D32F2F') },
  doctorName: { fontSize: 13, fontWeight: '800', color: tone('#1A1A1A') },
  doctorSpec: { fontSize: 11, color: tone('#666'), marginTop: 2 },
  doctorCallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: toneBg('#E53935'), paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginLeft: 8 },
  doctorCallText: { color: tone('#FFF'), fontSize: 12, fontWeight: '700' },
  doctorBookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, backgroundColor: toneBg('#D32F2F'), borderRadius: 23, marginTop: 14 },
  doctorBookText: { color: tone('#FFF'), fontSize: 14, fontWeight: '700' },

  hotlinesCard: { backgroundColor: toneBg('#FFF'), borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: toneBg('#EEE') },
  hotlinesTitle: { fontSize: 14, fontWeight: '800', color: tone('#1A1A1A'), marginBottom: 16 },
  hotlineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hotlineIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hotlineTextWrap: { flex: 1, marginLeft: 12 },
  hotlineName: { fontSize: 13, fontWeight: '800', color: tone('#1A1A1A') },
  hotlineDesc: { fontSize: 11, color: tone('#666'), marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  saveBtn: { flex: 1, height: 50, backgroundColor: toneBg('#81C784'), borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: tone('#FFF'), fontSize: 14, fontWeight: '700' },
  helpBtn: { flex: 1, height: 50, backgroundColor: toneBg('#6B79F2'), borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  helpBtnText: { color: tone('#FFF'), fontSize: 14, fontWeight: '700' },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
