import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
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
import { PlantProgressScreen } from './src/screens/patient/PlantProgressScreen';
import { AssessmentNavigator } from './src/screens/assessment/AssessmentNavigator';
import { AppointmentBookingScreen } from './src/screens/appointments/AppointmentBookingScreen';
import { VideoCallScreen } from './src/screens/calls/VideoCallScreen';
import { ReactionGameScreen, ReactionResult } from './src/screens/reaction/ReactionGameScreen';
import { FinalStressScoreScreen } from './src/screens/results/FinalStressScoreScreen';
import { FaceScanNavigator } from './src/screens/facescan/FaceScanNavigator';
import { BottomNavTab, BottomTabBar } from './src/components/navigation/BottomTabBar';
import { BackButton } from './src/components/navigation/BackButton';
import { saveNewStressSession } from './src/services/dashboard';
import { recordPlantSession } from './src/services/plantProgress';
import { Colors } from './src/theme/colors';
import { supabase } from './src/supabase/client';

type ScreenMode =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'healthSetup'
  | 'main'
  | 'faceScan'
  | 'reaction'
  | 'finalResults'
  | 'call'
  | 'plantProgress';

/* ─────────── Splash Screen ─────────── */
const SplashScreen = () => {
  const dotCount = 8;
  const dots = useRef(Array.from({ length: dotCount }, () => new Animated.Value(0))).current;

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

    const anims = dots.map((d, i) => animateDot(d, i * 120));
    anims.forEach(a => a.start());

    return () => anims.forEach(a => a.stop());
  }, [dots]);

  const dotScale = (d: Animated.Value) =>
    d.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] });
  const dotOpacity = (d: Animated.Value) =>
    d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <View style={splashStyles.container}>
      <Image 
        source={require('./assets/images/logo.png')} 
        style={splashStyles.logoImage}
        resizeMode="contain"
      />

      <RNText style={splashStyles.brandName}>MindPulse</RNText>
      <RNText style={splashStyles.tagline}>Your personal stress companion</RNText>

      <View style={splashStyles.loaderContainer}>
        {dots.map((d, i) => {
          const angle = (i * 360) / dotCount;
          return (
            <Animated.View
              key={i}
              style={[
                splashStyles.dot,
                {
                  transform: [
                    { rotate: `${angle}deg` },
                    { translateY: -22 },
                    { scale: dotScale(d) }
                  ],
                  opacity: dotOpacity(d),
                },
              ]}
            />
          );
        })}
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
  const [registeredUserName, setRegisteredUserName] = useState('friend');
  const [callDoctorId, setCallDoctorId] = useState<string | null>(null);
  const [callAppointmentId, setCallAppointmentId] = useState<string | null>(null);

  /* Splash → Onboarding after 3 s */
  useEffect(() => {
    if (screenMode !== 'splash') return;
    const timer = setTimeout(() => changeScreen('onboarding'), 3000);
    return () => clearTimeout(timer);
  }, [screenMode]);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const changeScreen = (nextMode: ScreenMode, callback?: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setScreenMode(nextMode);
      callback?.();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  };

  /* ── Navigation helpers ── */
  const handleTabNavigate = (tab: BottomNavTab) => {
    setCurrentTab(tab);
    changeScreen('main');
  };

  const handleBack = () => {
    if (screenMode === 'healthSetup') {
      changeScreen('main');
      setCurrentTab('profile');
      return;
    }
    if (screenMode === 'plantProgress') {
      changeScreen('main');
      setCurrentTab('profile');
      return;
    }
    if (screenMode === 'call') {
      changeScreen('main');
      setCurrentTab('home');
      return;
    }
    if (screenMode === 'faceScan') {
      changeScreen('main');
      setCurrentTab('analysis');
      return;
    }
    if (screenMode === 'reaction') {
      changeScreen('main');
      setCurrentTab('analysis');
      return;
    }
    if (screenMode === 'finalResults') {
      changeScreen('reaction');
      return;
    }
    if (screenMode === 'main' && currentTab !== 'home') {
      setCurrentTab('home');
    }
  };

  const handleReactionComplete = async (result: ReactionResult) => {
    setReactionResult(result);
    changeScreen('finalResults');
  };

  const handleAnalysisComplete = (bpm: number) => {
    setHeartRateBpm(bpm);
    changeScreen('reaction');
  };

  const handleFinalResultsDone = async (displayedScore?: number) => {
    if (!reactionResult || displayedScore == null) return;
    // Save exactly the score the user saw on the results screen (0-100, higher = more stress)
    const score = Math.min(100, Math.max(0, Math.round(displayedScore)));
    try {
      await saveNewStressSession(
        score,
        `Completed reaction time assessment (${reactionResult.average} ms average)`,
        heartRateBpm,
      );
    } catch (e: any) {
      Alert.alert(
        'Result not saved',
        e?.message || 'Please check your connection and try again.',
      );
      return;
    }
    // Grow the MindPlant — a completed session counts toward growth
    await recordPlantSession().catch(() => {});
    setCurrentTab('profile');
    changeScreen('main');
  };

  /* ── Auth success handler ── */
  const handleAuthSuccess = async (isNewUser: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.first_name) {
        setRegisteredUserName(user.user_metadata.first_name);
      } else {
        // Try profiles table if not in metadata
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user?.id)
          .single();
        if (profile?.first_name) {
          setRegisteredUserName(profile.first_name);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch user name', e);
    }

    if (isNewUser) {
      changeScreen('healthSetup');
    } else {
      setCurrentTab('home');
      changeScreen('main');
    }
  };

  /* ─────────── Render ─────────── */
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#3D6FC7" />
      <View style={styles.root}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* ── SPLASH ── */}
        {screenMode === 'splash' && <SplashScreen />}

        {/* ── ONBOARDING SLIDES ── */}
        {screenMode === 'onboarding' && (
          <OnboardingNavigator
            onComplete={(tab) => {
              setAuthTab(tab ?? 'register');
              changeScreen('auth');
            }}
            onSignIn={() => {
              setAuthTab('login');
              changeScreen('auth');
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
                changeScreen('main');
              }}
            />
          </View>
        )}

        {screenMode === 'call' && (
          <View style={styles.screenWithBackButton}>
            <VideoCallScreen
              doctorId={callDoctorId ?? undefined}
              appointmentId={callAppointmentId ?? undefined}
              onEndCall={() => {
                setCurrentTab('home');
                changeScreen('main');
              }}
              onNavigateTab={handleTabNavigate}
            />
          </View>
        )}

        {/* ── FACE SCAN ── */}
        {screenMode === 'faceScan' && (
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              <FaceScanNavigator
                onBack={handleBack}
                onFinishScan={() => {
                  // Demo scan result is not persisted anywhere
                  changeScreen('main');
                  setCurrentTab('analysis');
                }}
              />
            </View>
            <BottomTabBar activeTab="analysis" onNavigate={handleTabNavigate} />
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

        {/* ── MIND PLANT PROGRESS ── */}
        {screenMode === 'plantProgress' && (
          <PlantProgressScreen onBack={handleBack} />
        )}

        {/* ── MAIN PATIENT PORTAL ── */}
        {screenMode === 'main' && (
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              {currentTab === 'home' && (
                <PatientDashboardScreen
                  activeTab={currentTab}
                  onNavigate={handleTabNavigate}
                  onStartVideoCall={(doctorId) => {
                        setCallDoctorId(doctorId ?? null);
                        changeScreen('call');
                      }}
                  onRunSurvey={() => setCurrentTab('profile')}
                  onRunFaceScan={() => changeScreen('faceScan')}
                  onRunDailyCheck={() => setCurrentTab('analysis')}
                />
              )}
              {currentTab === 'profile' && (
                <PatientProfileScreen
                  onNavigateHome={() => setCurrentTab('home')}
                  onNavigateTab={handleTabNavigate}
                  onSignOut={() => {
                    setAuthTab('login');
                    changeScreen('auth');
                  }}
                  onOpenHealthSetup={() => changeScreen('healthSetup')}
                  onOpenPlantProgress={() => changeScreen('plantProgress')}
                />
              )}
              {currentTab === 'analysis' && (
                <AssessmentNavigator
                  onExit={() => setCurrentTab('profile')}
                />
              )}
              {currentTab !== 'home' &&
                currentTab !== 'profile' &&
                currentTab !== 'analysis' && (
                  <View style={styles.subScreenWrap}>
                    <AppointmentBookingScreen
                      onNavigateTab={handleTabNavigate}
                      onStartVideoCall={(doctorId, appointmentId) => {
                        setCallDoctorId(doctorId ?? null);
                        setCallAppointmentId(appointmentId ?? null);
                        changeScreen('call');
                      }}
                    />
                  </View>
                )}
            </View>
            <BottomTabBar activeTab={currentTab} onNavigate={handleTabNavigate} />
          </View>
        )}
        </Animated.View>
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
    backgroundColor: '#F7F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Logo image */
  logoImage: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },

  brandName: {
    color: '#C4907A',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    color: '#A89C96',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  /* Circular loading spinner */
  loaderContainer: {
    width: 64,
    height: 64,
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#C4907A',
    position: 'absolute',
  },
});

export default App;
