import { Colors } from '@/constants/theme';
import { DEFAULT_THRESHOLD, getLowStockThreshold, setLowStockThreshold } from '@/services/preferencesService';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PreferencesScreen() {
  const router = useRouter();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [input, setInput] = useState<string>('');

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
