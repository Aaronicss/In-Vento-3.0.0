import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useInventory } from '@/contexts/InventoryContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const scheme: "light" | "dark" =
  useColorScheme() === "dark" ? "dark" : "light";

  const { inventoryItems } = useInventory();

  const alerts = inventoryItems.map((it) => {
    const now = Date.now();
    const created = it.createdAt.getTime();
    const expires = it.expiresAt.getTime();
    const total = expires - created;
    const remaining = Math.max(0, expires - now);
    const progress = total <= 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
    const severity: 'critical' | 'warning' | 'ok' = progress <= 0.15 ? 'critical' : progress <= 0.4 ? 'warning' : 'ok';
    return { progress, severity };
  }).filter(a => a.severity !== 'ok');

  const alertsCount = alerts.length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;


  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.headerText,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.7)',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          backgroundColor: Colors.light.headerBg,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', color: Colors.light.headerText },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 28, height: 28 }}>
              <IconSymbol size={24} name="house.fill" color={color} />
              {alertsCount > 0 && (
                <View style={{ position: 'absolute', right: -8, top: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: criticalCount > 0 ? '#e63946' : Colors[scheme].tint, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{alertsCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="inventory" color={color} />,
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
        }}
      />

      <Tabs.Screen
        name="take-order"
        options={{
          title: 'Take Order',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="cart.fill" color={color} />,
        }}
      />
      {/* Alerts and Statistics are now top-level app pages (in `app/`) so they are removed from the tabs layout */}
    </Tabs>
  );
}
