import PrimaryButton from '@/components/PrimaryButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useInventory } from '@/contexts/InventoryContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const screenWidth = Dimensions.get('window').width;

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
    { key: 'inventory', label: 'Inventory', route: '/(tabs)/inventory', icon: 'inventory', count: inventoryItems.length, bgColor: '#000000', textColor: '#ffffff' },
    { key: 'orders', label: 'Orders', route: '/orders', icon: 'list.bullet', count: orders.length, bgColor: '#f59e0b', textColor: '#000000' },
    { key: 'take-order', label: 'Take Order', route: '/take-order', icon: 'cart.fill', count: 0, bgColor: '#f59e0b', textColor: '#000000' },
    { key: 'alerts', label: 'Alerts', route: '/alerts', icon: 'bell.fill', count: 0, bgColor: '#000000', textColor: '#ffffff' },
  ];

  const tiles2 = [
    { title: "ITEMS IN\nINVENTORY", value: "10", bgColor: "#000000", textColor: "#ffffff" },
    { title: "LOW\nSTOCK", value: "5", bgColor: "#f59e0b", textColor: "#000000" },
    { title: "PENDING\nORDERS", value: "10", bgColor: "#f59e0b", textColor: "#000000" },
    { title: "TODAY’S\nSALES", value: "P11,509", bgColor: "#000000", textColor: "#ffffff" },
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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        
        <View style={styles.headerContainer}>
          <Image
            source={require('../../assets/homeburg.jpg')}
            style={styles.burgerImage}
            resizeMode="cover"
          />
          <View style={styles.headerOverlay} />
          <View style={styles.headerCenter}> 
            <Text style={styles.headerSubtitle}>INVENTORY DASHBOARD</Text>
          </View>
        </View>
        <View style={styles.container2}>
          {tiles2.map((tile, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.tile2, { backgroundColor: tile.bgColor }]}
            >
              <Text style={[styles.tile2Title, { color: tile.textColor }]} numberOfLines={2} ellipsizeMode="tail">{tile.title}</Text>
              <Text style={[styles.tile2Value, { color: tile.textColor }]} numberOfLines={1} ellipsizeMode="tail">{tile.value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryButton onPress={() => router.push('/camera')} style={{ marginTop: 12, width: '100%' }}>SCAN INVENTORY</PrimaryButton>

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
                  style={[styles.tile, { backgroundColor: (t as any).bgColor ?? '#FFF7ED' }]}
                  onPress={() => router.push(t.route as any)}
                  activeOpacity={0.9}
                >
                  <View style={styles.tileHeaderRow}>
                    <Text style={[styles.tileLabel, { color: (t as any).textColor ?? Colors.light.tint }]}>{t.label}</Text>
                    {t.count > 0 && (
                      <View style={[styles.badge, t.key === 'alerts' && (t as any).critical > 0 ? styles.criticalBadge : null]}>
                        <Text style={styles.badgeText}>{t.count}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.tileIconWrap}>
                    <IconSymbol name={t.icon as any} size={64} color={(t as any).textColor ?? Colors.light.tint} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
    alignItems: 'center',
  },
  container2: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: Colors.light.background,
    paddingBottom: 40,
  },
  burgerImage: {
    width: screenWidth + 40, // extend to cover parent padding (full-bleed)
    height: 220, // match header container height
    alignSelf: 'center',
  },
  tile2: {
    width: "48%",
    height: 120,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    justifyContent: "space-between",
  },
  tile2Title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    flexWrap: 'wrap',
    includeFontPadding: false,
  },
  tile2Value: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  title2: {
    fontSize: 16,
    fontWeight: "bold",
  },
  value: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
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
    // use compact card style similar to tile2
    width: '100%',
    height: 120,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: 'rgba(244,162,97,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'flex-start',
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.light.tint,
    textAlign: 'center',
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
  tileLeft: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  tileTextWrap: { marginTop: 8, alignItems: 'center' },
  tileHeaderRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileIconWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', flex: 1 },
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
  /* Header with background image */
  headerContainer: {
    width: '100%',
    height: 220,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    marginHorizontal: -20,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,162,97,0.12)'
  },
  headerTopRow: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.light.headerText,
    backgroundColor: Colors.light.headerBg,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderRadius: 0,
    alignSelf: 'stretch',
    marginHorizontal: 0,
    textAlign: 'center',
    width: '100%'
  },
});
