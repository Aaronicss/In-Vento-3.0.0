import { Colors } from '@/constants/theme';
import { Picker } from '@react-native-picker/picker';
import Constants from 'expo-constants';
import { Router, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useInventory } from '../contexts/InventoryContext';
import { getShelfLifePrediction } from '../services/freshnessApi';
import { fetchWeatherData } from '../services/weatherApi';

// Available icons mapping
const availableIcons: { [key: string]: any } = {
  burgerbun: require('../assets/burgerbun.png'),
  beef: require('../assets/beef.png'),
  lettuce: require('../assets/lettuce.png'),
  cheese: require('../assets/cheese.png'),
  tomato: require('../assets/tomato.png'),
  onion: require('../assets/onion.png'),
  burger: require('../assets/burger.png'),
  drink: require('../assets/drink.png'),
};

const nameToIconMap: { [key: string]: string } = {
  "BURGER BUN": "burgerbun",
  "BEEF": "beef",
  "LETTUCE": "lettuce",
  "PICKLES": "pickles",
  "CHEESE": "cheese",
  "TOMATO": "tomato",
  "ONION": "onion",
  "BURGER": "burger",
  "DRINK": "drink",
};

// Format DateTime helper
const formatDateTime = (d: Date) => {
  try { return d.toLocaleString(); }
  catch { return d.toISOString(); }
};

