import Dropdown from '@/components/Dropdown';
import { Colors } from '@/constants/theme';
import { DEFAULT_PRICES, getRecipePrices } from '@/services/preferencesService';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useInventory } from '../../contexts/InventoryContext';
import { OrderItem, useOrders } from '../../contexts/OrdersContext';

export default function TakeOrderScreen() {
  const router = useRouter();
  const { addOrder, orders } = useOrders();
  const { inventoryItems, updateInventoryItem, refreshInventory, decrementIngredients } = useInventory();
  const [items, setItems] = useState<OrderItem[]>([
    { id: 'item-1', name: '', quantity: 1 },
  ]);

  // Recipe definitions (ingredient names should match inventory `name` values)
  const RECIPES: { [key: string]: Array<{ ingredient: string; qty: number }> } = {
    'Cheeseburger': [{ ingredient: 'BEEF', qty: 1 }, { ingredient: 'CHEESE', qty: 1 }, { ingredient: 'BURGER BUN', qty: 1 }],
    'Classic Hamburger': [{ ingredient: 'BEEF', qty: 1 }, { ingredient: 'LETTUCE', qty: 10 }, { ingredient: 'TOMATO', qty: 1 }, { ingredient: 'ONION', qty: 1 }, { ingredient: 'PICKLES', qty: 8 }, { ingredient: 'BURGER BUN', qty: 1 }],
    'Deluxe Cheeseburger': [{ ingredient: 'BEEF', qty: 1 }, { ingredient: 'CHEESE', qty: 1 }, { ingredient: 'LETTUCE', qty: 10 }, { ingredient: 'TOMATO', qty: 1 }, { ingredient: 'ONION', qty: 1 }, { ingredient: 'PICKLES', qty: 8 }, { ingredient: 'BURGER BUN', qty: 1 }],
    'Garden Cheeseburger': [{ ingredient: 'BEEF', qty: 1 }, { ingredient: 'CHEESE', qty: 1 }, { ingredient: 'LETTUCE', qty: 10 }, { ingredient: 'TOMATO', qty: 1 }, { ingredient: 'BURGER BUN', qty: 1 }],
    'Double Cheese Burger': [{ ingredient: 'BEEF', qty: 1 }, { ingredient: 'CHEESE', qty: 2 }, { ingredient: 'BURGER BUN', qty: 1 }],
    'Fully Loaded': [{ ingredient: 'BEEF', qty: 1 }, { ingredient: 'LETTUCE', qty: 10 }, { ingredient: 'CHEESE', qty: 1 }, { ingredient: 'TOMATO', qty: 1 }, { ingredient: 'ONION', qty: 1 }, { ingredient: 'PICKLES', qty: 8 }, { ingredient: 'BURGER BUN', qty: 1 }],
  };

  // Compute recipes that are currently available given inventory counts
  const availableRecipes = useMemo(() => {
    const available: string[] = [];
    Object.keys(RECIPES).forEach((rName) => {
      const recipe = RECIPES[rName];
      const ok = recipe.every((req) => {
        const found = inventoryItems.find(i => i.name.toUpperCase() === req.ingredient.toUpperCase());
        return !!found && found.count >= req.qty;
      });
      if (ok) available.push(rName);
    });
    return available;
  }, [inventoryItems]);

  // Preview state for recipe guide (shows ingredients and shortages before selecting an item)
  const [previewRecipe, setPreviewRecipe] = useState<string | null>(null);
  const [previewQty, setPreviewQty] = useState<number>(1);
  const [recipePrices, setRecipePrices] = useState<Record<string, number>>({ ...DEFAULT_PRICES });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await getRecipePrices();
        if (!mounted) return;
        setRecipePrices(p);
      } catch (e) {
        // ignore, keep defaults
      }
    })();
    return () => { mounted = false; };
  }, []);

  const computeRecipeSummary = (rName: string, qty = 1) => {
    const recipe = RECIPES[rName];
    if (!recipe) return {} as Record<string, { needed: number; available: number; shortage: number }>;
    const map: Record<string, { needed: number; available: number; shortage: number }> = {};
    recipe.forEach((r) => {
      const key = r.ingredient.toUpperCase();
      map[key] = map[key] || { needed: 0, available: 0, shortage: 0 };
      map[key].needed += r.qty * qty;
    });
    Object.keys(map).forEach((ing) => {
      const totalAvailable = inventoryItems
        .filter(i => i.name && i.name.toUpperCase() === ing)
        .reduce((sum, row) => sum + (row.count || 0), 0);
      map[ing].available = totalAvailable;
      map[ing].shortage = Math.max(0, map[ing].needed - totalAvailable);
    });
    return map;
  };

  // Ensure inventory is loaded when this screen mounts (some environments may not have fetched yet)
  useEffect(() => {
    if (!inventoryItems || inventoryItems.length === 0) {
      // don't await to avoid blocking UI; fire-and-forget
      refreshInventory().catch((e) => console.warn('refreshInventory failed:', e));
    }
  }, []);

  const addItem = () => {
    setItems([...items, { id: `item-${Date.now()}`, name: '', quantity: 1 }]);
  };

  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: 'name' | 'quantity', value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, [field]: field === 'quantity' ? Number(value) : value } : item
      )
    );
  };

  const [loading, setLoading] = useState(false);

  const nextCustomerNumber = React.useMemo(() => {
    if (!orders || orders.length === 0) return 1;
    const max = Math.max(...orders.map((o) => o.tableNumber || 0));
    return max + 1;
  }, [orders]);

  const handleConfirm = async () => {
    // use auto-incremented customer number
    const customerNumber = Number(nextCustomerNumber);

    const validItems = items.filter((item) => item.name.trim() !== '' && item.quantity > 0);
    if (validItems.length === 0) {
      Alert.alert('No Items', 'Please add at least one item to the order.');
      return;
    }

    // Build aggregated usage map BEFORE creating the order so we can validate availability
    const usageMap: Record<string, number> = {};
    validItems.forEach((it) => {
      const recipe = RECIPES[it.name as string];
      if (!recipe) return;
      recipe.forEach((r) => {
        usageMap[r.ingredient] = (usageMap[r.ingredient] || 0) + r.qty * it.quantity;
      });
    });

    // Verify sum across all inventory rows for each ingredient meets the needed quantity
    const insufficient: string[] = [];
    for (const ing of Object.keys(usageMap)) {
      const needed = usageMap[ing];
      const totalAvailable = inventoryItems
        .filter(i => i.name.toUpperCase() === ing.toUpperCase())
        .reduce((sum, row) => sum + (row.count || 0), 0);
      if (totalAvailable < needed) insufficient.push(`${ing} (need ${needed}, have ${totalAvailable})`);
    }

    if (insufficient.length > 0) {
      Alert.alert('Insufficient Inventory', `Cannot place order. Missing: ${insufficient.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      // Add order to context
      await addOrder(customerNumber, validItems);

      // After adding the order, decrement inventory counts based on recipe usage
      try {
        console.log('Order usageMap:', usageMap);

        // Use the context helper to decrement across rows (handles multiple rows and expiry ordering)
        await decrementIngredients(usageMap);
      } catch (err) {
        console.error('Error decrementing inventory after order:', err);
      }

      Alert.alert('Order Added', `Order for Customer #${customerNumber} has been added!`, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add order');
    } finally {
      setLoading(false);
    }
  };

  const formatPHP = (n: number) => `₱${n.toFixed(2)}`;

  const orderTotal = useMemo(() => {
    const validItems = items.filter((item) => item.name && item.name.trim() !== '' && item.quantity > 0);
    return validItems.reduce((sum, it) => {
      const price = recipePrices[it.name as string] ?? 0;
      return sum + price * (it.quantity || 0);
    }, 0);
  }, [items, recipePrices]);

  // Compute aggregate ingredient totals for selected recipes and compare to inventory
  const ingredientSummary = useMemo(() => {
    const usage: Record<string, { needed: number; available: number; shortage: number }> = {};

    // Aggregate needed quantities from selected items
    items.forEach((it) => {
      if (!it.name || it.quantity <= 0) return;
      const recipe = RECIPES[it.name as string];
      if (!recipe) return;
      recipe.forEach((r) => {
        const key = r.ingredient.toUpperCase();
        usage[key] = usage[key] || { needed: 0, available: 0, shortage: 0 };
        usage[key].needed += r.qty * it.quantity;
      });
    });

    // Fill available counts from inventory and compute shortage
    Object.keys(usage).forEach((ing) => {
      const totalAvailable = inventoryItems
        .filter(i => i.name && i.name.toUpperCase() === ing)
        .reduce((sum, row) => sum + (row.count || 0), 0);
      usage[ing].available = totalAvailable;
      usage[ing].shortage = Math.max(0, usage[ing].needed - totalAvailable);
    });

    return usage;
  }, [items, inventoryItems]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TAKE ORDER</Text>
        <Text style={styles.subtitle}>Enter order details below</Text>
      </View>

      {/* Table Number Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Customer Number</Text>
        <TextInput
          style={[styles.input, { opacity: 0.9 }]}
          value={String(nextCustomerNumber).padStart(3, '0')}
          editable={false}
        />
      </View>

      {/* Items Section */}
      {/* Recipe Guide: preview recipes and missing ingredients before selecting items */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Recipe Guide</Text>
        </View>
        <View style={{ marginBottom: 8 }}>
          {Object.keys(RECIPES).map((r) => {
            const summary = computeRecipeSummary(r, 1);
            const totalShortage = Object.values(summary).reduce((s, v) => s + (v.shortage || 0), 0);
            return (
              <TouchableOpacity
                key={r}
                style={styles.recipeRow}
                onPress={() => {
                  setPreviewRecipe(r === previewRecipe ? null : r);
                  setPreviewQty(1);
                }}
              >
                <Text style={styles.recipeName}>{r}</Text>
                <View style={styles.recipeBadgeContainer}>
                  {totalShortage > 0 ? (
                    <Text style={styles.recipeBadgeMissing}>Missing {totalShortage}</Text>
                  ) : (
                    <Text style={styles.recipeBadgeOk}>OK</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {previewRecipe && (
          <View style={styles.summaryTile}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.summaryTitle}>{previewRecipe} — Ingredients (per unit)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setPreviewQty(Math.max(1, previewQty - 1))}
                  style={styles.qtySmallBtn}
                >
                  <Text style={{ color: '#fff' }}>-</Text>
                </TouchableOpacity>
                <Text style={{ fontWeight: '700' }}>{previewQty}</Text>
                <TouchableOpacity
                  onPress={() => setPreviewQty(previewQty + 1)}
                  style={styles.qtySmallBtn}
                >
                  <Text style={{ color: '#fff' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            {Object.keys(computeRecipeSummary(previewRecipe, previewQty)).map((ing) => {
              const s = computeRecipeSummary(previewRecipe, previewQty)[ing];
              return (
                <View key={ing} style={styles.summaryRow}>
                  <Text style={styles.summaryIngredient}>{ing}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.summaryAmount}>{s.available}</Text>
                    <Text style={{ color: 'rgba(0,0,0,0.45)'}}> / {s.needed}</Text>
                    {s.shortage > 0 && <Text style={styles.summaryMissing}>Missing {s.shortage}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Order Items</Text>
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <Text style={styles.addButtonText}>+ Add Item</Text>
            </TouchableOpacity>
        </View>

        {items.map((item, index) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNumber}>Item {index + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeItem(item.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.input, { paddingHorizontal: 0, paddingVertical: 0 }]}> 
              <Dropdown
                value={item.name}
                options={
                  availableRecipes.length === 0
                    ? [{ label: 'No recipes available (low inventory)', value: '' }]
                    : [{ label: 'Select a recipe...', value: '' }, ...availableRecipes.map(r => ({ label: r, value: r }))]
                }
                onChange={(v) => updateItem(item.id, 'name', v)}
              />
            </View>

            {/* show per-item price (from preferences) */}
            <View style={{ marginTop: 8, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(0,0,0,0.6)', fontWeight: '700' }}>Price</Text>
              <Text style={{ fontWeight: '800' }}>{formatPHP(recipePrices[item.name as string] ?? 0)}</Text>
            </View>

            <View style={styles.quantityContainer}>
              <Text style={styles.quantityLabel}>Quantity:</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))
                  }
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateItem(item.id, 'quantity', item.quantity + 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Confirm Button */}
      <View style={styles.orderTotalRow}>
        <Text style={styles.orderTotalLabel}>Order Total</Text>
        <Text style={styles.orderTotalValue}>{formatPHP(orderTotal)}</Text>
      </View>
      {/* Ingredients Summary Tile (shows needed vs available and marks missing items) */}
      {Object.keys(ingredientSummary).length > 0 && (
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTitle}>Ingredients Needed</Text>
          {Object.keys(ingredientSummary).map((ing) => {
            const s = ingredientSummary[ing];
            return (
              <View key={ing} style={styles.summaryRow}>
                <Text style={styles.summaryIngredient}>{ing}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.summaryAmount}>{s.available}</Text>
                    <Text style={{ color: 'rgba(0,0,0,0.45)'}}> / {s.needed}</Text>
                  {s.shortage > 0 && <Text style={styles.summaryMissing}>Missing {s.shortage}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <TouchableOpacity 
        style={[styles.confirmButton, loading && styles.buttonDisabled]} 
        onPress={handleConfirm}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.confirmButtonText}>CONFIRM ORDER</Text>
        )}
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
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
    marginBottom: 24,
    backgroundColor: Colors.light.headerBg,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.headerText,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: 'black',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 12,
    color: Colors.light.text,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.tint,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.tint,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FF5252',
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quantityLabel: {
    fontSize: 14,
    color: 'rgba(17, 24, 28, 0.8)',
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    backgroundColor: Colors.light.tint,
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    minWidth: 30,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  summaryTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.light.tint,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)'
  },
  summaryIngredient: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 14,
    color: 'rgba(17,24,28,0.8)',
    fontWeight: '700',
  },
  summaryMissing: {
    marginLeft: 8,
    color: '#d63333',
    fontWeight: '700',
    fontSize: 13,
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 6,
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
  },
  orderTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.light.tint,
  },
  recipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  recipeBadgeContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  recipeBadgeMissing: {
    backgroundColor: '#fff2f2',
    color: '#d63333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '700',
  },
  recipeBadgeOk: {
    backgroundColor: '#ecfdf5',
    color: '#0f5132',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '700',
  },
  qtySmallBtn: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: 'rgba(17, 24, 28, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
