import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOW_STOCK_KEY = 'low_stock_threshold_v1';
const DEFAULT_THRESHOLD = 5;

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

export { DEFAULT_THRESHOLD };
