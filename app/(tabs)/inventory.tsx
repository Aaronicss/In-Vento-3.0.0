import PrimaryButton from '@/components/PrimaryButton';
import { Colors } from '@/constants/theme';
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ProgressBar } from "react-native-paper";
import { getIconSource, useInventory } from "../../contexts/InventoryContext";

export default function InventoryScreen() {
  const router = useRouter();
  const {
    inventoryItems,
    loading,
    incrementCount,
    decrementCount,
    removeInventoryItem,
    refreshFreshnessPredictions,
  } = useInventory();
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [freshnessLoading, setFreshnessLoading] = useState(false);

  // Get configuration from environment variables or Constants
  const city = Constants.expoConfig?.extra?.weatherCity || process.env.EXPO_PUBLIC_WEATHER_CITY || 'Dasmarinas';
  const weatherApiKey = Constants.expoConfig?.extra?.weatherApiKey || process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

  // Fetch freshness predictions when inventory items are loaded
  useEffect(() => {
    if (!loading && inventoryItems.length > 0 && weatherApiKey) {
      setFreshnessLoading(true);
      refreshFreshnessPredictions()
        .catch((error) => {
          console.error('Error refreshing freshness predictions:', error);
        })
        .finally(() => {
          setFreshnessLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, inventoryItems.length, city, weatherApiKey]);

  // Helper functions to calculate progress, time remaining, and status
  const calculateProgress = useCallback((createdAt: Date, expiresAt: Date): number => {
    const now = Date.now();
    const created = createdAt.getTime();
    const expires = expiresAt.getTime();
    const total = expires - created;
    if (total <= 0) return 0;
    const remaining = Math.max(0, expires - now);
    return Math.max(0, Math.min(1, remaining / total));
  }, []);

  const calculateTimeRemaining = useCallback((expiresAt: Date): string => {
    const now = Date.now();
    const diff = expiresAt.getTime() - now;
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}hrs`;
    return `${hours}hrs`;
  }, []);

  const getEstimatedRemaining = useCallback(
    (expiresAt?: Date) => {
      if (!expiresAt) return 'Unknown';
      return calculateTimeRemaining(expiresAt);
    },
    [calculateTimeRemaining]
  );

  const getStatus = useCallback((progress: number): 'Fresh' | 'Stale' | 'Expired' => {
    if (progress <= 0) return 'Expired';
    if (progress <= 0.5) return 'Stale';
    return 'Fresh';
  }, []);

  // Helper function to get freshness classification color
  const getFreshnessColor = useCallback((classification?: 'Fresh' | 'Stale' | 'Expired') => {
    if (!classification) return '#9E9E9E'; // Gray for unknown
    switch (classification) {
      case 'Fresh':
        return Colors.light.tint; // use app tint for fresh
      case 'Stale':
        return '#FF9800'; // Orange
      case 'Expired':
        return '#F44336'; // Red
      default:
        return '#9E9E9E';
    }
  }, []);
  const estimateTimeFromFreshness = (
    freshness: 'Fresh' | 'Stale' | 'Expired',
    timeInFridge: number, // in hours
    temp: number,
    humidity: number
  ): string => {
    let remainingHours = 0;
  
    if (freshness === 'Expired') {
      remainingHours = 0;
    } else if (freshness === 'Stale') {
      // Time left until Expired (72 hours max)
      remainingHours = 72 - timeInFridge;
    } else if (freshness === 'Fresh') {
      // Time left until Stale threshold
      if (temp > 10 || humidity > 80) {
        remainingHours = 24 - timeInFridge;
      } else {
        remainingHours = 48 - timeInFridge;
      }
    }
  
    if (remainingHours <= 0) return 'Expired';
  
    const days = Math.floor(remainingHours / 24);
    const hours = Math.round(remainingHours % 24);
  
    if (days > 0) return `${days}d ${hours}hrs`;
    return `${hours}hrs`;
  };
  // Calculate display values for all items once and memoize them
  // This ensures values are only calculated when inventoryItems change, not on every render
  const itemsWithDisplayData = useMemo(() => {
    return inventoryItems.map((item) => {
      const progress = calculateProgress(item.createdAt, item.expiresAt);
      const status = getStatus(progress);

      // Use actual expiresAt - createdAt math to estimate remaining time
      const displayTimeRemaining = item.expiresAt
        ? calculateTimeRemaining(item.expiresAt)
        : 'Unknown';

      return {
        ...item,
        displayProgress: progress,
        displayTimeRemaining,
        displayStatus: status,
      };
    });
  }, [inventoryItems, calculateProgress, getStatus, calculateTimeRemaining]);

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

  // Small presentational component for an inventory card to keep JSX simple
  // Short date formatter: MM/DD/YYYY
  const formatDateShort = (d?: Date) => {
    if (!d) return 'Unknown';
    try {
      const dt = new Date(d);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    } catch (e) {
      return String(d);
    }
  };

  const getStoragePillColor = (storage?: string) => {
    const s = (storage || '').toString().toUpperCase();
    switch (s) {
      case 'FREEZER':
        return '#3B82F6'; // blue-500
      case 'REFRIGERATOR':
        return '#10B981'; // green-500
      case 'PANTRY':
        return '#A16207'; // amber/brown
      default:
        return 'rgba(0,0,0,0.06)';
    }
  };

  const InventoryCard = ({ item, batchNo }: { item: any; batchNo: number }) => {
    return (
      <View style={styles.tileCard}>
        <View style={styles.tileCardRow}>
          <Image source={getIconSource(item.icon)} style={styles.cardIcon} />

          <View style={styles.cardMain}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              <View style={styles.batchAndStorage}>
                <View style={[styles.storagePill, { backgroundColor: getStoragePillColor(item.storageLocation || item.storage_location) }]}> 
                  <Text style={styles.storagePillText}>{(item.storageLocation || item.storage_location || 'UNKNOWN').toString().toUpperCase()}</Text>
                </View>
                <View style={[styles.batchBadge, { marginLeft: 8 }]}> 
                  <Text style={styles.batchBadgeText}>{`B${batchNo}`}</Text>
                </View>
              </View>
            </View>

            <ProgressBar progress={item.displayProgress} color={getFreshnessColor(item.displayStatus)} style={styles.cardProgress} />

            <Text style={styles.cardQty}>{`${item.count} ${item.unit ?? 'pcs'}`}</Text>

            <Text style={styles.cardDeliveredLabel}>Delivered on:</Text>
            <Text style={styles.cardEstimate}>{formatDateShort(item.createdAt)}</Text>
            <Text style={[styles.cardEstimate, { marginTop: 6 }]}>Est: {item.displayTimeRemaining}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.freshnessPill, { backgroundColor: getFreshnessColor(item.displayStatus) }]}>
            <Text style={styles.freshnessPillText}>{item.displayStatus}</Text>
          </View>

          {/* storage pill moved to the top-right next to the batch badge */}

          <TouchableOpacity
            style={[styles.removeButtonInline, updatingItems.has(item.id) && styles.smallButtonDisabled]}
            onPress={async () => {
              setUpdatingItems((prev) => new Set(prev).add(item.id));
              try {
                await removeInventoryItem(item.id);
              } catch (e) {
                console.error(e);
              } finally {
                setUpdatingItems((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
              }
            }}
            disabled={updatingItems.has(item.id)}
          >
            {updatingItems.has(item.id) ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.removeButtonText}>Remove</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Greeting */}
      <Text style={styles.greeting}>DASHBOARD</Text>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <PrimaryButton onPress={() => router.push('/add-inventory-item')}>ADD ITEM MANUALLY</PrimaryButton>
        <PrimaryButton
          onPress={() => router.push('/camera')}
          style={{ marginTop: 12, backgroundColor: '#f59e0b', shadowColor: '#f59e0b' }}
          textStyle={{ color: '#000' }}
        >
          USE COMPUTER VISION
        </PrimaryButton>
        <PrimaryButton onPress={() => router.push('/inventoryStats')} style={{ marginTop: 12 }}>INVENTORY STATISTICS</PrimaryButton>
      </View>

      {/* Inventory Items Section */}
      <Text style={styles.sectionTitle}>INVENTORY ITEMS</Text>

      {loading ? (
        <View style={styles.emptyInventory}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.emptyInventoryText}>Loading inventory...</Text>
        </View>
      ) : inventoryItems.length === 0 ? (
        <View style={styles.emptyInventory}>
          <Text style={styles.emptyInventoryText}>
            No inventory items yet. Tap "ADD ITEM" to add one!
          </Text>
        </View>
      ) : (
        <View style={styles.tilesContainer}>
          {itemsWithDisplayData.map((item, idx) => {
            const batchNo = batchNumberMap[item.id] ?? idx + 1;
            return <InventoryCard key={item.id} item={item} batchNo={batchNo} />;
          })}
        </View>
      )}

      {/* Freshness Prediction Info */}
      {!loading && inventoryItems.length > 0 && !weatherApiKey && (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            ⚠️ WeatherAPI key not configured. Freshness predictions are disabled.
          </Text>
        </View>
      )}

      
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
    alignItems: "center",
    marginTop: 30,
    marginBottom: 10,
    backgroundColor: 'rgba(244, 162, 97, 0.12)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 162, 97, 0.18)',
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    borderWidth: 0,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(17, 24, 28, 0.7)',
    marginTop: 4,
  },
  greeting: {
    fontSize: 18,
    marginTop: 24,
    marginBottom: 16,
    fontWeight: "700",
    color: 'black',
    letterSpacing: 0.3,
  },
  buttonContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 14,
    marginVertical: 8,
    minWidth: 280,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    fontWeight: "700",
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 14,
    color: 'black',
    letterSpacing: 0.3,
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tile: {
    width: '48%',
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 162, 97, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeAndFreshness: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tileIcon: {
    width: 40,
    height: 40,
    marginRight: 8,
    resizeMode: 'contain',
  },
  tileName: {
    fontWeight: '700',
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  tileProgress: {
    height: 8,
    borderRadius: 4,
    marginVertical: 8,
    backgroundColor: 'rgba(244, 162, 97, 0.12)',
  },
  tileTime: {
    fontSize: 12,
    color: 'rgba(17, 24, 28, 0.7)',
    marginBottom: 8,
  },
  tileLocation: {
    fontSize: 11,
    color: 'rgba(17,24,28,0.6)',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tileFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileActionsColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  tileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCount: {
    fontWeight: '700',
    marginHorizontal: 8,
    fontSize: 16,
    color: Colors.light.tint,
    minWidth: 28,
    textAlign: 'center',
    alignSelf: 'center',
  },
  tileRight: {
    alignItems: 'flex-end',
  },
  tileSmallButton: {
    backgroundColor: Colors.light.tint,
    width: 36,
    height: 36,
    marginHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tileRemoveButton: {
    backgroundColor: '#FF5252',
    width: '90%',
    paddingHorizontal: 0,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  itemCard: {
    marginBottom: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderLeftWidth: 5,
    borderLeftColor: Colors.light.tint,
    position: 'relative',
    borderWidth: 1,
    borderColor: "rgba(244, 162, 97, 0.18)",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  icon: {
    width: 50,
    height: 50,
    marginRight: 12,
    resizeMode: 'contain',
  },
  itemName: {
    fontWeight: "700",
    fontSize: 18,
    color: Colors.light.text,
    flex: 1,
    letterSpacing: 0.3,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginVertical: 10,
    backgroundColor: "rgba(244, 162, 97, 0.12)",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  timeLeft: {
    fontSize: 13,
    color: "rgba(17, 24, 28, 0.8)",
    fontWeight: "600",
    flex: 1,
  },
  statusTag: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  freshnessTag: {
    marginLeft: 4,
  },
  freshnessLoader: {
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#FFC107",
  },
  infoText: {
    fontSize: 12,
    color: "#856404",
    lineHeight: 18,
  },
  smallButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 25,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 36,
    alignItems: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  smallButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  countText: {
    fontWeight: "700",
    marginLeft: 12,
    fontSize: 18,
    color: Colors.light.tint,
    minWidth: 30,
    textAlign: "center",
  },
  smallButtonDisabled: {
    opacity: 0.5,
  },
  emptyInventory: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(244, 162, 97, 0.18)",
  },
  emptyInventoryText: {
    fontSize: 14,
    color: "rgba(17, 24, 28, 0.8)",
    textAlign: "center",
    fontStyle: "italic",
  },
  demandSection: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  largeIcon: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  demandText: {
    marginVertical: 12,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  demandButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 30,
    marginVertical: 8,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  demandButtonText: {
    fontWeight: "bold",
    color: "#FFFFFF",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  financesText: {
    marginTop: 12,
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  removeButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: '#FF5252',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  /* Card-style tile to match home design */
  tileCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  tileCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardIcon: { width: 72, height: 72, marginRight: 12, resizeMode: 'contain' },
  cardMain: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.text },
  batchBadge: { backgroundColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  batchBadgeText: { fontWeight: '800', color: '#000' },
  batchAndStorage: { flexDirection: 'row', alignItems: 'center' },
  cardProgress: { height: 8, borderRadius: 6, marginVertical: 8, backgroundColor: 'rgba(0,0,0,0.06)' },
  cardQty: { color: 'rgba(0,0,0,0.45)', fontSize: 14, marginBottom: 6 },
  cardDeliveredLabel: { fontWeight: '800', color: Colors.light.text, marginTop: 4 },
  cardEstimate: { fontWeight: '700', color: Colors.light.text, marginTop: 2 },
  cardFooter: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  freshnessPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  freshnessPillText: { color: '#fff', fontWeight: '800' },
  storagePillWrap: { marginLeft: 12 },
  storagePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  storagePillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  removeButtonInline: {
    backgroundColor: '#FF5252',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
