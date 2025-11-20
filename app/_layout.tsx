import { Colors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { InventoryProvider } from '../contexts/InventoryContext';
import { OrdersProvider } from '../contexts/OrdersContext';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Logout failed', e);
    } finally {
      setSidebarOpen(false);
      router.push('/login');
    }
  };

  const Header = () => (
    <SafeAreaView style={styles.headerSafeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>IN-VENTO</Text>
        <TouchableOpacity
          style={styles.profile}
          onPress={() => setSidebarOpen(true)}
        >
          <MaterialIcons name="person" size={28} color={Colors.light.text} />
          <Text style={styles.profileLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const segments = useSegments();
  const isLogin = segments.some((s) => s === 'login');

  return (
    <OrdersProvider>
      <InventoryProvider>
        {/* Force DefaultTheme (light) globally regardless of system settings */}
        <ThemeProvider value={DefaultTheme}>
          {!isLogin && <Header />}
          <Stack screenOptions={{ headerShown: false }}>
            {/* Login Screen */}
            <Stack.Screen name="login" />

            {/* Tabs Group (Dashboard) */}
            <Stack.Screen name="(tabs)" />

            {/* Add Inventory Item Screen */}
            <Stack.Screen name="add-inventory-item" />

            {/* Optional Modal */}
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>

          <StatusBar style="auto" />
          {sidebarOpen && (
            <View style={styles.overlayContainer} pointerEvents="box-none">
              <Pressable style={styles.overlay} onPress={() => setSidebarOpen(false)} />
              <View style={styles.sidebar}>
                <Text style={styles.sidebarTitle}>Account</Text>
                <TouchableOpacity style={styles.sidebarButton} onPress={() => { setSidebarOpen(false); router.push('/accounts'); }}>
                  <Text style={styles.sidebarButtonText}>Accounts Management</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sidebarButton} onPress={() => { setSidebarOpen(false); router.push('/preferences'); }}>
                  <Text style={styles.sidebarButtonText}>Preferences</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sidebarButton, styles.logoutButton]} onPress={handleLogout}>
                  <Text style={[styles.sidebarButtonText, { color: '#fff' }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ThemeProvider>
      </InventoryProvider>
    </OrdersProvider>
  );
}

const styles = StyleSheet.create({
  headerSafeArea: { backgroundColor: Colors.light.tint, paddingBottom: 8 },
  header: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.light.tint,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profile: {
    alignItems: 'center',
  },
  profileLabel: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebar: {
    width: 260,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  sidebarButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  sidebarButtonText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: Colors.light.tint,
  },
});
