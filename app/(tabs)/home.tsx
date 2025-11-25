import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useInventory } from '@/contexts/InventoryContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TileHome() {
  const router = useRouter();
  const { inventoryItems } = useInventory();
  const { orders } = useOrders();

  // entrance animation for tiles
  const entrance = useRef(new Animated.Value(0)).current;

  // force two-column layout on all screen sizes
  const isTwoColumn = true;

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [entrance]);

  const tiles = [
    { key: 'inventory', label: 'Inventory', route: '/(tabs)/inventory', icon: 'inventory', count: inventoryItems.length },
    { key: 'orders', label: 'Orders', route: '/orders', icon: 'list.bullet', count: orders.length },
    { key: 'take-order', label: 'Take Order', route: '/take-order', icon: 'cart.fill', count: 0 },
    { key: 'alerts', label: 'Alerts', route: '/alerts', icon: 'bell.fill', count: 0 },
  ];

  // compute alerts using same rule as Alerts page
  const alerts = inventoryItems.map((it) => {
    const now = Date.now();
    const created = it.createdAt.getTime();
    const expires = it.expiresAt.getTime();
    const total = expires - created;
    const remaining = Math.max(0, expires - now);
    const progress = total <= 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
    const severity: 'critical' | 'warning' | 'ok' = progress <= 0.15 ? 'critical' : progress <= 0.4 ? 'warning' : 'ok';
    return { item: it, progress, severity };
  }).filter(a => a.severity !== 'ok');

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  // update alerts tile count and attach severity counts
  tiles.forEach((t) => {
    if (t.key === 'alerts') {
      t.count = alerts.length;
      (t as any).critical = criticalCount;
      (t as any).warning = warningCount;
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IN-VENTO</Text>
      <Text style={styles.subtitle}>Quick Navigation</Text>

      <TouchableOpacity style={styles.scanButton} onPress={() => router.push('/camera')}> 
        <Text style={styles.scanButtonText}>Scan Inventory</Text>
      </TouchableOpacity>

      {/* compute alerts count for badge */}
      {/** derive alerts using same rule as alerts page */}
      {/** this is a noop render block used to compute alertsCount in component scope */}
      <></>

      <View style={styles.grid}>
        {tiles.map((t, idx) => {
          const animatedStyle = {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              },
            ],
          } as any;

          return (
            <Animated.View key={t.key} style={[styles.tileWrapper, styles.twoCol, animatedStyle]}>
              <TouchableOpacity
                style={styles.tile}
                onPress={() => router.push(t.route as any)}
                activeOpacity={0.9}
              >
                <View style={styles.tileLeft}>
                  <IconSymbol name={t.icon as any} size={34} color={Colors.light.tint} />
                  <View style={styles.tileTextWrap}>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                    <Text style={styles.tileHint}>Tap to open</Text>
                  </View>
                </View>

                {t.count > 0 && (
                  <View style={[styles.badge, t.key === 'alerts' && (t as any).critical > 0 ? styles.criticalBadge : null]}>
                    <Text style={styles.badgeText}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    marginTop: 20,
  },
  subtitle: {
    color: 'rgba(17,24,28,0.7)',
    marginBottom: 16,
  },
  grid: {
    marginTop: 20,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileWrapper: {
    marginBottom: 12,
  },
  twoCol: {
    width: '48%'
  },
  oneCol: {
    width: '100%'
  },
  tile: {
    width: '100%',
    height: 140,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,162,97,0.18)',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.tint,
  },
  iconRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.light.tint,
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  criticalBadge: {
    backgroundColor: '#e63946'
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tileHint: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(17,24,28,0.6)'
  }
  ,
  tileLeft: { flexDirection: 'row', alignItems: 'center' },
  tileTextWrap: { marginLeft: 12 },
  scanButton: {
    marginTop: 12,
    width: '100%',
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
