import PrimaryButton from '@/components/PrimaryButton';
import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { useOrders } from '../../contexts/OrdersContext';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { orders, loading, removeOrder, updateOrderProgress } = useOrders();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [loggingOut, setLoggingOut] = useState(false);

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              router.replace('/login');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to logout');
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  // Update time every second for UI, but sync to database less frequently
  useEffect(() => {
    // Update UI every second
    const uiInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    // Sync progress to database every 30 seconds (less frequent to reduce DB load)
    const dbInterval = setInterval(() => {
      if (orders.length === 0) return;
      const now = Date.now();
      orders.forEach(async (order) => {
        const elapsedSeconds = (now - order.createdAt.getTime()) / 1000;
        const timeLimit = 300; // 5 minutes in seconds (adjust as needed)
        const newProgress = Math.max(0, 1 - elapsedSeconds / timeLimit);
        // Only update if progress changed significantly (more than 1%)
        if (Math.abs(newProgress - order.progress) > 0.01) {
          try {
            await updateOrderProgress(order.id, newProgress);
          } catch (error) {
            console.error('Error updating order progress:', error);
          }
        }
      });
    }, 30000); // Update database every 30 seconds

    return () => {
      clearInterval(uiInterval);
      clearInterval(dbInterval);
    };
  }, [orders, updateOrderProgress]);

  // Helper function to get icon based on item name
  const getItemIcon = (itemName: string) => {
    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('burger') || lowerName.includes('cheeseburger')) {
      return require('../../assets/burger.png');
    }
    if (lowerName.includes('drink') || lowerName.includes('coke') || lowerName.includes('cola')) {
      return require('../../assets/drink.png');
    }
    // Default to burger icon if no match
    return require('../../assets/burger.png');
  };

  // Helper function to calculate current progress based on elapsed time
  const calculateCurrentProgress = (order: any) => {
    const now = Date.now();
    const elapsedSeconds = (now - order.createdAt.getTime()) / 1000;
    const timeLimit = 300; // 5 minutes in seconds (adjust as needed)
    return Math.max(0, 1 - elapsedSeconds / timeLimit);
  };

  // Helper function to get progress bar color based on progress
  // Progress decreases from 1.0 to 0.0, so colors are reversed
  const getProgressColor = (progress: number) => {
    if (progress > 0.7) return 'green';  // High progress = green
    if (progress > 0.3) return 'orange';  // Medium progress = orange
    return 'red';  // Low progress = red
  };

  return (
    <ScrollView style={styles.container}>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <PrimaryButton onPress={() => router.push('/take-order')}>TAKE ORDER</PrimaryButton>
      </View>

      {/* Orders Section */}
      <Text style={styles.sectionTitle}>ORDERS</Text>

      {loading ? (
        <View style={styles.emptyOrders}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.emptyOrdersText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyOrders}>
          <Text style={styles.emptyOrdersText}>No orders yet. Tap "TAKE ORDER" to create one!</Text>
        </View>
      ) : (
        orders.map((order) => {
          const currentProgress = calculateCurrentProgress(order);
          return (
            <View key={order.id} style={styles.orderSection}>
              <Text style={styles.tableTitle}>TABLE #{order.tableNumber}</Text>
              <ProgressBar 
                progress={currentProgress} 
                color={getProgressColor(currentProgress)} 
                style={styles.progressBar} 
              />
            {order.items.map((item, itemIndex) => (
              <View key={item.id} style={styles.itemRow}>
                <Image source={getItemIcon(item.name)} style={styles.itemIcon} />
                <Text style={styles.itemText}>
                  {item.quantity} {item.name}
                </Text>
                {itemIndex === order.items.length - 1 && (
                  <TouchableOpacity 
                    style={[styles.doneButton, processingOrders.has(order.id) && styles.buttonDisabled]}
                    onPress={async () => {
                      setProcessingOrders((prev) => new Set(prev).add(order.id));
                      try {
                        await removeOrder(order.id);
                      } catch (error) {
                        console.error('Error removing order:', error);
                      } finally {
                        setProcessingOrders((prev) => {
                          const next = new Set(prev);
                          next.delete(order.id);
                          return next;
                        });
                      }
                    }}
                    disabled={processingOrders.has(order.id)}
                  >
                    {processingOrders.has(order.id) ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.doneText}>Done</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
            </View>
          );
        })
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
    alignItems: 'center', 
    marginTop: 30,
    marginBottom: 10,
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FF5252',
    borderRadius: 8,
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  greeting: { 
    fontSize: 18, 
    marginTop: 24, 
    marginBottom: 16,
    fontWeight: '700',
    color: 'black',
    letterSpacing: 0.3,
  },
  buttonContainer: { 
    alignItems: 'center',
    marginVertical: 10,
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 14,
    marginVertical: 6,
    minWidth: 280,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: { 
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    marginTop: 24, 
    marginBottom: 12,
    color: Colors.light.text,
    letterSpacing: 0.3,
  },
  orderSection: { 
    marginBottom: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
    borderWidth: 1,
    borderColor: 'rgba(244, 162, 97, 0.18)',
  },
  tableTitle: { 
    fontWeight: '800', 
    color: Colors.light.tint,
    fontSize: 16,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  progressBar: { 
    height: 10, 
    borderRadius: 10, 
    marginVertical: 8,
    backgroundColor: 'rgba(244, 162, 97, 0.12)',
  },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 6,
    paddingVertical: 4,
  },
  itemIcon: { 
    width: 28, 
    height: 28, 
    marginRight: 12,
    resizeMode: "contain",
  },
  itemText: { 
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
  },
  doneButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  doneText: { 
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alertSection: { 
    marginBottom: 20,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  alertTitle: { 
    fontWeight: '800', 
    marginTop: 4,
    marginBottom: 8,
    fontSize: 16,
    color: '#FF9800',
    letterSpacing: 0.3,
  },
  alertRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    marginTop: 4,
  },
  warningBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  warningText: { 
    color: '#FFFFFF', 
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeLeft: { 
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  smallButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 36,
    alignItems: 'center',
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stockCount: { 
    fontWeight: '700', 
    marginLeft: 8,
    fontSize: 15,
    color: Colors.light.text,
    minWidth: 24,
    textAlign: 'center',
  },
  emptyOrders: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(244, 162, 97, 0.18)',
  },
  emptyOrdersText: {
    fontSize: 14,
    color: 'rgba(17, 24, 28, 0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
