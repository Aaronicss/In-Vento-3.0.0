import Dropdown from '@/components/Dropdown';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors } from '@/constants/theme';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

// Small helper to format a Date into a readable date + time string
const formatDateTime = (d: Date) => {
  try {
    return d.toLocaleString();
  } catch (e) {
    // Fallback: ISO string
    return d.toISOString();
  }
};

export default function AddInventoryItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const detectedItem = params.detectedItem ? JSON.parse(params.detectedItem as string) : null;
  // new: support full aggregated map from Camera under `detectedItems` param
  const detectedItemsMap: Record<string, number> | null = params.detectedItems ? JSON.parse(params.detectedItems as string) : null;
  const { addInventoryItem } = useInventory();
  const [loading, setLoading] = useState(false);

  // Support multiple rows similar to take-order
  // Initialize rows: if camera provided a detectedItem, prefill a single row with its data
  const initialRow = { id: `row-${Date.now()}`, name: '', count: '1', unit: '', shelfLifeDays: '7', iconKey: 'burger', predictedExpiryDate: null, fetchingPrediction: false, storageLocation: '' };

  // If camera provided a full detected items map, initialize rows from it
  const initialRowsFromMap = (() => {
    if (detectedItemsMap && Object.keys(detectedItemsMap).length > 0) {
      // Build a map of normalized picker values so we can map detection labels to actual picker options
      const pickerOptions = [
        'BURGER BUN', 'BEEF', 'LETTUCE', 'PICKLES', 'CHEESE', 'TOMATO', 'ONION',
      ];
      const normalize = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normalizedToPicker: Record<string, string> = {};
      pickerOptions.forEach(p => { normalizedToPicker[normalize(p)] = p; });

      return Object.entries(detectedItemsMap).map(([label, count]) => {
        const raw = String(label || '');
        const norm = normalize(raw);
        // prefer exact picker match, otherwise try mapping via icon map keys
        let matchedName = normalizedToPicker[norm] ?? null;
        if (!matchedName) {
          // try matching against nameToIconMap keys (they are uppercased)
          const byIconKey = Object.keys(nameToIconMap).find(k => normalize(k) === norm);
          if (byIconKey) matchedName = byIconKey;
        }
        // fallback to the raw uppercase label (user can change it)
        const name = (matchedName ?? String(label || '').toUpperCase());
        const countVal = String(count || 1);
        const shelfLife = '7';
        const predictedExpiry = null;
        const iconKey = nameToIconMap[name] || 'burger';
        return { id: `row-${name}-${Date.now()}`, name, count: countVal, unit: '', shelfLifeDays: shelfLife, iconKey, predictedExpiryDate: predictedExpiry, fetchingPrediction: false, storageLocation: '' };
      });
    }

    // fallback: if single detectedItem exists, use that
    if (detectedItem && detectedItem.name) {
      // try to match single detectedItem name to picker values
      const pickerOptions = [
        'BURGER BUN', 'BEEF', 'LETTUCE', 'PICKLES', 'CHEESE', 'TOMATO', 'ONION',
      ];
      const normalize = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const norm = normalize(detectedItem.name);
      const normalizedToPicker: Record<string, string> = {};
      pickerOptions.forEach(p => { normalizedToPicker[normalize(p)] = p; });
      const matched = normalizedToPicker[norm] ?? (Object.keys(nameToIconMap).find(k => normalize(k) === norm) ?? null);
      const name = matched ?? (detectedItem.name || '').toString().toUpperCase();
      const countVal = detectedItem.count !== undefined ? String(detectedItem.count) : '1';
      const shelfLife = detectedItem.predictedHours ? Math.ceil(detectedItem.predictedHours / 24).toString() : '7';
      const predictedExpiry = detectedItem.predictedHours ? new Date(Date.now() + detectedItem.predictedHours * 3600 * 1000) : null;
      const iconKey = nameToIconMap[name] || 'burger';
      return [{ id: `row-${Date.now()}`, name, count: countVal, unit: '', shelfLifeDays: shelfLife, iconKey, predictedExpiryDate: predictedExpiry, fetchingPrediction: false, storageLocation: '' }];
    }

    return [initialRow];
  })();

  const [rows, setRows] = useState<Array<{ id: string; name: string; count: string; unit?: string; shelfLifeDays: string; iconKey: string; predictedExpiryDate: Date | null; fetchingPrediction?: boolean; storageLocation?: string }>>(initialRowsFromMap);

  // track last requested per-row to avoid race conditions
  const lastRequestedRef = useRef<Record<string, string | null>>({});

  const handleConfirm = async () => {
    // Validate rows
    const validRows = rows.filter(r => r.name.trim() !== '' && Number(r.count) > 0);
    if (validRows.length === 0) {
      Alert.alert('No Items', 'Please add at least one item to add to inventory.');
      return;
    }

    setLoading(true);
    try {
      for (const r of validRows) {
        const name = r.name.trim().toUpperCase();
        const countNum = Number(r.count);
        const shelfLifeNum = Number(r.shelfLifeDays) || 7;
        const icon = r.iconKey.toLowerCase();
        const expiresAt = r.predictedExpiryDate || undefined;

        await addInventoryItem(name, icon, countNum, shelfLifeNum, expiresAt, r.unit ?? 'pcs', r.storageLocation);
      }

      Alert.alert('Items Added', `${validRows.length} item(s) have been added to inventory!`, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add inventory items');
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: `row-${Date.now()}`, name: '', count: '1', unit: '', shelfLifeDays: '7', iconKey: 'burger', predictedExpiryDate: null, fetchingPrediction: false, storageLocation: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<typeof rows[number]>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  // Helper to fetch freshness prediction for a specific row+ingredient
  const fetchPredictionForRow = (rowId: string, ingredient: string) => {
    // mark requested ingredient and set fetching flag
    lastRequestedRef.current[rowId] = ingredient;
    updateRow(rowId, { fetchingPrediction: true });

    const extra = Constants.expoConfig?.extra as { weatherCity?: string; weatherApiKey?: string } | undefined;
    const city = extra?.weatherCity || process.env.EXPO_PUBLIC_WEATHER_CITY || '';
    const apiKey = extra?.weatherApiKey || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

    const weatherPromise = apiKey && city ? fetchWeatherData(city, apiKey).catch(err => {
      console.error('Weather fetch failed, using defaults:', err);
      return { temperature: 5, humidity: 50 };
    }) : Promise.resolve({ temperature: 5, humidity: 50 });

    weatherPromise
      .then(({ temperature, humidity }) => getShelfLifePrediction(ingredient, temperature, humidity, 0))
      .then((predictedHours) => {
        if (lastRequestedRef.current[rowId] !== ingredient) return;
        const days = Math.max(1, Math.ceil(predictedHours / 24));
        const now = new Date();
        const expiryDate = new Date(now.getTime() + predictedHours * 60 * 60 * 1000);
        updateRow(rowId, { shelfLifeDays: days.toString(), predictedExpiryDate: expiryDate });
      })
      .catch((error) => {
        console.error('Error fetching shelf life:', error);
        if (lastRequestedRef.current[rowId] !== ingredient) return;
        updateRow(rowId, { shelfLifeDays: '7', predictedExpiryDate: null });
      })
      .finally(() => {
        if (lastRequestedRef.current[rowId] === ingredient) lastRequestedRef.current[rowId] = null;
        updateRow(rowId, { fetchingPrediction: false });
      });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ADD INVENTORY ITEM</Text>
        <Text style={styles.subtitle}>Enter item details below</Text>
      </View>

      {/* Rows Section */}
      <View style={styles.section}>
        <Text style={styles.label}>Items</Text>
        {rows.map((r, idx) => (
          <View key={r.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNumber}>Item {idx + 1}</Text>
              {rows.length > 1 && (
                <TouchableOpacity style={styles.removeButton} onPress={() => removeRow(r.id)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.label, { marginBottom: 6 }]}>Item Name</Text>
              <View style={styles.pickerWrapper}>
                <Dropdown
                  value={r.name}
                  options={[
                    { label: 'Select an item...', value: '' },
                    { label: 'BURGER BUN', value: 'BURGER BUN' },
                    { label: 'BEEF', value: 'BEEF' },
                    { label: 'LETTUCE', value: 'LETTUCE' },
                    { label: 'PICKLES', value: 'PICKLES' },
                    { label: 'CHEESE', value: 'CHEESE' },
                    { label: 'TOMATO', value: 'TOMATO' },
                    { label: 'ONION', value: 'ONION' },
                  ]}
                  onChange={(value) => {
                    updateRow(r.id, { name: value });
                    if (value && nameToIconMap[value]) updateRow(r.id, { iconKey: nameToIconMap[value] });
                    if (!value) {
                      lastRequestedRef.current[r.id] = null;
                      updateRow(r.id, { shelfLifeDays: '7', predictedExpiryDate: null });
                    }
                  }}
                />
              </View>

            {r.name && r.fetchingPrediction && (
              <View style={styles.predictionCard}>
                <Text style={styles.predictionLabel}>Fetching Prediction...</Text>
                <Text style={styles.predictionDate}>Loading...</Text>
                <Text style={styles.predictionShelfLife}>Please wait</Text>
              </View>
            )}

            {r.name && !r.fetchingPrediction && r.predictedExpiryDate && (
              <View style={styles.predictionCard}>
                <Text style={styles.predictionLabel}>Predicted Expiry</Text>
                <Text style={styles.predictionDate}>{formatDateTime(r.predictedExpiryDate)}</Text>
                <Text style={styles.predictionShelfLife}>Shelf life: {r.shelfLifeDays} day{Number(r.shelfLifeDays) === 1 ? '' : 's'}</Text>
              </View>
            )}

                <Text style={[styles.label, { marginTop: 8 }]}>Storage Location</Text>
                <View style={[styles.pickerWrapper, { marginBottom: 8 }]}> 
                  <Dropdown
                    value={r.storageLocation ?? ''}
                    options={[
                      { label: 'Select the storage location...', value: '' },
                      { label: 'REFRIGERATOR', value: 'REFRIGERATOR' },
                      { label: 'FREEZER', value: 'FREEZER' },
                      { label: 'PANTRY', value: 'PANTRY' },
                    ]}
                    onChange={(value) => {
                      updateRow(r.id, { storageLocation: value });
                      const ingredient = rows.find(rr => rr.id === r.id)?.name;
                      if (ingredient && ingredient !== '' && value) {
                        fetchPredictionForRow(r.id, ingredient);
                      }
                    }}
                  />
                </View>

                <Text style={[styles.label, { marginTop: 8 }]}>Quantity</Text>
            <View style={styles.quantityRow}>
              <TextInput
                style={[styles.input, styles.quantityInput]}
                placeholder="Enter quantity"
                value={r.count}
                onChangeText={(v) => updateRow(r.id, { count: v })}
                keyboardType="number-pad"
              />
              <View style={[styles.pickerWrapper, styles.unitPickerWrapper]}>
                <Dropdown
                  value={r.unit ?? 'pcs'}
                  options={[
                    { label: 'pcs', value: 'pcs' },
                    { label: 'g', value: 'g' },
                    { label: 'slices', value: 'slices' },
                  ]}
                  onChange={(val) => updateRow(r.id, { unit: val })}
                />
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.addButton, { marginTop: 6 }]} onPress={addRow}>
          <Text style={styles.addButtonText}>+ Add Another Item</Text>
        </TouchableOpacity>
      </View>
      {/* Confirm Button */}
      <PrimaryButton style={{ marginTop: 12 }} onPress={handleConfirm} loading={loading}>
        CONFIRM ADD
      </PrimaryButton>

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 24,
    backgroundColor: Colors.light.headerBg,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.headerText,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.tint,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    marginBottom: 12,
    color: Colors.light.text,
  },
  confirmButton: {
    // replaced by PrimaryButton usage
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: 'rgba(17, 24, 28, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    marginBottom: 12,
  },
  predictionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderLeftColor: Colors.light.tint,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  predictionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  predictionDate: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  predictionShelfLife: {
    fontSize: 13,
    color: 'rgba(17, 24, 28, 0.8)',
    fontWeight: '500',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityInput: {
    flex: 2,
    marginRight: 8,
  },
  unitInput: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.tint,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.tint,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FF5252',
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  unitPickerWrapper: {
    flex: 1,
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
