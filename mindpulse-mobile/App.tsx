import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingNavigator } from './src/screens/onboarding/OnboardingNavigator';
import { AuthScreen } from './src/screens/auth/AuthScreen';
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

type ScreenMode =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'healthSetup'
  | 'main'
  | 'reaction'
  | 'finalResults'
  | 'call';

/* ─────────── Splash Screen ─────────── */
const SplashScreen = () => {
  // Animate the loading dots
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const dot4 = useRef(new Animated.Value(0)).current;
  const dot5 = useRef(new Animated.Value(0)).current;
  const dot6 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(600),
        ]),
      );

    const dots = [dot1, dot2, dot3, dot4, dot5, dot6];
    const anims = dots.map((d, i) => animateDot(d, i * 120));
    anims.forEach(a => a.start());

    return () => anims.forEach(a => a.stop());
  }, [dot1, dot2, dot3, dot4, dot5, dot6]);

  const dotScale = (d: Animated.Value) =>
    d.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const dotOpacity = (d: Animated.Value) =>
    d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={splashStyles.container}>
      {/* Logo mark: head silhouette with pulse line */}
      <View style={splashStyles.logoMark}>
        {/* Head outline */}
        <View style={splashStyles.headOutline} />
        {/* Pulse line inside the head */}
        <View style={splashStyles.pulseWrap}>
          <View style={[splashStyles.pulseSeg, { height: 2 }]} />
          <View style={[splashStyles.pulseSeg, { height: 12, width: 2 }]} />
          <View style={[splashStyles.pulseSeg, { height: 2 }]} />
          <View style={[splashStyles.pulseSeg, { height: 20, width: 2 }]} />
          <View style={[splashStyles.pulseSeg, { height: 2 }]} />
          <View style={[splashStyles.pulseSeg, { height: 8, width: 2 }]} />
          <View style={[splashStyles.pulseSeg, { height: 2 }]} />
        </View>
      </View>

      <RNText style={splashStyles.brandName}>MindPulse</RNText>
      <RNText style={splashStyles.tagline}>Your personal stress companion</RNText>

      {/* Loading dots */}
      <View style={splashStyles.dotsRow}>
        {[dot1, dot2, dot3, dot4, dot5, dot6].map((d, i) => (
          <Animated.View
            key={i}
            style={[
              splashStyles.dot,
              {
                transform: [{ scale: dotScale(d) }],
                opacity: dotOpacity(d),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

/* ─────────── App ─────────── */
function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('splash');
  const [currentTab, setCurrentTab] = useState<BottomNavTab>('home');
  const [heartRateBpm, setHeartRateBpm] = useState(0);
  const [reactionResult, setReactionResult] = useState<ReactionResult | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [registeredUserName, setRegisteredUserName] = useState('John');

  /* Splash → Onboarding after 2 s */
  useEffect(() => {
    if (screenMode !== 'splash') return;
    const timer = setTimeout(() => setScreenMode('onboarding'), 2000);
    return () => clearTimeout(timer);
  }, [screenMode]);

  /* ── Navigation helpers ── */
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

  /* ── Auth success handler ── */
  const handleAuthSuccess = (isNewUser: boolean) => {
    if (isNewUser) {
      setScreenMode('healthSetup');
    } else {
      setCurrentTab('home');
      setScreenMode('main');
    }
  };

  /* ─────────── Render ─────────── */
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F3" />
      <View style={styles.root}>

        {/* ── SPLASH ── */}
        {screenMode === 'splash' && <SplashScreen />}

        {/* ── ONBOARDING SLIDES ── */}
        {screenMode === 'onboarding' && (
          <OnboardingNavigator
            onComplete={(tab) => {
              setAuthTab(tab ?? 'register');
              setScreenMode('auth');
            }}
            onSignIn={() => {
              setAuthTab('login');
              setScreenMode('auth');
            }}
          />
        )}

        {/* ── AUTH (Login / Register) ── */}
        {screenMode === 'auth' && (
          <AuthScreen
            initialTab={authTab}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {/* ── HEALTH SETUP (3-step wizard) ── */}
        {screenMode === 'healthSetup' && (
          <View style={styles.screenWithBackButton}>
            <HealthSetupScreen
              userName={registeredUserName}
              onContinue={() => {
                setCurrentTab('home');
                setScreenMode('main');
              }}
            />
          </View>
        )}

        {/* ── VIDEO CALL ── */}
        {screenMode === 'call' && (
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
        )}

        {/* ── REACTION GAME ── */}
        {screenMode === 'reaction' && (
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              <ReactionGameScreen
                onBack={handleBack}
                onComplete={handleReactionComplete}
              />
            </View>
            <BottomTabBar activeTab="analysis" onNavigate={handleTabNavigate} />
          </View>
        )}

        {/* ── FINAL RESULTS ── */}
        {screenMode === 'finalResults' && reactionResult && (
          <FinalStressScoreScreen
            heartRate={heartRateBpm}
            reaction={reactionResult}
            onBack={handleBack}
            onDone={handleFinalResultsDone}
          />
        )}

        {/* ── MAIN PATIENT PORTAL ── */}
        {screenMode === 'main' && (
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              {currentTab === 'home' && (
                <PatientDashboardScreen
                  activeTab={currentTab}
                  onNavigate={handleTabNavigate}
                  onStartVideoCall={() => setScreenMode('call')}
                  onRunSurvey={() => setCurrentTab('profile')}
                  onRunFaceScan={() => setCurrentTab('analysis')}
                  onRunDailyCheck={() => setCurrentTab('analysis')}
                />
              )}
              {currentTab === 'profile' && (
                <PatientProfileScreen
                  onNavigateHome={() => setCurrentTab('home')}
                  onNavigateTab={handleTabNavigate}
                  onSignOut={() => {
                    setAuthTab('login');
                    setScreenMode('auth');
                  }}
                  onOpenHealthSetup={() => setScreenMode('healthSetup')}
                />
              )}
              {currentTab === 'analysis' && (
                <HeartRateNavigator
                  onExit={() => setCurrentTab('profile')}
                  onNavigateTab={handleTabNavigate}
                  onModuleComplete={handleAnalysisComplete}
                />
              )}
              {currentTab !== 'home' &&
                currentTab !== 'profile' &&
                currentTab !== 'analysis' && (
                  <View style={styles.subScreenWrap}>
                    <AppointmentBookingScreen
                      onNavigateTab={handleTabNavigate}
                      onStartVideoCall={() => setScreenMode('call')}
                    />
                  </View>
                )}
            </View>
            <BottomTabBar activeTab={currentTab} onNavigate={handleTabNavigate} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

/* ─────────── App Styles ─────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F3' },
  mainWrapper: { flex: 1, backgroundColor: '#FAF8F3' },
  tabViewArea: { flex: 1 },
  subScreenWrap: { flex: 1, backgroundColor: Colors.pageBg },
  screenWithBackButton: { flex: 1 },
});

/* ─────────── Splash Styles ─────────── */
const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Logo mark */
  logoMark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#C87850',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  headOutline: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    borderColor: '#C87850',
    position: 'absolute',
    top: 20,
  },
  pulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    position: 'absolute',
    top: 52,
  },
  pulseSeg: {
    width: 4,
    backgroundColor: '#C87850',
    marginHorizontal: 1,
    borderRadius: 1,
  },

  brandName: {
    color: '#C87850',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  tagline: {
    color: '#9AA0A6',
    fontSize: 13,
    marginBottom: 80,
  },

  /* Loading dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    bottom: 110,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C87850',
  },
});

export default App;