export default function AddInventoryItemScreen() {
  const router: Router = useRouter();
  const params = useLocalSearchParams(); // for camera result
  const detectedItem = params.detectedItem ? JSON.parse(params.detectedItem as string) : null;

  const { addInventoryItem } = useInventory();

  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState(detectedItem?.name || '');
  const [iconKey, setIconKey] = useState(detectedItem?.name ? nameToIconMap[detectedItem.name] : 'burger');
  const [count, setCount] = useState('1');
  const [shelfLifeDays, setShelfLifeDays] = useState(
    detectedItem?.predictedHours ? Math.ceil(detectedItem.predictedHours / 24).toString() : '7'
  );
  const [predictedExpiryDate, setPredictedExpiryDate] = useState<Date | null>(
    detectedItem?.predictedHours ? new Date(Date.now() + detectedItem.predictedHours * 3600 * 1000) : null
  );
  const [fetchingPrediction, setFetchingPrediction] = useState(false);

  // Try to fetch prediction from ML API if we don't have predictedHours from camera
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const fetchedForRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchPrediction = async () => {
    if (!detectedItem || detectedItem.predictedHours) return;
    // If we've already fetched for this detected item and we already have a prediction, avoid re-fetching
    if (fetchedForRef.current === detectedItem.name && predictedExpiryDate) return;
    setPredictionError(null);
    setFetchingPrediction(true);
    // mark this ingredient as being fetched
    fetchedForRef.current = detectedItem.name;
    // bump request id
    requestIdRef.current += 1;
    const localRequestId = requestIdRef.current;

    // Read weather config
    const extra = Constants.expoConfig?.extra as any;
    const city = extra?.weatherCity || process.env.EXPO_PUBLIC_WEATHER_CITY || '';
    const apiKey = extra?.weatherApiKey || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

    // Fetch weather if configured
    const weather = apiKey && city ? await fetchWeatherData(city, apiKey).catch((e) => {
      console.warn('Weather fetch failed', e);
      return { temperature: 5, humidity: 50 };
    }) : { temperature: 5, humidity: 50 };

    // Debug log so browser/dev can confirm a POST attempt
    console.log('Attempting freshness prediction POST', { ingredient: detectedItem.name, weather, platform: Platform.OS });

    // Retry logic for transient errors (e.g., 502)
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const hours = await getShelfLifePrediction(detectedItem.name, weather.temperature, weather.humidity, 0);
        if (hours && typeof hours === 'number') {
          const days = Math.max(1, Math.ceil(hours / 24));
          // only apply result if this is the latest request
          if (localRequestId === requestIdRef.current) {
            setShelfLifeDays(days.toString());
            setPredictedExpiryDate(new Date(Date.now() + hours * 3600 * 1000));
          }
          lastError = null;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Prediction attempt ${attempt} failed:`, err?.message || err);
        // If 502-like, backoff and retry
        const status = err?.message?.match(/(\d{3})/)?.[1];
        if (status === '502' && attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, 500 * attempt));
          continue;
        }
        break;
      }
    }

    if (lastError) {
      console.warn('Freshness API failed after retries:', lastError);
      // only update UI if this is the latest request
      if (localRequestId === requestIdRef.current) {
        setPredictionError(String(lastError?.message || lastError || 'Unknown error'));
        setShelfLifeDays('7');
        setPredictedExpiryDate(new Date(Date.now() + 7 * 24 * 3600 * 1000));
      }
    }

    // clear fetching only if this is the latest request
    if (localRequestId === requestIdRef.current) setFetchingPrediction(false);
  };

  useEffect(() => {
    fetchPrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedItem]);

  // Update icon and expiry if detectedItem changes (from camera)
  useEffect(() => {
    if (detectedItem) {
      setItemName(detectedItem.name);
      setIconKey(nameToIconMap[detectedItem.name] || 'burger');

      if (detectedItem.predictedHours) {
        const days = Math.ceil(detectedItem.predictedHours / 24);
        setShelfLifeDays(days.toString());
        setPredictedExpiryDate(new Date(Date.now() + detectedItem.predictedHours * 3600 * 1000));
      }

      // Auto-fill quantity if provided by camera detection
      if ((detectedItem as any).count !== undefined) {
        try {
          const cnt = Number((detectedItem as any).count);
          if (!isNaN(cnt) && cnt > 0) setCount(cnt.toString());
        } catch (e) {
          // ignore malformed count
        }
      }
    }
  }, [detectedItem]);

  // Camera result helper
  const applyCameraResult = (pred: { class: string; confidence: number; hours_until_expiry?: number }) => {
    const detectedName = pred.class.toUpperCase();
    setItemName(detectedName);
    setIconKey(nameToIconMap[detectedName] || 'burger');

    if (pred.hours_until_expiry) {
      const days = Math.ceil(pred.hours_until_expiry / 24);
      setShelfLifeDays(days.toString());
      setPredictedExpiryDate(new Date(Date.now() + pred.hours_until_expiry * 3600 * 1000));
    } else {
      setShelfLifeDays('7');
      setPredictedExpiryDate(new Date(Date.now() + 7 * 24 * 3600 * 1000));
    }
  };

  const handleConfirm = async () => {
    if (!itemName.trim()) return Alert.alert('Invalid Item Name', 'Please enter an item name.');

    const countNum = Number(count);
    if (isNaN(countNum) || countNum <= 0) return Alert.alert('Invalid Count', 'Enter a valid count > 0');

    const shelfLifeNum = Number(shelfLifeDays);
    if (isNaN(shelfLifeNum) || shelfLifeNum <= 0) return Alert.alert('Invalid Shelf Life', 'Enter valid days > 0');

    setLoading(true);
    try {
      await addInventoryItem(
        itemName.trim().toUpperCase(),
        iconKey.toLowerCase(),
        countNum,
        shelfLifeNum,
        predictedExpiryDate || undefined,
        'pcs' // default unit for camera-detected adds
      );

      Alert.alert('Item Added', `${itemName} added!`, [{ text: 'OK', onPress: () => router.push('/inventory')}]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ADD INVENTORY ITEM</Text>
        <Text style={styles.subtitle}>Enter item details below</Text>
      </View>

      {/* Item Name */}
      <View style={styles.section}>
        <Text style={styles.label}>Item Name</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={itemName}
            onValueChange={(value) => {
              setItemName(value);
              if (value && nameToIconMap[value]) setIconKey(nameToIconMap[value]);
            }}
          >
            <Picker.Item label="Select an item..." value="" />
            {Object.keys(nameToIconMap).map((key) => (
              <Picker.Item key={key} label={key} value={key} />
            ))}
          </Picker>
        </View>

        {itemName && (
          fetchingPrediction ? (
            <View style={styles.predictionCard}>
              <Text style={styles.predictionLabel}>Fetching Prediction...</Text>
              <Text style={styles.predictionDate}>Loading...</Text>
              <Text style={styles.predictionShelfLife}>Please wait</Text>
            </View>
          ) : predictedExpiryDate ? (
            <View style={styles.predictionCard}>
              <Text style={styles.predictionLabel}>Predicted Expiry</Text>
              <Text style={styles.predictionDate}>{formatDateTime(predictedExpiryDate)}</Text>
              <Text style={styles.predictionShelfLife}>
                Shelf life: {shelfLifeDays} day{Number(shelfLifeDays) === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null
        )}
        {predictionError && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#B00020' }}>Prediction error: {predictionError}</Text>
            <TouchableOpacity onPress={() => fetchPrediction()} style={{ marginTop: 8, padding: 8, backgroundColor: Colors.light.tint, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Retry Prediction</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quantity */}
      <View style={styles.section}>
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter quantity"
          value={count}
          onChangeText={setCount}
          keyboardType="number-pad"
        />
      </View>

      {/* Confirm / Cancel */}
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={loading}>
        <Text style={styles.confirmButtonText}>{loading ? 'Adding...' : 'CONFIRM ADD'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={() => router.push('/inventory')}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background, padding: 20 },
  header: { alignItems: 'center', marginTop: 30, marginBottom: 24, backgroundColor: 'rgba(244, 162, 97, 0.12)', paddingVertical: 20, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(244, 162, 97, 0.18)' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.light.text, letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: 'rgba(17, 24, 28, 0.7)', marginTop: 4 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '700', color: Colors.light.tint, marginBottom: 10 },
  input: { backgroundColor: '#FFF7ED', padding: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: 'rgba(244, 162, 97, 0.15)', marginBottom: 12, color: Colors.light.text },
  pickerWrapper: { backgroundColor: '#FFF7ED', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244, 162, 97, 0.15)', marginBottom: 12 },
  predictionCard: { backgroundColor: 'rgba(244, 162, 97, 0.12)', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: Colors.light.tint, borderWidth: 1, borderColor: 'rgba(244, 162, 97, 0.18)' },
  predictionLabel: { fontSize: 12, fontWeight: '700', color: Colors.light.tint, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  predictionDate: { fontSize: 17, fontWeight: '700', color: Colors.light.text, marginBottom: 6 },
  predictionShelfLife: { fontSize: 13, color: 'rgba(17, 24, 28, 0.8)', fontWeight: '500' },
  confirmButton: { backgroundColor: Colors.light.tint, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 12, marginBottom: 12, shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  confirmButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  cancelButton: { paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  cancelButtonText: { color: 'rgba(17, 24, 28, 0.6)', fontSize: 14, fontWeight: '600' },
});