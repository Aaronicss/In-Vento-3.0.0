import PrimaryButton from '@/components/PrimaryButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useInventory } from '@/contexts/InventoryContext';
import { useOrders } from '@/contexts/OrdersContext';
import { DEFAULT_PRICES, getRecipePrices } from '@/services/preferencesService';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const screenWidth = Dimensions.get('window').width;

export default function TileHome() {
  const router = useRouter();
  const { inventoryItems } = useInventory();
  const { orders } = useOrders();

  // low-stock count (load threshold from preferences)
  const [lowStockThreshold, setLowStockThreshold] = React.useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = React.useState<number>(0);

  React.useEffect(() => {
    let mounted = true;
    import('@/services/preferencesService')
      .then(mod => mod.getLowStockThreshold())
      .then(t => {
        if (!mounted) return;
        setLowStockThreshold(t);
        setLowStockCount(inventoryItems.filter(i => i.count <= t).length);
      })
      .catch(() => {
        const t = 5;
        if (!mounted) return;
        setLowStockThreshold(t);
        setLowStockCount(inventoryItems.filter(i => i.count <= t).length);
      });
    return () => { mounted = false; };
  }, [inventoryItems]);

  // entrance animation for tiles
  const entrance = useRef(new Animated.Value(0)).current;

  // force two-column layout on all screen sizes
  const isTwoColumn = true;

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [entrance]);

  const tiles = [
    { key: 'orders', label: 'Orders', route: '/orders', icon: 'list.bullet', count: orders.length, bgColor: '#ffffff', textColor: '#000000', iconColor: '#f91616' },
    { key: 'take-order', label: 'Take Order', route: '/take-order', icon: 'cart.fill', count: 0, bgColor: '#ffffff', textColor: '#000000', iconColor: '#8886FF' },
    { key: 'inventory', label: 'Inventory', route: '/(tabs)/inventory', icon: 'inventory', count: inventoryItems.length, bgColor: '#ffffff', textColor: '#000000', iconColor: '#FF7E33' },
    { key: 'alerts', label: 'Alerts', route: '/alerts', icon: 'bell.fill', count: 0, bgColor: '#ffffff', textColor: '#000000', iconColor: '#00B309' },
  ];

  const tiles2 = [
    { title: "Items in Inventory", value: String(inventoryItems.length), bgColor: "#ffffff", textColor: "#000000", route: '/(tabs)/inventory', image: require('../../assets/Logo1.png')},
    { title: "Low Stock", value: "5", bgColor: "#ffffff", textColor: "#000000", route: '/(tabs)/inventory', image: require('../../assets/Logo2.png')},
    { title: "Pending Orders", value: String(orders.length), bgColor: "#ffffff", textColor: "#000000", route: '/orders', image: require('../../assets/Logo1.png') },
    { title: "Today's Sales", value: "P11,509", bgColor: "#ffffff", textColor: "#000000", route: '/orders', image: require('../../assets/Logo2.png') },
  ];

  // load recipe prices (merge from preferences service); used to compute order totals
  const [recipePrices, setRecipePrices] = useState<Record<string, number>>({ ...DEFAULT_PRICES });
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await getRecipePrices();
        if (!mounted) return;
        setRecipePrices(p);
      } catch (e) {
        // keep defaults
      }
    })();
    return () => { mounted = false; };
  }, []);

  const formatPHP = (n: number) => `₱${n.toFixed(2)}`;

  // compute today's sales (local date) by summing item quantity * recipe price
  const todaySales = useMemo(() => {
    if (!orders || orders.length === 0) return 0;
    const today = new Date();
    const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    return orders.reduce((sum, order) => {
      if (!order.createdAt || !isSameDay(order.createdAt, today)) return sum;
      const orderSum = (order.items || []).reduce((s, it) => {
        const price = recipePrices[it.name] ?? 0;
        return s + (price * (it.quantity || 0));
      }, 0);
      return sum + orderSum;
    }, 0);
  }, [orders, recipePrices]);

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
            <Text style={styles.headerSubtitle}>Navigate To:</Text>
          </View>
        </View>
        <PrimaryButton onPress={() => router.push('/camera')} style={{ marginTop: 12, width: '70%', }}>SCAN INVENTORY</PrimaryButton>
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
                      <View style={[styles.badge, styles.criticalBadge]}>
                        <Text style={styles.badgeText}>{t.count}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.tileIconWrap}>
                    <IconSymbol name={t.icon as any} size={64} color={(t as any).iconColor ?? Colors.light.tint} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

            <Text style={styles.headerSubtitle}>Inventory Monitoring</Text>
        <View style={styles.container2}>
          {tiles2.map((tile, index) => {
            const titleUp = tile.title ? tile.title.toUpperCase() : '';
            const displayedValue = titleUp.includes('LOW')
              ? String(lowStockCount)
              : titleUp.includes('TODAY')
              ? formatPHP(todaySales)
              : tile.value;
            return (
              <TouchableOpacity
  key={index}
  style={[styles.tile2, { backgroundColor: tile.bgColor }]}
  activeOpacity={0.85}
  onPress={() => tile.route ? router.push(tile.route as any) : undefined}
>
  <View style={styles.tileRow}>
    <Image
      source={tile.image} // e.g., require('../assets/icon.png') or {uri: 'https://...'}
      style={{ width: 40, height: 40, marginRight: 10 }}
      resizeMode="contain"
    />
    <View style={styles.tileTextWrapper}>
      <Text
        style={[styles.tile2Value, { color: tile.textColor }]}
        numberOfLines={1}
      >
        {displayedValue}
      </Text>

      <Text
        style={[styles.tile2Title, { color: tile.textColor }]}
        numberOfLines={2}
      >
        {tile.title}
      </Text>
    </View>

    <Text style={[styles.tile2Sign, { color: tile.textColor }]}>
      &gt;
    </Text>
  </View>
</TouchableOpacity>
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
    backgroundColor: '#D9D9D9',
    padding: 0,
    alignItems: 'center',
  },
  container2: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    paddingHorizontal: 0,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: Colors.light.background,
    paddingBottom: 40,
  },
  burgerImage: {
    width: screenWidth + 40, // extend to cover parent padding (full-bleed)
    height: 120, // match header container height
    alignSelf: 'center',
  },
  tile2: {
    width: "100%",
    height: 80,
    borderRadius: 0,
    padding: 15,
    marginBottom: 12,
    justifyContent: "space-between",
  },
  tile2Title: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    flexWrap: 'wrap',
    includeFontPadding: false,
  },
  tile2Value: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'left',
  },
  tile2Sign: {
    fontSize: 24,
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
    justifyContent: 'space-evenly',
  },
  tileWrapper: {
    marginBottom: 12,
  },
  twoCol: {
    width: '40%'
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
    backgroundColor: 'Colors.light.tint',
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
    height: 120,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
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
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.light.headerText,
    backgroundColor: 'black',
    paddingVertical: 5,
    paddingLeft: 10,
    paddingHorizontal: 0,
    borderRadius: 0,
    alignSelf: 'stretch',
    marginHorizontal: 0,
    textAlign: 'left',
    width: '100%'
  },
  tileRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

tileTextWrapper: {
  flex: 1,
},
});
