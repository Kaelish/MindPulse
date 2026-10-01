import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { registerThemeStyles, tone, toneBg } from '../theme/theme';

interface InAppVideoCallProps {
  visible: boolean;
  /** Full https URL of the Jitsi room (deterministic per appointment). */
  url: string;
  /** Counterpart display name for the header. */
  title: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * Ask for the OS camera/mic permissions BEFORE the room loads (call this
 * before mounting the WebView — iOS WebView breaks if permission is granted
 * after it exists, react-native-webview #2131). On iOS there is no JS API
 * anymore (RN 0.86 removed PermissionIOS); WKWebView raises the system
 * sheet itself using Expo Go's usage strings, so nothing to do there.
 * Failures never block the call.
 */
export const ensureMediaPermissions = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
  } catch {
    // Ignore — the WebView handles the permission request on its own.
  }
};

/**
 * Full-screen in-app video call. Renders the appointment's Jitsi room inside
 * the app with react-native-webview (included in Expo Go), so patients and
 * doctors never bounce out to the phone's browser. A browser fallback stays
 * available from the header if the embedded view ever misbehaves.
 */
export const InAppVideoCall: React.FC<InAppVideoCallProps> = ({
  visible,
  url,
  title,
  subtitle,
  onClose,
}) => {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
  }, [visible, url]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const openInBrowser = useCallback(async () => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open the browser', 'No app on this device can open this link.');
    }
  }, [url]);

  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    const lower = req.url.toLowerCase();
    return lower.startsWith('https://') || lower.startsWith('about:blank');
  }, []);

  const onLoadEnd = () => setLoading(false);

  const onError = () => {
    setLoading(false);
    setError('The video room could not load. Check your connection, then try again.');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {subtitle ? `${subtitle} · ` : ''}Live video session
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void openInBrowser()}
            accessibilityLabel="Open in browser"
          >
            <Ionicons name="open-outline" size={17} color={tone('#5B6EF5')} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveBtn} onPress={onClose} accessibilityLabel="Leave call">
            <Ionicons name="close" size={16} color={tone('#FFF')} />
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webWrap}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={34} color={tone('#E08A00')} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setError(null);
                  setLoading(true);
                  webRef.current?.reload();
                }}
              >
                <Ionicons name="refresh" size={15} color={tone('#FFF')} />
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fallbackBtn} onPress={() => void openInBrowser()}>
                <Text style={styles.fallbackText}>Open in browser instead</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              ref={webRef}
              source={{ uri: url }}
              style={styles.web}
              originWhitelist={['https://*', 'about://*']}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
              allowsFullscreenVideo
              allowsLinkPreview={false}
              pullToRefreshEnabled={false}
              setSupportMultipleWindows={false}
              onLoadEnd={onLoadEnd}
              onError={onError}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            />
          )}

          {loading && !error && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={tone('#5B6EF5')} />
              <Text style={styles.loadingText}>Connecting to the room…</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: toneBg('#0F172A') },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: toneBg('#16233B'),
    },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 15, fontWeight: '800', color: tone('#FFFFFF') },
    headerSub: { fontSize: 11.5, color: tone('#93A4C3'), marginTop: 1 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: toneBg('#FFFFFF'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: toneBg('#EF4444'),
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 13,
    },
    leaveText: { fontSize: 13, fontWeight: '800', color: tone('#FFF') },
    webWrap: { flex: 1, backgroundColor: '#000000' },
    web: { flex: 1, backgroundColor: 'transparent' },
    loadingOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: toneBg('#0F172A'),
    },
    loadingText: { fontSize: 13, color: tone('#93A4C3'), fontWeight: '600' },
    errorBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 30,
    },
    errorText: {
      fontSize: 13.5,
      color: tone('#E5E7EB'),
      textAlign: 'center',
      lineHeight: 20,
      fontWeight: '600',
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: toneBg('#5B6EF5'),
      borderRadius: 13,
      paddingVertical: 12,
      paddingHorizontal: 26,
    },
    retryText: { fontSize: 14, fontWeight: '800', color: tone('#FFF') },
    fallbackBtn: { paddingVertical: 8 },
    fallbackText: { fontSize: 13, fontWeight: '700', color: tone('#93A4C3'), textDecorationLine: 'underline' },
  });

let styles = makeStyles();
registerThemeStyles(() => {
  styles = makeStyles();
});
