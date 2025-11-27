import Constants from 'expo-constants';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getBatchFreshnessPredictions } from '../services/freshnessService';

// Icon mapping
export const iconMap: { [key: string]: any } = {
  burgerbun: require('../assets/burgerbun.png'),
  beef: require('../assets/beef.png'),
  lettuce: require('../assets/lettuce.png'),
  pickles: require('../assets/pickles.png'), // placeholder: reuse lettuce image until a dedicated pickle asset is provided
  cheese: require('../assets/cheese.png'),
  tomato: require('../assets/tomato.png'),
  onion: require('../assets/onion.png'),
  burger: require('../assets/burger.png'),
  drink: require('../assets/drink.png'),
};

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  storageLocation?: string;
  unit?: string;
  count: number;
  progress: number;
  timeRemaining: string;
  status: 'Fresh' | 'Warning';
  createdAt: Date;
  expiresAt: Date;
  userId: string;
  freshnessClassification?: 'Fresh' | 'Stale' | 'Expired';
  freshnessLoading?: boolean;
  timeInFridge: number; // in hours
  temperature?: number; // in °C
  humidity?: number;
}

export const getIconSource = (iconKey: string): any => {
  return iconMap[iconKey.toLowerCase()] || iconMap.burger;
};

interface InventoryContextType {
  inventoryItems: InventoryItem[];
  loading: boolean;
  // shelfLifeDays is optional if expiresAt is provided
  addInventoryItem: (name: string, icon: string, count: number, shelfLifeDays?: number, expiresAt?: Date, unit?: string, storageLocation?: string) => Promise<void>;
  updateInventoryItem: (itemId: string, updates: Partial<InventoryItem>) => Promise<void>;
  removeInventoryItem: (itemId: string) => Promise<void>;
  incrementCount: (itemId: string) => Promise<void>;
  decrementCount: (itemId: string) => Promise<void>;
  // Decrement multiple ingredients based on an aggregated usage map: { INGREDIENT_NAME: qty }
  decrementIngredients: (usageMap: Record<string, number>) => Promise<void>;
  refreshInventory: () => Promise<void>;
  refreshFreshnessPredictions: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Helpers
const calculateTimeRemaining = (expiresAt: Date): string => {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}hrs`;
  return `${hours}hrs`;
};

const calculateProgress = (createdAt: Date, expiresAt: Date): number => {
  const now = new Date().getTime();
  const created = createdAt.getTime();
  const expires = expiresAt.getTime();
  
  if (now >= expires) return 0;
  if (now <= created) return 1;
  
  return (expires - now) / (expires - created);
};

const getStatus = (progress: number): 'Fresh' | 'Warning' => {
  return progress > 0.5 ? 'Fresh' : 'Warning';
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ TypeScript-safe loading of Expo Constants
  const extra = Constants.expoConfig?.extra as { weatherCity: string; weatherApiKey: string } | undefined;
  const weatherCity = extra?.weatherCity ?? '';
  const weatherApiKey = extra?.weatherApiKey ?? '';

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInventoryItems([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory items:', error);
        setLoading(false);
        return;
      }

      const items: InventoryItem[] = (data || []).map((item) => {
        const createdAt = new Date(item.created_at);
        const expiresAt = new Date(item.expires_at);
        const progress = calculateProgress(createdAt, expiresAt);
        const timeRemaining = calculateTimeRemaining(expiresAt);
        const status = getStatus(progress);

        // Normalize unit: accept only known units, fallback to 'pcs' for safety
        const knownUnits = ['pcs', 'g', 'slices'];
        const rawUnit = (item.unit || '').toString();
        const normalizedUnit = knownUnits.includes(rawUnit) ? rawUnit : 'pcs';

        return {
          id: item.id,
          name: item.name,
          icon: item.icon,
          storageLocation: item.storage_location,
          unit: normalizedUnit,
          count: item.count,
          progress,
          timeRemaining,
          status,
          createdAt,
          expiresAt,
          userId: item.user_id,
          timeInFridge: item.time_in_fridge || 0,
        };
      });

      setInventoryItems(items);
    } catch (error) {
      console.error('Error in fetchInventoryItems:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryItems();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchInventoryItems();
    });

    return () => subscription.unsubscribe();
  }, []);

  // CRUD functions
  const addInventoryItem = async (name: string, icon: string, count: number, shelfLifeDays?: number, expiresAt?: Date, unit?: string, storageLocation?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const createdAt = new Date();
      // If explicit expiresAt provided, use it; otherwise compute from shelfLifeDays (default 7 days)
      const finalExpiresAt = expiresAt ? new Date(expiresAt) : new Date();
      const daysToAdd = typeof shelfLifeDays === 'number' && !isNaN(shelfLifeDays) ? shelfLifeDays : 7;
      if (!expiresAt) finalExpiresAt.setDate(finalExpiresAt.getDate() + daysToAdd);

      const insertObj: any = {
        user_id: user.id,
        name,
        icon,
        count,
        created_at: createdAt.toISOString(),
        expires_at: finalExpiresAt.toISOString(),
      };

      // include unit if provided
      if (unit) insertObj.unit = unit;

      // include storage location if provided in updates (backwards-compatible)
      // Note: callers may pass storageLocation via additional parameter in future patches
      // We check if arguments length > 5 to read storageLocation from arguments
      // storageLocation param is the sixth parameter; prefer explicit param
      if (storageLocation) insertObj.storage_location = storageLocation;

      const { error } = await supabase.from('inventory_items').insert([insertObj]);

      if (error) throw error;
      await fetchInventoryItems();
    } catch (error) {
      console.error('Error in addInventoryItem:', error);
      throw error;
    }
  };

  const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.icon !== undefined) updateData.icon = updates.icon;
      if (updates.count !== undefined) updateData.count = updates.count;
      if ((updates as any).storageLocation !== undefined) updateData.storage_location = (updates as any).storageLocation;
      if ((updates as any).unit !== undefined) updateData.unit = (updates as any).unit;
      if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt.toISOString();
      if (updates.createdAt !== undefined) updateData.created_at = updates.createdAt.toISOString();

      const { error } = await supabase.from('inventory_items').update(updateData).eq('id', itemId);
      if (error) throw error;
      await fetchInventoryItems();
    } catch (error) {
      console.error('Error in updateInventoryItem:', error);
      throw error;
    }
  };

  const removeInventoryItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', itemId);
      if (error) throw error;
      await fetchInventoryItems();
    } catch (error) {
      console.error('Error in removeInventoryItem:', error);
      throw error;
    }
  };

  const incrementCount = async (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) await updateInventoryItem(itemId, { count: item.count + 1 });
  };

  const decrementCount = async (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      const newCount = Math.max(0, item.count - 1);
      if (newCount === 0) {
        // remove the item when it reaches 0
        await removeInventoryItem(itemId);
      } else {
        await updateInventoryItem(itemId, { count: newCount });
      }
    }
  };

  // Decrement across multiple inventory rows for each ingredient.
  // This consumes from the earliest-expiring rows first (FIFO by expiry) until the needed quantity is satisfied.
  const decrementIngredients = async (usageMap: Record<string, number>) => {
    try {
      // Work on a snapshot of current inventory items
      const snapshot = [...inventoryItems];

      for (const ingredientName of Object.keys(usageMap)) {
        let needed = usageMap[ingredientName];
        if (!needed || needed <= 0) continue;

        // Find matching items (case-insensitive) with available count > 0, sorted by expiresAt ascending
        const matches = snapshot
          .filter(i => i.name.toUpperCase() === ingredientName.toUpperCase() && i.count > 0)
          .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

        for (const row of matches) {
          if (needed <= 0) break;
          const take = Math.min(row.count, needed);
          const newCount = Math.max(0, row.count - take);

          // Update DB for this row. If newCount === 0, delete the row instead.
          if (newCount === 0) {
            const { error } = await supabase.from('inventory_items').delete().eq('id', row.id);
            if (error) {
              console.error('Error deleting inventory row', row.id, error);
            } else {
              // reflect deletion in our snapshot
              row.count = 0;
              needed -= take;
            }
          } else {
            const { error } = await supabase.from('inventory_items').update({ count: newCount }).eq('id', row.id);
            if (error) {
              console.error('Error decrementing inventory row', row.id, error);
            } else {
              // also update our local snapshot so subsequent iterations use updated counts
              row.count = newCount;
              needed -= take;
            }
          }
        }
      }

      // Refresh the in-memory list once after all updates
      await fetchInventoryItems();
    } catch (error) {
      console.error('Error in decrementIngredients:', error);
      throw error;
    }
  };

  // Refresh freshness predictions using Expo Constants
  const refreshFreshnessPredictions = async () => {
    try {
      const currentItems = [...inventoryItems];
      if (currentItems.length === 0) return;

      setInventoryItems(prevItems => prevItems.map(item => ({ ...item, freshnessLoading: true })));

      const inputs = currentItems.map(item => ({
        ingredientType: item.name,
        addedAt: item.createdAt,
        city: weatherCity,
        weatherApiKey: weatherApiKey,
      }));

      const predictions = await getBatchFreshnessPredictions(inputs);

      const itemIdMap = new Map(currentItems.map((item, idx) => [item.id, idx]));

      setInventoryItems(prevItems =>
        prevItems.map(item => {
          const originalIndex = itemIdMap.get(item.id);
          const classification =
            originalIndex !== undefined && originalIndex < predictions.length
              ? predictions[originalIndex]?.classification
              : undefined;

          return { ...item, freshnessClassification: classification, freshnessLoading: false };
        })
      );
    } catch (error) {
      console.error('Error refreshing freshness predictions:', error);
      setInventoryItems(prevItems => prevItems.map(item => ({ ...item, freshnessLoading: false })));
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        inventoryItems,
        loading,
        addInventoryItem,
        updateInventoryItem,
        removeInventoryItem,
        incrementCount,
        decrementCount,
        refreshInventory: fetchInventoryItems,
        refreshFreshnessPredictions,
        decrementIngredients,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within an InventoryProvider');
  return context;
}
