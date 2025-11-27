import PrimaryButton from '@/components/PrimaryButton';
import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useInventory } from '../contexts/InventoryContext';

export default function AlertsPage() {
  const { inventoryItems } = useInventory();
  const router = useRouter();
  // derive alerts with severity and sort them
  const alerts = inventoryItems
    .map((it) => {
      const now = Date.now();
      const created = it.createdAt.getTime();
      const expires = it.expiresAt.getTime();
      const total = expires - created;
      const remaining = Math.max(0, expires - now);
      const progress = total <= 0 ? 0 : Math.max(0, Math.min(1, remaining / total));

      // severity: critical if almost expired, warning otherwise
      const severity: 'critical' | 'warning' | 'ok' = progress <= 0.15 ? 'critical' : progress <= 0.4 ? 'warning' : 'ok';

      return { item: it, progress, severity };
    })
    .filter((a) => a.severity !== 'ok')
    .sort((a, b) => {
      // critical first, then warning; within same severity sort by soonest expiry (smallest progress)
      const sevOrder = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
      if (sevOrder(a.severity) !== sevOrder(b.severity)) return sevOrder(a.severity) - sevOrder(b.severity);
      return a.progress - b.progress;
    });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alerts</Text>
      {alerts.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No alerts</Text></View>
      ) : (
        alerts.map(({ item, progress, severity }) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={[styles.severityPill, severity === 'critical' ? styles.criticalPill : styles.warningPill]}>
                <Text style={styles.severityText}>{severity === 'critical' ? 'CRITICAL' : 'Warning'}</Text>
              </View>
            </View>
            <Text style={styles.cardText}>Expires: {item.expiresAt.toLocaleString()}</Text>
            <Text style={styles.cardSubText}>Remaining: {Math.max(0, Math.round(progress * 100))}%</Text>
            <PrimaryButton onPress={() => router.push('/(tabs)/inventory')}>Open Inventory</PrimaryButton>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background, padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 12 },
  empty: { alignItems: 'center', padding: 24, backgroundColor: '#FFF7ED', borderRadius: 12 },
  emptyText: { color: 'rgba(17,24,28,0.7)' },
  card: { backgroundColor: '#FFF7ED', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(244,162,97,0.18)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '800', color: Colors.light.tint },
  cardText: { color: 'rgba(17,24,28,0.8)', marginTop: 6 },
  cardSubText: { color: 'rgba(17,24,28,0.7)', marginTop: 6 },
  button: { marginTop: 8, backgroundColor: Colors.light.tint, padding: 10, borderRadius: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  severityPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  severityText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  criticalPill: { backgroundColor: '#e63946' },
  warningPill: { backgroundColor: Colors.light.tint },
});
