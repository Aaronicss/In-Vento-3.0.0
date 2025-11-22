import { supabase } from '../lib/supabase';

export async function upsertProfile({ id, email, display_name, phone }:
  { id: string; email: string; display_name?: string | null; phone?: string | null }
) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id, email, display_name: display_name || null, phone: phone || null });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('profiles.upsert error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('profiles.upsert threw:', err);
    return { data: null, error: err };
  }
}
