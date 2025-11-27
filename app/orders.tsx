import PrimaryButton from '@/components/PrimaryButton';
import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useOrders } from '../contexts/OrdersContext';

export default function OrdersPage() {
  const { orders, loading } = useOrders();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Orders</Text>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.light.tint} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No orders yet</Text></View>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <Text style={styles.cardTitle}>Table #{order.tableNumber}</Text>
            <Text style={styles.cardText}>{order.items.map((i:any) => `${i.quantity}x ${i.name}`).join(', ')}</Text>
            <PrimaryButton onPress={() => router.push('/(tabs)/home')}>Back</PrimaryButton>
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
  card: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, marginBottom: 12 },
  cardTitle: { fontWeight: '800', color: Colors.light.tint },
  cardText: { color: 'rgba(17,24,28,0.8)', marginTop: 6 },
  button: { marginTop: 8, backgroundColor: Colors.light.tint, padding: 10, borderRadius: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
