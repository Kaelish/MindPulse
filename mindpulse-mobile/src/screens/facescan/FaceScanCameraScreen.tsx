import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../../theme/colors';
import { Spacing, Radius } from '../../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { registerThemeStyles, tone, toneBg } from '../../theme/theme';
import { analyzeFaceImage } from '../../services/emotionScan';
import { useTranslation } from '../../i18n/language';

interface Props {
  onComplete: (expression: string, confidence: number) => void;
  onBack: () => void;
}

export const FaceScanCameraScreen: React.FC<Props> = ({ onComplete, onBack }) => {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scanning laser animates only while the backend is analysing the frame.
  const laser = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isAnalyzing) {
      laser.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laser, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(laser, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isAnalyzing, laser]);

  const laserTop = laser.interpolate({ inputRange: [0, 1], outputRange: ['12%', '85%'] });

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || isAnalyzing) return;

    setIsCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (!photo?.base64) {
        throw new Error(t.faceScan.camera.errorRead);
      }

      setIsAnalyzing(true);
      const result = await analyzeFaceImage(`data:image/jpeg;base64,${photo.base64}`);
      onComplete(result.expression, result.confidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.faceScan.camera.errorFailed);
    } finally {
      setIsCapturing(false);
      setIsAnalyzing(false);
    }
  }, [isCapturing, isAnalyzing, onComplete, t]);

  const busy = isCapturing || isAnalyzing;

  const renderCameraBody = () => {
    if (!permission) {
      return (
        <View style={styles.centerFill}>
          <ActivityIndicator color={tone('#9B90FF')} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.permissionWrap}>
          <Ionicons name="camera-outline" size={40} color={tone('#FFF')} />
          <Text style={styles.permissionTitle}>{t.faceScan.camera.permissionTitle}</Text>
          <Text style={styles.permissionText}>
            {t.faceScan.camera.permissionText}
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Allow camera access">
              <Text style={styles.permissionBtnText}>{t.faceScan.camera.permissionBtn}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.permissionHint}>
              {t.faceScan.camera.permissionHint}
            </Text>
          )}
        </View>
      );
    }

    return (
      <>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Grid overlay */}
        <View style={styles.gridOverlay} pointerEvents="none">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={`v-${i}`} style={[styles.gridLine, { left: `${(i + 1) * 16.6}%` }]} />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={`h-${i}`} style={[styles.gridLineHorizontal, { top: `${(i + 1) * 16.6}%` }]} />
          ))}
        </View>

        {/* Badges */}
        <View style={styles.badgesRow} pointerEvents="none">
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{isAnalyzing ? t.faceScan.camera.analyzing : t.faceScan.camera.live}</Text>
          </View>
          <View style={styles.aiBadge}>
            <Ionicons name="flash" size={12} color={tone('#FFF')} />
            <Text style={styles.aiText}>AI</Text>
          </View>
        </View>

        {/* Framing guides */}
        <View style={styles.scanGraphicWrap} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Scanning laser (while analysing) */}
        {isAnalyzing && (
          <Animated.View style={[styles.laserLine, { top: laserTop }]} pointerEvents="none" />
        )}

        {busy && (
          <View style={styles.busyOverlay} pointerEvents="none">
            <ActivityIndicator color={tone('#FFF')} />
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Back to face scan instructions">
          <Ionicons name="chevron-back" size={22} color={tone('#6B79F2')} />
          <Text style={styles.backText}>{t.common.back}</Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t.faceScan.pageTitle}</Text>
        <Text style={styles.pageSubtitle}>{t.faceScan.camera.subtitle}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.cameraContainer}>{renderCameraBody()}</View>

        {/* Status card */}
        <View style={styles.processingCard}>
          <MaterialCommunityIcons
            name={isAnalyzing ? 'line-scan' : 'camera-outline'}
            size={24}
            color={tone('#6B79F2')}
          />
          <View style={styles.processingTextWrap}>
            <Text style={styles.processingTitle}>
              {isAnalyzing ? t.faceScan.camera.analyzingTitle : t.faceScan.camera.readyTitle}
            </Text>
            <Text style={styles.processingSub}>
              {isAnalyzing ? t.faceScan.camera.analyzingSub : t.faceScan.camera.readySub}
            </Text>
          </View>
        </View>

        {/* Shutter */}
        <TouchableOpacity
          style={[styles.shutter, busy && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={busy || !permission?.granted}
          accessibilityRole="button"
          accessibilityLabel="Capture and analyze face"
          accessibilityState={{ disabled: busy || !permission?.granted }}>
          <Ionicons name="scan" size={26} color={tone('#FFF')} />
          <Text style={styles.shutterText}>{isAnalyzing ? t.faceScan.camera.shutterBusy : t.faceScan.camera.shutter}</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
};

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: toneBg('#FCFBF8') },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 6, flexDirection: 'row' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: tone('#6B79F2'), fontSize: 16, fontWeight: '600', marginLeft: 2 },
  pageHeader: { alignItems: 'center', marginTop: 32, marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  pageSubtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },

  content: { flex: 1, paddingHorizontal: Spacing.lg, alignItems: 'center' },
  cameraContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: toneBg('#11132B'),
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: toneBg('#6B79F2') },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: toneBg('#6B79F2') },

  badgesRow: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 16, zIndex: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#E08A00'), paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: toneBg('#FFF'), marginRight: 4 },
  liveText: { color: tone('#FFF'), fontSize: 11, fontWeight: '800' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: toneBg('#9B90FF'), paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  aiText: { color: tone('#FFF'), fontSize: 11, fontWeight: '800', marginLeft: 4 },

  scanGraphicWrap: {
    position: 'absolute',
    top: '20%', bottom: '20%', left: '25%', right: '25%',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: toneBg('#00E676'), borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  laserLine: {
    position: 'absolute',
    left: -20, right: -20,
    height: 2,
    backgroundColor: toneBg('#FF3B30'),
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    zIndex: 10,
  },

  busyOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 20,
    zIndex: 20,
  },

  permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  permissionTitle: { color: tone('#FFF'), fontSize: 18, fontWeight: '800', marginTop: 12 },
  permissionText: { color: tone('#C9CCE6'), fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  permissionHint: { color: tone('#C9CCE6'), fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  permissionBtn: { backgroundColor: toneBg('#9B90FF'), paddingHorizontal: 24, height: 46, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  permissionBtnText: { color: tone('#FFF'), fontWeight: '800', fontSize: 15 },

  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: toneBg('#EAEBFF'),
    borderRadius: Radius.lg,
    padding: Spacing.md,
    width: '100%',
    marginBottom: 24,
  },
  processingTextWrap: { marginLeft: 12, flex: 1 },
  processingTitle: { color: tone('#2C3473'), fontSize: 15, fontWeight: '700' },
  processingSub: { color: tone('#7E84B8'), fontSize: 13, marginTop: 2 },

  shutter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 32,
    borderRadius: Radius.full,
    backgroundColor: toneBg('#9B90FF'),
  },
  shutterDisabled: { opacity: 0.5 },
  shutterText: { color: tone('#FFF'), fontWeight: '800', fontSize: 16 },

  errorText: { color: tone('#D62E2E'), fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 16 },
});

let styles = makeStyles();
registerThemeStyles(() => { styles = makeStyles(); });
