import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOW_STOCK_KEY = 'low_stock_threshold_v1';
const DEFAULT_THRESHOLD = 5;
const RECIPE_PRICES_KEY = 'recipe_prices_v1';

// Default recipe prices in Philippine Peso (₱)
export const DEFAULT_PRICES: Record<string, number> = {
  Cheeseburger: 120,
  'Classic Hamburger': 100,
  'Deluxe Cheeseburger': 150,
  'Garden Cheeseburger': 110,
  'Double Cheese Burger': 140,
  'Fully Loaded': 160,
};

async function readLocalThreshold(): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(LOW_STOCK_KEY);
    if (!v) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  } catch (e) {
    console.warn('preferencesService: failed to read local threshold', e);
    return null;
  }
}

async function writeLocalThreshold(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LOW_STOCK_KEY, String(value));
  } catch (e) {
    console.warn('preferencesService: failed to write local threshold', e);
  }
}

async function readLocalPrices(): Promise<Record<string, number> | null> {
  try {
    const v = await AsyncStorage.getItem(RECIPE_PRICES_KEY);
    if (!v) return null;
    const parsed = JSON.parse(v);
    return parsed;
  } catch (e) {
    console.warn('preferencesService: failed to read local prices', e);
    return null;
  }
}

async function writeLocalPrices(prices: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(RECIPE_PRICES_KEY, JSON.stringify(prices));
  } catch (e) {
    console.warn('preferencesService: failed to write local prices', e);
  }
}

/**
 * Read low-stock threshold. Prefer per-user Supabase storage (user_metadata),
 * fallback to local AsyncStorage. If a local value exists and Supabase has no
 * value yet, migrate the local value into Supabase so settings persist across devices.
 */
export async function getLowStockThreshold(): Promise<number> {
  try {
    // Try to read from dedicated user_preferences table
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) console.warn('preferencesService: supabase.getUser error', userErr);
    const user = userData?.user;

    if (user && user.id) {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('low_stock_threshold')
        .eq('user_id', user.id)
        .single();

      if (!error && data && (data as any).low_stock_threshold !== undefined) {
        const n = Number((data as any).low_stock_threshold);
        if (!isNaN(n)) return n;
      }

      // if no row found, try to migrate local value into the table
      const local = await readLocalThreshold();
      if (local !== null) {
        try {
          await supabase.from('user_preferences').upsert({ user_id: user.id, low_stock_threshold: local });
        } catch (e) {
          console.warn('preferencesService: failed to migrate local threshold to user_preferences table', e);
        }
        return local;
      }
    }

    // fallback to local storage or default
    const local = await readLocalThreshold();
    if (local !== null) return local;
    return DEFAULT_THRESHOLD;
  } catch (e) {
    console.warn('preferencesService.getLowStockThreshold error', e);
    return DEFAULT_THRESHOLD;
  }
}

/**
 * Set low-stock threshold. Persist per-user in Supabase when available, and
 * always write a local copy as fallback.
 */
export async function setLowStockThreshold(value: number): Promise<void> {
  try {
    // write local copy
    await writeLocalThreshold(value);
    // try to write to dedicated user_preferences table
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('preferencesService: supabase.getUser error', error);
        return;
      }
      const user = data?.user;
      if (!user) return;

      await supabase.from('user_preferences').upsert({ user_id: user.id, low_stock_threshold: value });
    } catch (e) {
      console.warn('preferencesService: failed to persist threshold to user_preferences table', e);
    }
  } catch (e) {
    console.warn('preferencesService.setLowStockThreshold error', e);
    throw e;
  }
}

/**
 * Get per-recipe prices. Returns DEFAULT_PRICES merged with any stored per-user overrides.
 * Preference is: user_preferences.recipe_prices (JSON) -> local AsyncStorage -> defaults
 */
export async function getRecipePrices(): Promise<Record<string, number>> {
  try {
    // try Supabase per-user table
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) console.warn('preferencesService: supabase.getUser error', userErr);
    const user = userData?.user;

    let stored: Record<string, number> | null = null;
    if (user && user.id) {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('recipe_prices')
        .eq('user_id', user.id)
        .single();
      if (!error && data && (data as any).recipe_prices) {
        stored = (data as any).recipe_prices as Record<string, number>;
      }
      // If no stored prices, try migrating from local
      if (!stored) {
        const local = await readLocalPrices();
        if (local) {
          try {
            await supabase.from('user_preferences').upsert({ user_id: user.id, recipe_prices: local });
            stored = local;
          } catch (e) {
            console.warn('preferencesService: failed to migrate local prices to user_preferences table', e);
          }
        }
      }
    }

    if (!stored) {
      const local = await readLocalPrices();
      if (local) stored = local;
    }

    // merge defaults with stored overrides
    const merged: Record<string, number> = { ...DEFAULT_PRICES };
    if (stored) {
      Object.keys(stored).forEach((k) => {
        const n = Number(stored[k]);
        if (!isNaN(n)) merged[k] = n;
      });
    }
    return merged;
  } catch (e) {
    console.warn('preferencesService.getRecipePrices error', e);
    return { ...DEFAULT_PRICES };
  }
}

/**
 * Persist per-recipe prices. Writes local AsyncStorage and tries to upsert into Supabase user_preferences.recipe_prices
 */
export async function setRecipePrices(prices: Record<string, number>): Promise<void> {
  try {
    await writeLocalPrices(prices);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('preferencesService: supabase.getUser error', error);
        return;
      }
      const user = data?.user;
      if (!user) return;
      await supabase.from('user_preferences').upsert({ user_id: user.id, recipe_prices: prices });
    } catch (e) {
      console.warn('preferencesService: failed to persist recipe prices to user_preferences table', e);
    }
  } catch (e) {
    console.warn('preferencesService.setRecipePrices error', e);
    throw e;
  }
}

export { DEFAULT_THRESHOLD };
