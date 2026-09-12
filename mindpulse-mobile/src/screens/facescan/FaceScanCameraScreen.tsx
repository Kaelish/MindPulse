/**
 * FaceScanCameraScreen
 *
 * Approach:
 *  - Web:    face-api.js loads natively via browser Canvas/Image APIs.
 *  - Native: Capture base64 JPEG → decode with jpeg-js (pure JS) →
 *            create Tensor3D → pass directly to @vladmandic/face-api.
 *            Uses @tensorflow/tfjs CPU backend — NO native modules needed.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/typography';

export type EmotionLabel =
  | 'happy' | 'sad' | 'neutral' | 'angry'
  | 'fearful' | 'disgusted' | 'surprised';

interface Props {
  onComplete: (expression: EmotionLabel, confidence: number) => void;
  onBack: () => void;
}

// CDN hosting vladmandic's model weights (compatible with @vladmandic/face-api)
const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Decode base64 string to Uint8Array without requiring Buffer polyfill. */
function base64ToUint8Array(b64: string): Uint8Array {
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/** Convert RGBA Uint8Array to RGB Uint8Array (strips alpha channel). */
function rgbaToRgb(rgba: Uint8Array, pixelCount: number): Uint8Array {
  const rgb = new Uint8Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    rgb[i * 3]     = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  return rgb;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const FaceScanCameraScreen: React.FC<Props> = ({ onComplete, onBack }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [modelReady, setModelReady] = useState(false);
  const [statusText, setStatusText] = useState('Initializing AI models…');
  const [timeLeft, setTimeLeft] = useState(5);
  const [isScanning, setIsScanning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const expressionsHistory = useRef<{ expression: string; score: number }[]>([]);
  const isProcessingFrame = useRef(false);
  const scanningRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Pulse animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isScanning) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isScanning]);

  // ── Model loading ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      let originalProduct: string | undefined;

      try {
        // @vladmandic/face-api and TF.js throw if they are not in a browser/node or if RN platform is missing.
        // We trick it into thinking it's a browser by mocking window, document, and navigator.product BEFORE import.
        if (Platform.OS !== 'web') {
          const g = globalThis as any;
          g.window = g.window || g;
          g.document = g.document || { createElement: () => ({}) };
          g.HTMLImageElement = g.HTMLImageElement || class {};
          g.HTMLVideoElement = g.HTMLVideoElement || class {};
          g.HTMLCanvasElement = g.HTMLCanvasElement || class {};
          g.ImageData = g.ImageData || class {};
          
          if (g.navigator && g.navigator.product === 'ReactNative') {
            originalProduct = g.navigator.product;
            Object.defineProperty(g.navigator, 'product', { value: 'Gecko', configurable: true });
          }
        }

        // Always initialise TF.js first
        const tf = await import('@tensorflow/tfjs');
        // On native, set CPU backend explicitly (no native GL needed)
        if (Platform.OS !== 'web') {
          // tfjs-backend-cpu ships as a transitive dep of @tensorflow/tfjs
          await import('@tensorflow/tfjs-backend-cpu');
          await tf.setBackend('cpu');
        }
        await tf.ready();

        setStatusText('Downloading face models (first run ~10 MB)…');

        // @vladmandic/face-api is TF.js 4.x compatible
        const faceapi = await import('@vladmandic/face-api');

        if (Platform.OS !== 'web' && faceapi.env && typeof faceapi.env.monkeyPatch === 'function') {
          faceapi.env.monkeyPatch({
            Canvas: class {} as any,
            Image: class {} as any,
            ImageData: class {} as any,
            Video: class {} as any,
            createCanvasElement: () => ({}),
            createImageElement: () => ({}),
          });
        }

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

        if (!cancelled) {
          setModelReady(true);
          setStatusText('Ready · Look at the camera and press Start');
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[FaceScan] Model load error:', err);
          setStatusText(`Error loading models: ${err.message}`);
        }
      } finally {
        if (originalProduct && Platform.OS !== 'web') {
          const g = globalThis as any;
          Object.defineProperty(g.navigator, 'product', { value: originalProduct, configurable: true });
        }
      }
    }

    loadModels();
    return () => { cancelled = true; };
  }, []);

  // ── Frame analysis ───────────────────────────────────────────────────────
  const analyzeFrame = useCallback(async () => {
    if (!cameraRef.current || isProcessingFrame.current || !scanningRef.current) return;
    isProcessingFrame.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.15, skipProcessing: true,
      });
      if (!photo?.base64 || !scanningRef.current) return;

      const faceapi = await import('@vladmandic/face-api');
      const tf = await import('@tensorflow/tfjs');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let detection: any;

      if (Platform.OS === 'web') {
        // Web: use browser Image element — no polyfills needed
        const img = new Image();
        img.src = `data:image/jpeg;base64,${photo.base64}`;
        await new Promise<void>(r => { img.onload = () => r(); });
        detection = await faceapi
          .detectSingleFace(img as any, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
      } else {
        // Native: decode JPEG → RGB tensor (CPU, no native modules)
        const jpegjs = await import('jpeg-js');
        const bytes = base64ToUint8Array(photo.base64);
        const { data, width, height } = jpegjs.decode(bytes, { useTArray: true });
        const rgb = rgbaToRgb(data as Uint8Array, width * height);
        const tensor = tf.tensor3d(rgb, [height, width, 3]);

        detection = await faceapi
          .detectSingleFace(tensor as any, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        tf.dispose(tensor);
      }

      if (detection) {
        const exprs = detection.expressions as unknown as Record<string, number>;
        const dominant = Object.keys(exprs).reduce((a, b) => exprs[a] > exprs[b] ? a : b);
        const score = exprs[dominant];
        expressionsHistory.current.push({ expression: dominant, score });
        setStatusText(`Detected: ${dominant.toUpperCase()} (${Math.round(score * 100)}%)`);
      } else {
        setStatusText('No face detected — please reposition.');
      }
    } catch (err) {
      console.warn('[FaceScan] Frame error:', err);
    } finally {
      isProcessingFrame.current = false;
    }
  }, []);

  // ── Finish & aggregate ───────────────────────────────────────────────────
  const finishScan = useCallback(() => {
    scanningRef.current = false;
    setIsScanning(false);

    const history = expressionsHistory.current;
    if (history.length === 0) { onComplete('neutral', 0.5); return; }

    const counts: Record<string, { count: number; total: number }> = {};
    history.forEach(({ expression, score }) => {
      if (!counts[expression]) counts[expression] = { count: 0, total: 0 };
      counts[expression].count++;
      counts[expression].total += score;
    });

    const dominant = Object.keys(counts).reduce((a, b) =>
      counts[a].count > counts[b].count ? a : b
    );
    const avgScore = counts[dominant].total / counts[dominant].count;
    onComplete(dominant as EmotionLabel, avgScore);
  }, [onComplete]);

  // ── Scan lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isScanning || !modelReady) return;
    expressionsHistory.current = [];
    scanningRef.current = true;

    const frameInterval = setInterval(analyzeFrame, 1500);
    let remaining = 5;
    const countdown = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(countdown);
        clearInterval(frameInterval);
        finishScan();
      }
    }, 1000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(countdown);
      scanningRef.current = false;
    };
  }, [isScanning, modelReady, analyzeFrame, finishScan]);

  // ── Permission / error states ────────────────────────────────────────────
  if (!permission) {
    return <View style={s.centred}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={s.centred}>
        <Text style={s.permText}>Camera access is needed to scan your face.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}>
          <Text style={s.linkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={s.centred}>
        <Text style={s.errorTitle}>⚠️ Model Load Failed</Text>
        <Text style={s.errorText}>{loadError}</Text>
        <TouchableOpacity style={s.btn} onPress={onBack}>
          <Text style={s.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* Floating header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.cancelWrap}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.title}>Face Scan</Text>
        <View style={s.cancelWrap} />
      </View>

      {/* Camera */}
      <View style={s.cameraWrap}>
        <CameraView style={StyleSheet.absoluteFill} facing="front" ref={cameraRef} />

        {/* dim overlay */}
        <View style={s.dimOverlay} pointerEvents="none" />

        {/* Oval guide frame */}
        <Animated.View
          style={[
            s.ovalFrame,
            isScanning && { borderColor: Colors.primary },
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      </View>

      {/* Bottom panel */}
      <View style={s.bottomPanel}>
        <Text style={s.statusText}>{statusText}</Text>

        {!modelReady && !loadError && (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 4 }} />
        )}

        {modelReady && !isScanning && (
          <TouchableOpacity
            style={s.startBtn}
            activeOpacity={0.85}
            onPress={() => { setTimeLeft(5); setIsScanning(true); }}>
            <Text style={s.startBtnText}>▶  Start 5-Second Analysis</Text>
          </TouchableOpacity>
        )}

        {isScanning && (
          <View style={s.countdownWrap}>
            <Text style={s.countdown}>{timeLeft}</Text>
            <Text style={s.countdownLabel}>seconds remaining · hold steady…</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1B3E' },

  centred: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, backgroundColor: Colors.pageBg, gap: Spacing.md,
  },
  permText: { fontSize: 15, color: Colors.textPrimary, textAlign: 'center', lineHeight: 22 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  errorText: { fontSize: 14, color: Colors.tagRedText, textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: Colors.btnPurple, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: 14,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12, paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(13,27,62,0.7)',
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  cancelWrap: { width: 64 },
  cancelText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#0D1B3E' },
  dimOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13,27,62,0.25)' },
  ovalFrame: {
    width: 240, height: 300, borderRadius: 120,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    zIndex: 5,
  },

  bottomPanel: {
    backgroundColor: Colors.pageBg, paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg, alignItems: 'center', minHeight: 180, gap: Spacing.sm,
  },
  statusText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  startBtn: {
    backgroundColor: Colors.btnPurple, borderRadius: Radius.lg,
    paddingVertical: 16, paddingHorizontal: 32, marginTop: 4,
    elevation: 6,
    ...Platform.select({
      web: { boxShadow: '0px 6px 20px rgba(158,133,249,0.45)' },
      default: {
        shadowColor: Colors.btnPurple, shadowOpacity: 0.45,
        shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  startBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  countdownWrap: { alignItems: 'center' },
  countdown: { fontSize: 52, fontWeight: '900', color: Colors.btnPurple, lineHeight: 60 },
  countdownLabel: { fontSize: 13, color: Colors.textSecondary },
});
