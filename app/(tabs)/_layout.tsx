import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const scheme: "light" | "dark" =
  useColorScheme() === "dark" ? "dark" : "light";


  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[scheme].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          backgroundColor: Colors[scheme].background,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
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
