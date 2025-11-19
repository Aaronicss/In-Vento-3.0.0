import { Colors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { InventoryProvider } from '../contexts/InventoryContext';
import { OrdersProvider } from '../contexts/OrdersContext';

export default function RootLayout() {
  const router = useRouter();

  const Header = () => (
    <SafeAreaView style={styles.headerSafeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>IN-VENTO</Text>
        <TouchableOpacity
          style={styles.profile}
          onPress={() => router.push('/login')}
        >
          <MaterialIcons name="person" size={28} color={Colors.light.text} />
          <Text style={styles.profileLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <OrdersProvider>
      <InventoryProvider>
        {/* Force DefaultTheme (light) globally regardless of system settings */}
        <ThemeProvider value={DefaultTheme}>
          <Header />
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
});
