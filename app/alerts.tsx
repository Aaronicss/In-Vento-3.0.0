import PrimaryButton from '@/components/PrimaryButton';
import { Colors } from '@/constants/theme';
import { getLowStockThreshold } from '@/services/preferencesService';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useInventory } from '../contexts/InventoryContext';

export default function AlertsPage() {
  const { inventoryItems } = useInventory();
  const router = useRouter();
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  useEffect(() => {
    let mounted = true;
    getLowStockThreshold().then((t) => { if (mounted) setLowStockThreshold(t); });
    return () => { mounted = false; };
  }, []);

  // Compute per-ingredient batch numbers based on creation order (oldest -> newest)
  const batchNumberMap = useMemo(() => {
    const byCreated = [...inventoryItems].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const counters: Record<string, number> = {};
    const map: Record<string, number> = {};
    for (const it of byCreated) {
      const name = (it.name || '').toString().toUpperCase();
      counters[name] = (counters[name] || 0) + 1;
      map[it.id] = counters[name];
    }
    return map;
  }, [inventoryItems]);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Alerts</Text>
      </View>
      <Text style={{ marginBottom: 8, color: 'rgba(17,24,28,0.7)' }}>Low-stock threshold: {lowStockThreshold} items or less</Text>

      {/* Low-stock items */}
      <Text style={{ fontWeight: '800', marginBottom: 8 }}>Low Stock</Text>
      {inventoryItems.filter(i => i.count <= lowStockThreshold).length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No low-stock items</Text></View>
      ) : (
        inventoryItems
          .filter(i => i.count <= lowStockThreshold)
          .map((i, idx) => {
            const batchNo = batchNumberMap[i.id] ?? idx + 1;
            return (
              <TouchableOpacity key={i.id} style={styles.card} onPress={() => router.push('/(tabs)/inventory')}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>{i.name}</Text>
                    <View style={[styles.batchBadge, { marginLeft: 8 }]}> 
                      <Text style={styles.batchBadgeText}>{`B${batchNo}`}</Text>
                    </View>
                  </View>
                  <Text style={{ fontWeight: '700' }}>{i.count} {i.unit}</Text>
                </View>
                <Text style={styles.cardText}>Storage: {(i.storageLocation || i.storage_location || 'UNKNOWN').toString().toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })
      )}

      {/* Expiry alerts (kept below) */}
      <Text style={{ fontWeight: '800', marginTop: 12, marginBottom: 8 }}>Expiry Alerts</Text>
      {alerts.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No expiry alerts</Text></View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background, padding: 20 },
  headerContainer: {
    position: 'relative',
    marginBottom: 10,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
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
  title: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 12, paddingTop: 28 },
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
  batchBadge: { backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  batchBadgeText: { fontWeight: '800', color: '#000' },
});
