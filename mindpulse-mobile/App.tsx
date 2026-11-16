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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingNavigator } from './src/screens/onboarding/OnboardingNavigator';
import { AuthScreen } from './src/screens/auth/AuthScreen';
import { PortalNoticeScreen } from './src/screens/auth/PortalNoticeScreen';
import { HealthSetupScreen } from './src/screens/onboarding/HealthSetupScreen';
import { PatientDashboardScreen } from './src/screens/patient/PatientDashboardScreen';
import { PatientProfileScreen } from './src/screens/patient/PatientProfileScreen';
import { PlantProgressScreen } from './src/screens/patient/PlantProgressScreen';
import { DoctorDashboardScreen } from './src/screens/doctor/DoctorDashboardScreen';
import { DoctorConsultationsScreen, ConsultTabRequest } from './src/screens/doctor/DoctorConsultationsScreen';
import { DoctorProfileScreen } from './src/screens/doctor/DoctorProfileScreen';
import { AssessmentNavigator } from './src/screens/assessment/AssessmentNavigator';
import { AppointmentBookingScreen, ClinicTabRequest } from './src/screens/appointments/AppointmentBookingScreen';
import { VideoCallScreen } from './src/screens/calls/VideoCallScreen';
import { IncomingCallOverlay } from './src/components/IncomingCallOverlay';
import {
  IncomingCall,
  declineIncomingCall,
  fetchCallerDisplayName,
  getActiveIncomingCall,
  subscribeToIncomingCall,
} from './src/services/consultationLifecycle';
import { ReactionGameScreen, ReactionResult } from './src/screens/reaction/ReactionGameScreen';
import { FinalStressScoreScreen } from './src/screens/results/FinalStressScoreScreen';
import { BottomNavTab, BottomTabBar } from './src/components/navigation/BottomTabBar';
import { BackButton } from './src/components/navigation/BackButton';
import { saveNewStressSession } from './src/services/dashboard';
import { recordPlantSession } from './src/services/plantProgress';
import { AppRole, getCurrentUserRole, isAccountDeactivated, reactivateOwnAccount } from './src/services/session';
import { isRememberMeEnabled } from './src/services/rememberMe';
import { Colors } from './src/theme/colors';
import { supabase } from './src/supabase/client';
import { loadThemeMode, registerThemeStyles, tone, toneBg, useThemeMode } from './src/theme/theme';
import { loadLanguage } from './src/i18n/language';
import { warmEmotionService } from './src/services/emotionScan';

type ScreenMode =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'healthSetup'
  | 'main'
  | 'reaction'
  | 'finalResults'
  | 'call'
  | 'plantProgress';

/** Rejects if the promise has not settled in time (keeps the splash from hanging). */
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });

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

/**
 * Shown instead of any screen when profiles.is_deactivated is true (0042).
 * The account was never removed from auth.users, so signing in succeeded —
 * the person is asked whether to bring the account back before anything loads.
 */
