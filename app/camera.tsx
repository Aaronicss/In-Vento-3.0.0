import { Colors } from '@/constants/theme';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 🔥 Roboflow API URL (Detection or Classification)
const MODEL_NAME = "in-vento-xuxyq"; // example: "food-items"
const MODEL_VERSION = "2";
const API_KEY = "F02xuve8P2KEBhMSFZph";

const ROBOFLOW_URL = `https://detect.roboflow.com/${MODEL_NAME}/${MODEL_VERSION}?api_key=${API_KEY}`;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const autoCaptureTimer = useRef<number | null>(null);
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({});
  const [autoCaptureActive, setAutoCaptureActive] = useState<boolean>(true);
  const CAPTURE_INTERVAL = 8; // seconds
  const [countdown, setCountdown] = useState<number>(CAPTURE_INTERVAL);
  const countdownTimer = useRef<number | null>(null);

  // define takePicture with useCallback so hooks order stays stable
  const takePicture = useCallback(async (opts?: { navigate?: boolean }) => {
    if (!cameraRef.current) return;
    // if auto-capture is disabled and this is an auto-capture (navigate not requested), skip
    if (!opts?.navigate && !autoCaptureActive) return;

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
          const label = pred.class;
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
        Object.entries(captureSummary).forEach(([label, count]) => {
          merged[label] = (merged[label] || 0) + count;
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
          mergedSnapshot[label] = (mergedSnapshot[label] || 0) + count;
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

    const detectedItemsPayload = summaryCounts;

    router.push({
      pathname: '/add-inventory-item',
      params: { detectedItems: JSON.stringify(detectedItemsPayload) },
    });
  }, [summaryCounts, router]);
  // Auto-capture every CAPTURE_INTERVAL seconds with a visible countdown
  useEffect(() => {
    // clear any existing countdown
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current as any);
      countdownTimer.current = null;
    }

    if (permission && permission.granted && autoCaptureActive) {
      // initialize countdown
      setCountdown(CAPTURE_INTERVAL);
      // start 1s tick
      countdownTimer.current = setInterval(() => {
        setCountdown(prev => {
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
        <Text style={styles.headerTitle}>📸 SCAN INVENTORY</Text>
        <Text style={styles.headerSubtitle}>Point at items to detect & analyze</Text>
      </View>

      <CameraView ref={cameraRef} style={styles.camera} />

      {Object.keys(summaryCounts).length > 0 && (
        <View style={styles.summaryOverlay}>
          {Object.entries(summaryCounts).map(([label, count]) => (
            <Text key={label} style={styles.summaryText}>{label}: {count}</Text>
          ))}
        </View>
      )}

      <View style={styles.captureContainer}>
        <TouchableOpacity
          style={[styles.captureButton, loading && { opacity: 0.6 }]}
          onPress={() => takePicture({ navigate: true })}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset} disabled={loading}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone} disabled={loading}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.captureHint}>
            {loading ? "🔍 Analyzing..." : autoCaptureActive ? `Next capture: ${countdown}s` : "📷 Tap to Capture"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  headerGradient: {
    paddingTop: 50,
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
  summaryOverlay: {
    position: 'absolute',
    top: 140,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  summaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
});
