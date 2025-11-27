import { Colors } from '@/constants/theme';
import { DEFAULT_PRICES, DEFAULT_THRESHOLD, getLowStockThreshold, getRecipePrices, setLowStockThreshold, setRecipePrices } from '@/services/preferencesService';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PreferencesScreen() {
  const router = useRouter();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [input, setInput] = useState<string>('');
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    getRecipePrices().then((p) => {
      if (!mounted) return;
      const asStrings: Record<string, string> = {};
      Object.keys({ ...DEFAULT_PRICES, ...p }).forEach((k) => {
        asStrings[k] = String(p[k] ?? DEFAULT_PRICES[k] ?? '');
      });
      setPrices(asStrings);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    getLowStockThreshold().then((t) => {
      if (!mounted) return;
      setThreshold(t);
      setInput(String(t));
    });
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    const n = Number(input);
    if (isNaN(n) || n < 0) {
      Alert.alert('Invalid value', 'Please enter a valid non-negative number');
      return;
    }
    try {
      await setLowStockThreshold(n);
      setThreshold(n);
      Alert.alert('Saved', `Low stock threshold set to ${n}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save preference');
    }
  };

  const savePrices = async () => {
    try {
      const parsed: Record<string, number> = {};
      for (const k of Object.keys(prices)) {
        const n = Number(prices[k]);
        if (isNaN(n) || n < 0) {
          Alert.alert('Invalid price', `Please enter a valid non-negative price for ${k}`);
          return;
        }
        parsed[k] = n;
      }
      await setRecipePrices(parsed);
      Alert.alert('Saved', 'Recipe prices saved. All prices are in Philippine Peso (₱).');
    } catch (e) {
      Alert.alert('Error', 'Failed to save recipe prices');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preferences</Text>
      <Text style={styles.subtitle}>Configure low-stock threshold (ingredients with count ≤ threshold are considered low stock).</Text>

      <View style={{ marginTop: 12 }}>
        <Text style={{ marginBottom: 6, fontWeight: '700' }}>Low-stock threshold</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          keyboardType="number-pad"
          placeholder={String(DEFAULT_THRESHOLD)}
          style={{ backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.tint }}
        />

        <TouchableOpacity style={[styles.backButton, { marginTop: 12 }]} onPress={save}>
          <Text style={styles.backButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 18 }}>
        <Text style={{ marginBottom: 8, fontWeight: '800' }}>Recipe Prices (₱)</Text>
        {Object.keys({ ...DEFAULT_PRICES, ...(prices as any) }).map((r) => (
          <View key={r} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>{r}</Text>
            <Text style={{ marginRight: 8 }}>₱</Text>
            <TextInput
              value={prices[r] ?? String(DEFAULT_PRICES[r] ?? '')}
              onChangeText={(v) => setPrices(prev => ({ ...prev, [r]: v }))}
              keyboardType="numeric"
              style={{ width: 100, backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.tint }}
            />
          </View>
        ))}

        <TouchableOpacity style={[styles.backButton, { marginTop: 8 }]} onPress={savePrices}>
          <Text style={styles.backButtonText}>Save Prices</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.backButton, { marginTop: 18 }]} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(17,24,28,0.7)',
    marginBottom: 24,
  },
  backButton: {
    marginTop: 12,
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
