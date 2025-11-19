import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { InventoryProvider } from '../contexts/InventoryContext';
import { OrdersProvider } from '../contexts/OrdersContext';

export default function RootLayout() {
  return (
    <OrdersProvider>
      <InventoryProvider>
        {/* Force DefaultTheme (light) globally regardless of system settings */}
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            {/* Login Screen */}
            <Stack.Screen name="login" />

            {/* Tabs Group (Dashboard) */}
            <Stack.Screen name="(tabs)" />

            {/* Take Order Screen */}
            <Stack.Screen name="take-order" />

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
