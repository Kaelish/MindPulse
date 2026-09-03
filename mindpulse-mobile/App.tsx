import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HealthSetupScreen } from './src/screens/onboarding/HealthSetupScreen';
import { PatientDashboardScreen } from './src/screens/patient/PatientDashboardScreen';
import { PatientProfileScreen } from './src/screens/patient/PatientProfileScreen';
import { HeartRateNavigator } from './src/screens/heartrate/HeartRateNavigator';
import { AppointmentBookingScreen } from './src/screens/appointments/AppointmentBookingScreen';
import { VideoCallScreen } from './src/screens/calls/VideoCallScreen';
import { ReactionGameScreen, ReactionResult } from './src/screens/reaction/ReactionGameScreen';
import { FinalStressScoreScreen } from './src/screens/results/FinalStressScoreScreen';
import { BottomNavTab, BottomTabBar } from './src/components/navigation/BottomTabBar';
import { BackButton } from './src/components/navigation/BackButton';
import { saveNewStressSession } from './src/services/dashboard';
import { Colors } from './src/theme/colors';

type ScreenMode = 'splash' | 'main' | 'healthSetup' | 'reaction' | 'finalResults' | 'call';

function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('splash');
  const [currentTab, setCurrentTab] = useState<BottomNavTab>('home');
  const [heartRateBpm, setHeartRateBpm] = useState(0);
  const [reactionResult, setReactionResult] = useState<ReactionResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setScreenMode('main');
      setCurrentTab('home');
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  const handleTabNavigate = (tab: BottomNavTab) => {
    setCurrentTab(tab);
    setScreenMode('main');
  };

  const handleBack = () => {
    if (screenMode === 'healthSetup') {
      setScreenMode('main');
      setCurrentTab('profile');
      return;
    }

    if (screenMode === 'call') {
      setScreenMode('main');
      setCurrentTab('home');
      return;
    }

    if (screenMode === 'reaction') {
      setScreenMode('main');
      setCurrentTab('analysis');
      return;
    }

    if (screenMode === 'finalResults') {
      setScreenMode('reaction');
      return;
    }

    if (screenMode === 'main' && currentTab !== 'home') {
      setCurrentTab('home');
    }
  };

  const handleReactionComplete = async (result: ReactionResult) => {
    setReactionResult(result);
    setScreenMode('finalResults');
  };

  const handleAnalysisComplete = (bpm: number) => {
    setHeartRateBpm(bpm);
    setScreenMode('reaction');
  };

  const handleFinalResultsDone = async () => {
    if (!reactionResult) return;
    const score = Math.min(100, Math.max(20, reactionResult.score));
    await saveNewStressSession(
      score,
      `Completed reaction time assessment (${reactionResult.average} ms average)`,
      heartRateBpm,
    );
    setCurrentTab('profile');
    setScreenMode('main');
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8ED" />
      <View style={styles.root}>
        {screenMode === 'splash' ? (
          <View style={styles.splash}>
            <View style={styles.logoMark}>
              <View style={styles.logoPulse} />
            </View>
            <RNText style={styles.logoText}>MindPulse</RNText>
            <RNText style={styles.tagline}>Your personal stress companion</RNText>
          </View>
        ) : screenMode === 'healthSetup' ? (
          <View style={styles.screenWithBackButton}>
            <HealthSetupScreen
              onContinue={() => {
                setCurrentTab('profile');
                setScreenMode('main');
              }}
            />
            <BackButton onPress={handleBack} />
          </View>
        ) : screenMode === 'call' ? (
          <View style={styles.screenWithBackButton}>
            <VideoCallScreen
              doctorId="doctor-123"
              patientId="patient-456"
              onEndCall={() => {
                setCurrentTab('home');
                setScreenMode('main');
              }}
            />
            <BackButton onPress={handleBack} />
          </View>
        ) : screenMode === 'reaction' ? (
          <View style={styles.screenWithBackButton}>
            <ReactionGameScreen
              onBack={handleBack}
              onComplete={handleReactionComplete}
            />
          </View>
        ) : screenMode === 'finalResults' && reactionResult ? (
          <FinalStressScoreScreen
            heartRate={heartRateBpm}
            reaction={reactionResult}
            onBack={handleBack}
            onDone={handleFinalResultsDone}
          />
        ) : (
          /* MAIN PATIENT PORTAL: SINGLE BLUE NAVIGATION BAR AT BOTTOM */
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              {currentTab === 'home' ? (
                <PatientDashboardScreen
                  activeTab={currentTab}
                  onNavigate={handleTabNavigate}
                  onStartVideoCall={() => setScreenMode('call')}
                  onRunSurvey={() => setCurrentTab('profile')}
                  onRunFaceScan={() => setCurrentTab('analysis')}
                  onRunDailyCheck={() => setCurrentTab('analysis')}
                />
              ) : currentTab === 'profile' ? (
                <PatientProfileScreen
                  onNavigateHome={() => setCurrentTab('home')}
                  onNavigateTab={handleTabNavigate}
                  onSignOut={() => setCurrentTab('home')}
                  onOpenHealthSetup={() => setScreenMode('healthSetup')}
                />
              ) : currentTab === 'analysis' ? (
                <HeartRateNavigator
                  onExit={() => setCurrentTab('profile')}
                  onNavigateTab={handleTabNavigate}
                  onModuleComplete={handleAnalysisComplete}
                />
              ) : (
                <View style={styles.subScreenWrap}>
                  <AppointmentBookingScreen
                    onNavigateTab={handleTabNavigate}
                    onStartVideoCall={() => setScreenMode('call')}
                  />
                </View>
              )}
            </View>

            {/* SINGLE AUTHORITATIVE BLUE NAVIGATION BAR */}
            <BottomTabBar
              activeTab={currentTab}
              onNavigate={handleTabNavigate}
            />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  mainWrapper: {
    flex: 1,
    backgroundColor: '#FAF8ED',
  },
  tabViewArea: {
    flex: 1,
  },
  subScreenWrap: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  screenWithBackButton: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8ED',
  },
  logoMark: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B9EF7',
    marginBottom: 14,
  },
  logoPulse: {
    width: 48,
    height: 22,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-12deg' }],
  },
  logoText: {
    color: '#5B9EF7',
    fontSize: 22,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 180,
    color: '#64748B',
    fontSize: 13,
  },
});

export default App;