const DeactivatedAccountView = ({
  onReactivate,
  onSignOut,
}: {
  onReactivate: () => Promise<void>;
  onSignOut: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await onReactivate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This account could not be reactivated.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={deactivatedStyles.root}>
      <View style={deactivatedStyles.center}>
        <View style={[deactivatedStyles.iconCircle, { backgroundColor: Colors.tagRedBg }]}>
          <Ionicons name="alert-circle-outline" size={38} color={Colors.tagRedText} />
        </View>
        <RNText style={deactivatedStyles.title}>Account deactivated</RNText>
        <RNText style={deactivatedStyles.body}>
          Your records are kept on file and are not visible while the account is deactivated.
        </RNText>
        <View style={deactivatedStyles.buttonRow}>
          <TouchableOpacity
            style={[deactivatedStyles.button, deactivatedStyles.buttonPrimary]}
            onPress={reactivate}
            disabled={busy}
          >
            <RNText style={deactivatedStyles.buttonText}>
              {busy ? 'Reactivating…' : 'Yes, reactivate this account'}
            </RNText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[deactivatedStyles.button, deactivatedStyles.buttonSecondary]}
            onPress={onSignOut}
            disabled={busy}
          >
            <RNText style={deactivatedStyles.buttonText}>No, sign out</RNText>
          </TouchableOpacity>
        </View>
        {error && <RNText style={deactivatedStyles.errorText}>{error}</RNText>}
      </View>
    </SafeAreaView>
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
  // Where Health Background was opened from, so its Back button returns there.
  const [healthSetupOrigin, setHealthSetupOrigin] = useState<'firstRun' | 'profile'>('firstRun');
  const [userRole, setUserRole] = useState<AppRole>(null);
  const [callDoctorId, setCallDoctorId] = useState<string | null>(null);
  const [callAppointmentId, setCallAppointmentId] = useState<string | null>(null);
  // One-shot sub-tab intents raised by tapping a chat notification.
  const [consultTabReq, setConsultTabReq] = useState<ConsultTabRequest | null>(null);
  const [clinicTabReq, setClinicTabReq] = useState<ClinicTabRequest | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [incomingCallName, setIncomingCallName] = useState('Your doctor');
  const [autoJoinCall, setAutoJoinCall] = useState(false);
  // Gate shown when a signed-in account is deactivated: reactivate or sign out.
  const [deactivatedAccount, setDeactivatedAccount] = useState(false);

  /* Theme: the saved mode is restored while the splash screen is up, and every
     later switch re-renders this tree against the rebuilt style sheets.
     Language: restored on the same pass, so the assessment screens open in the
     language the patient last picked instead of silently falling back to
     English on every launch. */
  const themeMode = useThemeMode();
  useEffect(() => {
    void loadThemeMode();
    void loadLanguage();
  }, []);

  /* Splash → Onboarding after 3 s. With "Remember me" opted in and a still
     valid session, the user is taken straight back into the app instead. */
  useEffect(() => {
    if (screenMode !== 'splash') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let hasSession = false;
      try {
        const rememberMe = await withTimeout(isRememberMeEnabled(), 3000);
        if (rememberMe) {
          // getSession() answers from local storage (refreshing only when the
          // token is near expiry), so a slow auth endpoint can't force the
          // user back through the login screen.
          const { data, error } = await withTimeout(supabase.auth.getSession(), 6000);
          hasSession = !error && !!data.session;
        }
      } catch (e) {
        console.warn('Remember-me session check failed', e);
      }
      if (cancelled) return;
      if (hasSession) {
        try {
          await withTimeout(handleAuthSuccess(false), 6000);
        } catch (e) {
          console.warn('Session restore failed', e);
          if (!cancelled) changeScreen('onboarding');
        }
        return;
      }
      changeScreen('onboarding');
    }, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Chat notification taps: open the Messages thread of the right portal */
  const openDoctorMessages = () => {
    setConsultTabReq((current) => ({ tab: 'messages', nonce: (current?.nonce ?? 0) + 1 }));
    handleTabNavigate('clinics');
  };

  const openPatientMessages = () => {
    setClinicTabReq((current) => ({ tab: 'messages', nonce: (current?.nonce ?? 0) + 1 }));
    handleTabNavigate('clinics');
  };

  // Dropped as soon as the Clinics tab is left, so returning to it later
  // starts on the default sub-tab instead of replaying the notification.
  useEffect(() => {
    if (currentTab !== 'clinics') {
      setConsultTabReq(null);
      setClinicTabReq(null);
    }
  }, [currentTab]);

  useEffect(() => {
    const isStudent =
      screenMode === 'main' &&
      userRole !== 'doctor' &&
      userRole !== 'admin' &&
      userRole !== 'pending';
    if (!isStudent) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const ring = async (call: IncomingCall) => {
      const name = await fetchCallerDisplayName(call.doctorId).catch(() => 'Your doctor');
      if (cancelled) return;
      setIncomingCallName(name);
      setIncomingCall(call);
    };

    const handleStatus = (call: IncomingCall, status: string) => {
      if (cancelled) return;
      if (status === 'active') {
        void ring(call);
        return;
      }
      if (status === 'ended' || status === 'pending') {
        setIncomingCall((current) =>
          current && current.sessionId === call.sessionId ? null : current,
        );
      }
    };

    void (async () => {
      const missed = await getActiveIncomingCall();
      if (missed && !cancelled) await ring(missed);
      if (cancelled) return;
      unsubscribe = await subscribeToIncomingCall(handleStatus).catch(() => null);
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      setIncomingCall(null);
    };
  }, [screenMode, userRole]);

  const answerIncomingCall = () => {
    if (!incomingCall) return;
    setCallDoctorId(null);
    setCallAppointmentId(incomingCall.appointmentId);
    setAutoJoinCall(true);
    setIncomingCall(null);
    changeScreen('call');
  };

  const declineIncoming = () => {
    const call = incomingCall;
    setIncomingCall(null);
    if (call) void declineIncomingCall(call);
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
      setAutoJoinCall(false);
      changeScreen('main');
      setCurrentTab(userRole === 'doctor' ? 'clinics' : 'home');
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
        undefined,
        reactionResult.average,
        undefined,
        undefined,
        undefined,
        'daily',
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
    // Warm the face-analysis service in the background. Login and onboarding
    // stay responsive even when Render needs to wake and load the ML model.
    void warmEmotionService();

    let userId: string | undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
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

    // Role decides the portal: doctor → doctor shell, admin → web notice,
    // pending → approval gate, everything else → the student app.
    const role = await getCurrentUserRole();
    setUserRole(role);

    // A deactivated account must be offered reactivation before entering
    // any portal. This also covers session restoration on app launch.
    const deactivated = await isAccountDeactivated();
    if (deactivated) {
      setDeactivatedAccount(true);
      return;
    }

    if (role === 'doctor') {
      setCurrentTab('home');
      changeScreen('main');
      return;
    }
    if (role === 'admin' || role === 'pending') {
      changeScreen('main');
      return;
    }

    // Students fill the health background exactly once: immediately after
    // their first successful sign-in (register → e-mail confirmation → login).
    // Health Setup sets profiles.onboarding_complete, so every later sign-in
    // lands straight on the dashboard.
    let needsHealthSetup = isNewUser;
    if (!needsHealthSetup) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', userId ?? '')
          .maybeSingle();
        if (!error) {
          needsHealthSetup = profile ? profile.onboarding_complete !== true : true;
        }
      } catch (e) {
        // Never block sign-in because the flag could not be read.
        console.warn('Failed to read onboarding flag', e);
      }
    }

    if (needsHealthSetup) {
      setHealthSetupOrigin('firstRun');
      changeScreen('healthSetup');
    } else {
      setCurrentTab('home');
      changeScreen('main');
    }
  };

  /* ── Sign out from role-gated screens (doctor profile / portal notice) ── */
  const handlePortalSignOut = () => {
    setUserRole(null);
    setAuthTab('login');
    changeScreen('auth');
  };

  /* ── Deactivated account gate handlers ── */
  const handleDeactivatedReactivate = async () => {
    try {
      await reactivateOwnAccount();
      setDeactivatedAccount(false);
      // Re-enter the app now that the account is active again.
      await handleAuthSuccess(false);
    } catch {
      // Error is shown inside DeactivatedAccountView by reactivateOwnAccount's caller
    }
  };

  const handleDeactivatedSignOut = () => {
    setDeactivatedAccount(false);
    setUserRole(null);
    setAuthTab('login');
    changeScreen('auth');
  };

  /* ─────────── Render ─────────── */
  return (
    <SafeAreaProvider>
      {/* RN 0.88's StatusBar reads only barStyle/hidden/animated — its
          implementation never consults backgroundColor (Android is
          edge-to-edge), so the prop that used to sit here was a no-op. */}
      <StatusBar barStyle="light-content" />
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
              onBack={() => {
                if (healthSetupOrigin === 'profile') {
                  changeScreen('main');
                  setCurrentTab('profile');
                  return;
                }
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
              role={userRole === 'doctor' ? 'doctor' : 'patient'}
              autoJoin={autoJoinCall}
              onEndCall={() => {
                // Doctors return to whichever doctor tab they left; patients go home.
                setAutoJoinCall(false);
                if (userRole !== 'doctor') setCurrentTab('home');
                changeScreen('main');
              }}
              onNavigateTab={handleTabNavigate}
            />
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
            onNavigateTab={handleTabNavigate}
          />
        )}

        {/* ── MIND PLANT PROGRESS ── */}
        {screenMode === 'plantProgress' && (
          <PlantProgressScreen onBack={handleBack} />
        )}

        {/* ── MAIN DOCTOR PORTAL ── */}
        {screenMode === 'main' && userRole === 'doctor' && (
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              {currentTab === 'profile' && <DoctorProfileScreen onSignOut={handlePortalSignOut} onOpenMessages={openDoctorMessages} />}
              {currentTab === 'clinics' && (
                <DoctorConsultationsScreen
                  openTabRequest={consultTabReq}
                />
              )}
              {currentTab !== 'profile' && currentTab !== 'clinics' && (
                <DoctorDashboardScreen
                  onNavigate={handleTabNavigate}
                  onOpenMessages={openDoctorMessages}
                />
              )}
            </View>
            <BottomTabBar
              variant="doctor"
              activeTab={currentTab === 'analysis' ? 'home' : currentTab}
              onNavigate={handleTabNavigate}
            />
          </View>
        )}

        {/* ── ADMIN / PENDING GATE ── */}
        {screenMode === 'main' && (userRole === 'admin' || userRole === 'pending') && (
          <PortalNoticeScreen kind={userRole === 'admin' ? 'admin' : 'pending'} onSignOut={handlePortalSignOut} />
        )}

        {/* ── MAIN STUDENT PORTAL ── */}
        {screenMode === 'main' &&
          userRole !== 'doctor' &&
          userRole !== 'admin' &&
          userRole !== 'pending' && (
          <View style={styles.mainWrapper}>
            <View style={styles.tabViewArea}>
              {currentTab === 'home' && (
                <PatientDashboardScreen
                  activeTab={currentTab}
                  onNavigate={handleTabNavigate}
                  onOpenMessages={openPatientMessages}
                  onStartVideoCall={(doctorId) => {
                        setCallDoctorId(doctorId ?? null);
                        setCallAppointmentId(null);
                        changeScreen('call');
                      }}
                  onRunSurvey={() => setCurrentTab('profile')}
                  onRunDailyCheck={() => setCurrentTab('analysis')}
                />
              )}
              {currentTab === 'profile' && (
                <PatientProfileScreen
                  onNavigateHome={() => setCurrentTab('home')}
                  onNavigateTab={handleTabNavigate}
                  onSignOut={() => {
                    setUserRole(null);
                    setAuthTab('login');
                    changeScreen('auth');
                  }}
                  onOpenHealthSetup={() => {
                    setHealthSetupOrigin('profile');
                    changeScreen('healthSetup');
                  }}
                  onOpenPlantProgress={() => changeScreen('plantProgress')}
                />
              )}
              {currentTab === 'analysis' && (
                <AssessmentNavigator
                  onExit={() => setCurrentTab('profile')}
                  onBookSession={() => setCurrentTab('clinics')}
                />
              )}
              {currentTab !== 'home' &&
                currentTab !== 'profile' &&
                currentTab !== 'analysis' && (
                  <View style={styles.subScreenWrap}>
                    <AppointmentBookingScreen
                      onNavigateTab={handleTabNavigate}
                      openTabRequest={clinicTabReq}
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

        {/* Deactivated account gate — overlays everything when set. */}
        {deactivatedAccount && (
          <DeactivatedAccountView
            onReactivate={handleDeactivatedReactivate}
            onSignOut={handleDeactivatedSignOut}
          />
        )}
        </Animated.View>

        <IncomingCallOverlay
          visible={!!incomingCall}
          doctorName={incomingCallName}
          onJoin={answerIncomingCall}
          onDecline={declineIncoming}
        />
      </View>
    </SafeAreaProvider>
  );
}

/* ─────────── App Styles ─────────── */
const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  mainWrapper: { flex: 1, backgroundColor: Colors.pageBg },
  tabViewArea: { flex: 1 },
  subScreenWrap: { flex: 1, backgroundColor: Colors.pageBg },
  screenWithBackButton: { flex: 1 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });

/* ─────────── Deactivated styles ─────────── */
const makeDeactivatedStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 21, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 8 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#1A2340',
    borderRadius: 10,
    paddingVertical: 14,
  },
  buttonPrimary: { backgroundColor: Colors.primary },
  buttonSecondary: { backgroundColor: toneBg('#E2E8F0') },
  buttonText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  errorText: { color: Colors.tagRedText, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

const deactivatedStyles = makeDeactivatedStyles();

/* ─────────── Splash Styles ─────────── */
const makeSplashStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: toneBg('#F7F4EE'),
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
    color: tone('#C4907A'),
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    color: tone('#A89C96'),
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
    backgroundColor: toneBg('#C4907A'),
    position: 'absolute',
  },
});

let splashStyles = makeSplashStyles();
registerThemeStyles(() => { splashStyles = makeSplashStyles(); });

export default App;
