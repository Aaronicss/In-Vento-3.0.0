import { Colors } from '@/constants/theme';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 🔥 Roboflow API URL (Detection or Classification)
const MODEL_NAME = "in-vento-xuxyq"; // example: "food-items"
const MODEL_VERSION = "3";
const API_KEY = "F02xuve8P2KEBhMSFZph";

const ROBOFLOW_URL = `https://detect.roboflow.com/${MODEL_NAME}/${MODEL_VERSION}?api_key=${API_KEY}`;

// Normalize detection labels to match inventory naming.
// Maps lowercase or variant labels to the canonical inventory name.
function normalizeDetectedLabel(raw?: string) {
  if (!raw) return '';
  const s = raw.trim().toLowerCase();
  if (s === 'bun') return 'BURGER BUN';
  if (s === 'patty') return 'BEEF';
  // keep existing labels uppercase for consistency with inventory names
  return raw.toUpperCase();
}

// Bulk detection mapping: when a bulk label is detected, we should set the
// canonical item to the specified quantity and ignore individual detections
// for that item.
const BULK_MAP: Record<string, { label: string; count: number }> = {
  'bulk_bun': { label: 'BURGER BUN', count: 8 },
  'bulk_cheese': { label: 'CHEESE', count: 84 },
  'bulk_lettuce': { label: 'LETTUCE', count: 600 },
  'bulk_onion': { label: 'ONION', count: 7 },
  'bulk_patty': { label: 'BEEF', count: 6 },
  'bulk_tomato': { label: 'TOMATO', count: 6 },
};

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const autoCaptureTimer = useRef<number | null>(null);
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({});
  const [autoCaptureActive, setAutoCaptureActive] = useState<boolean>(true);
  const CAPTURE_INTERVAL = 6; // seconds
  const [countdown, setCountdown] = useState<number>(CAPTURE_INTERVAL);
  const countdownTimer = useRef<number | null>(null);
  const loadingRef = useRef<boolean>(false);
  // draggable overlay pan
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 }));
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        try {
          (pan.current as any).setOffset({ x: (pan.current as any).x._value || 0, y: (pan.current as any).y._value || 0 });
        } catch (e) {
          // ignore if internals not available
        }
        (pan.current as any).setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: (pan.current as any).x, dy: (pan.current as any).y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        try { (pan.current as any).flattenOffset(); } catch (e) { /* ignore */ }
      },
    })
  ).current;

  // define takePicture with useCallback so hooks order stays stable
  const takePicture = useCallback(async (opts?: { navigate?: boolean; manual?: boolean }) => {
    if (!cameraRef.current) return;
    // allow manual captures to run even if auto-capture is paused
    if (!opts?.navigate && !opts?.manual && !autoCaptureActive) return;

    setLoading(true);

    try {
      // 1️⃣ Capture image
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo?.uri) throw new Error('Failed to capture image');

      // 2️⃣ Prepare form data for Roboflow
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      // 3️⃣ Call Roboflow
      const response = await fetch(ROBOFLOW_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Roboflow API Error: ${response.statusText}`);

      const result = await response.json();

      // 4️⃣ Process predictions safely and compute per-capture summary
      const captureSummary: Record<string, number> = {};
      let topPred: any = null;

      if (Array.isArray(result.predictions)) {
        result.predictions.forEach((pred: any) => {
          const raw = pred.class;
          const key = raw ? String(raw).trim().toLowerCase() : '';

          // check for bulk mappings first
          if (key && BULK_MAP[key]) {
            const { label, count } = BULK_MAP[key];
            captureSummary[label] = count; // set explicit amount
            return;
          }

          const label = normalizeDetectedLabel(raw);
          if (label) captureSummary[label] = (captureSummary[label] || 0) + 1;
        });

        if (result.predictions.length > 0) {
          topPred = result.predictions.reduce((best: any, cur: any) => {
            if (!best || (cur.confidence || 0) > (best.confidence || 0)) return cur;
            return best;
          }, null);
        }
      }

      // 5️⃣ Merge capture summary into running summaryCounts
      setSummaryCounts(prev => {
        const merged = { ...prev };
        // if we detected any bulk flags in this capture, prefer those counts
        // and remove/ignore previous individual counts for that label.
        Object.entries(captureSummary).forEach(([label, count]) => {
          // if this captureSummary entry equals a BULK_MAP target (we set it above),
          // we want to overwrite any previous value rather than add to it.
          const isBulk = Object.values(BULK_MAP).some(m => m.label === label && m.count === count);
          if (isBulk) {
            merged[label] = count;
          } else {
            merged[label] = (merged[label] || 0) + count;
          }
        });
        // log merged summary for debugging
        // eslint-disable-next-line no-console
        if (Object.keys(merged).length > 0) console.log('Aggregated Detected Items:', merged);
        return merged;
      });

      // If caller requested navigation (manual capture), navigate with the full merged aggregated map
      if (opts && opts.navigate) {
        const prevSnapshot = summaryCounts;
        const mergedSnapshot: Record<string, number> = { ...prevSnapshot };

        Object.entries(captureSummary).forEach(([label, count]) => {
          const isBulk = Object.values(BULK_MAP).some(m => m.label === label && m.count === count);
          if (isBulk) {
            mergedSnapshot[label] = count;
          } else {
            mergedSnapshot[label] = (mergedSnapshot[label] || 0) + count;
          }
        });

        // If mergedSnapshot is empty, do not navigate
        if (Object.keys(mergedSnapshot).length === 0) {
          // eslint-disable-next-line no-console
          console.log('No detections to navigate with');
        } else {
          router.push({
            pathname: '/add-inventory-item',
            params: { detectedItems: JSON.stringify(mergedSnapshot) },
          });
        }
      }

    } catch (error: any) {
      console.error('Error processing image:', error);
      Alert.alert('Error', error.message || 'Failed to process image. Please try again.');
    } finally {
      setLoading(false);
      // reset countdown when analysis finishes so next capture starts fresh
      try { setCountdown(CAPTURE_INTERVAL); } catch (e) { /* ignore */ }
    }
  }, [cameraRef, router, autoCaptureActive]);

  // Reset aggregated counts
  const handleReset = useCallback(() => {
    setSummaryCounts({});
    // eslint-disable-next-line no-console
    console.log('Summary counts reset');
  }, []);

  // Finish session and navigate with aggregated top detection
  const handleDone = useCallback(() => {
    if (!summaryCounts || Object.keys(summaryCounts).length === 0) {
      Alert.alert('No detections', 'There are no detected items to add.');
      return;
    }

    let topLabel: string | null = null;
    let topCount = 0;
    Object.entries(summaryCounts).forEach(([label, count]) => {
      if (count > topCount) {
        topCount = count;
        topLabel = label;
      }
    });

    if (!topLabel) {
      Alert.alert('No detections', 'There are no detected items to add.');
      return;
    }

    // Stop auto-capture immediately and send the full aggregated map so Add Item can create multiple rows
    setAutoCaptureActive(false);
    // clear both possible timers
    if (autoCaptureTimer.current) {
      clearInterval(autoCaptureTimer.current as any);
      autoCaptureTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current as any);
      countdownTimer.current = null;
    }
    // stop animated progress (none now)

    const detectedItemsPayload = summaryCounts;

    router.push({
      pathname: '/add-inventory-item',
      params: { detectedItems: JSON.stringify(detectedItemsPayload) },
    });
  }, [summaryCounts, router]);
  // Auto-capture every CAPTURE_INTERVAL seconds with a visible countdown
  useEffect(() => {
    // keep a ref of loading so the interval callback can read latest value without
    // re-creating the interval on every loading change
    loadingRef.current = loading;

    // clear any existing countdown
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current as any);
      countdownTimer.current = null;
    }

    if (permission && permission.granted && autoCaptureActive) {
      // initialize countdown
      setCountdown(CAPTURE_INTERVAL);
      // start 1s tick. Note: callback checks loadingRef.current so it will not
      // decrement or trigger captures while analysis is in progress.
      countdownTimer.current = setInterval(() => {
        setCountdown(prev => {
          // if currently analyzing, don't change countdown
          if (loadingRef.current) return prev;

          if (prev <= 1) {
            // trigger capture and reset countdown
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            takePicture({ navigate: false });
            return CAPTURE_INTERVAL;
          }
          return prev - 1;
        });
      }, 1000) as any as number;
    }

    return () => {
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current as any);
        countdownTimer.current = null;
      }
    };
  }, [permission?.granted, takePicture, autoCaptureActive]);

  // (removed top-left animated progress — countdown remains shown in bottom hint)

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>Allow Camera Access</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  


  return (
    <View style={styles.container}>
      <View style={styles.headerGradient}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📸 SCAN INVENTORY</Text>
      </View>

      <CameraView ref={cameraRef} style={styles.camera} />

      {Object.keys(summaryCounts).length > 0 && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.summaryOverlay, { transform: pan.current.getTranslateTransform() }]}
        >
          {Object.entries(summaryCounts).map(([label, count]) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryCount}>{count}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* countdown is shown in the bottom hint; removed top-left animated progress */}

      <View style={styles.captureContainer}>
        <View style={styles.bottomPanel}>
          <TouchableOpacity
            style={[styles.captureButton, loading && { opacity: 0.6 }]}
            onPress={() => takePicture({ manual: true })}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          <View style={styles.controlsRight}>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset} disabled={loading}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={handleDone} disabled={loading}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.autoCaptureRow}>
              <TouchableOpacity
                style={[styles.autoToggleButton, !autoCaptureActive && styles.autoToggleButtonPaused]}
                onPress={() => setAutoCaptureActive(prev => !prev)}
                disabled={loading}
              >
                <Text style={[styles.autoToggleText, !autoCaptureActive && styles.autoToggleTextPaused]}>{autoCaptureActive ? 'Pause' : 'Play'}</Text>
              </TouchableOpacity>

              <View style={styles.captureHintWrapper}>
                <Text style={styles.captureHintText}>
                  {loading ? '🔍 Analyzing...' : autoCaptureActive ? `Next: ${countdown}s` : '📷 Tap to Capture'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  headerGradient: {
    paddingTop: 70,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(244, 162, 97, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 162, 97, 0.18)',
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 26,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    borderWidth: 0,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerSubtitle: {
    textAlign: "center",
    fontSize: 14,
    color: 'rgba(17, 24, 28, 0.7)',
    marginTop: 8,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  camera: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  captureContainer: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    alignItems: "center",
  },
  captureButton: {
    backgroundColor: Colors.light.tint,
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 6,
    borderColor: "#FFFFFF",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  captureButtonInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#FFFFFF",
  },
  captureHint: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  permissionButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  autoCaptureRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoToggleButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  autoToggleButtonPaused: {
    backgroundColor: 'rgba(0,0,0,0.12)'
  },
  autoToggleText: {
    color: '#fff',
    fontWeight: '700',
  },
  autoToggleTextPaused: {
    color: '#fff',
    opacity: 0.8,
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  bottomPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'center',
    gap: 12,
  },
  controlsRight: {
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  captureHintWrapper: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  captureHintText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  // draggable overlay styles
  summaryOverlay: {
    position: 'absolute',
    top: 80,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    zIndex: 50,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    marginRight: 8,
  },
  summaryCount: {
    color: Colors.light.tint,
    fontWeight: '900',
    fontSize: 18,
  },
  // progress circle removed
});
