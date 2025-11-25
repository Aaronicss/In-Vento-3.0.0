import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { upsertProfile } from '../services/profileService';

export default function AccountsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState('');
  const [phoneEdit, setPhoneEdit] = useState('');

  const validatePhone = (raw: string) => {
    const trimmed = (raw || '').trim().replace(/\s+/g, '');
    if (!trimmed) return true; // allow empty
    // simple E.164-ish check: optional leading +, then 7-15 digits
    return /^\+?\d{7,15}$/.test(trimmed);
  };

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const currentUser = userData.user ?? null;
      setUser(currentUser);

      if (currentUser?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        if (profileError && profileError.code !== 'PGRST116') {
          // PGRST116 = no rows? keep tolerant
          // eslint-disable-next-line no-console
          console.warn('profile fetch error:', profileError);
        }
        setProfile(profileData ?? null);
        setDisplayNameEdit(profileData?.display_name ?? currentUser?.user_metadata?.display_name ?? '');
        setPhoneEdit(profileData?.phone ?? currentUser?.phone ?? currentUser?.user_metadata?.phone ?? '');
      } else {
        setProfile(null);
        setDisplayNameEdit('');
        setPhoneEdit('');
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('loadUser error', err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Account</Text>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.light.tint} />
      ) : error ? (
        <View>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayNameEdit}
            onChangeText={setDisplayNameEdit}
            editable={isEditing}
            placeholder="Display name"
            placeholderTextColor="rgba(17,24,28,0.45)"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phoneEdit}
            onChangeText={setPhoneEdit}
            editable={isEditing}
            keyboardType="phone-pad"
            placeholder="Phone (e.g. +1234567890)"
            placeholderTextColor="rgba(17,24,28,0.45)"
          />

          {!isEditing ? (
            <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => setIsEditing(true)}>
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1, marginRight: 8 }]} onPress={async () => {
                // Save
                setLoading(true);
                try {
                  // Normalize phone
                  let normalizedPhone = phoneEdit?.trim() || '';
                  if (normalizedPhone) {
                    normalizedPhone = normalizedPhone.replace(/\s+/g, '');
                    if (!normalizedPhone.startsWith('+')) normalizedPhone = `+${normalizedPhone}`;
                  }

                  // upsert profile
                  await upsertProfile({
                    id: user.id,
                    email: user.email,
                    display_name: displayNameEdit || null,
                    phone: normalizedPhone || null,
                  });

                  // validate phone before saving (client-side)
                  if (phoneEdit && !validatePhone(phoneEdit)) {
                    Alert.alert('Invalid phone', 'Please enter a valid phone number (digits only, optionally prefixed with +).');
                    setLoading(false);
                    return;
                  }

                  Alert.alert('Success', 'Profile updated');
                  setIsEditing(false);
                  await loadUser();
                } catch (e: any) {
                  console.warn('save profile error', e);
                  Alert.alert('Error', e?.message || 'Failed to save profile');
                } finally {
                  setLoading(false);
                }
              }}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn, { flex: 1 }]} onPress={() => {
                // Cancel edits: reset to current profile values
                setDisplayNameEdit(profile?.display_name ?? user?.user_metadata?.display_name ?? '');
                setPhoneEdit(profile?.phone ?? user?.phone ?? user?.user_metadata?.phone ?? '');
                setIsEditing(false);
              }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.backButton, styles.fullWidthButton]} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#d9534f' }]}
          onPress={async () => {
            try {
              setLoading(true);
              const { error } = await supabase.auth.signOut();
                if (error) throw error;
                // clear any locally stored biometric tokens
                try {
                  await SecureStore.deleteItemAsync('sb_refresh_token');
                  await SecureStore.deleteItemAsync('sb_access_token');
                } catch (e) { /* ignore */ }
                // navigate to login
                router.replace('/login');
            } catch (err: any) {
              console.warn('signOut error', err);
              Alert.alert('Sign out failed', err?.message || String(err));
            } finally {
              setLoading(false);
            }
          }}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(17,24,28,0.7)',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: 'rgba(17,24,28,0.6)',
    marginTop: 8,
  },
  value: {
    fontSize: 16,
    color: Colors.light.text,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  backButton: {
    marginTop: 12,
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#b00020',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    color: Colors.light.text,
  },
  fullWidthButton: {
    width: '100%',
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: Colors.light.tint,
  },
  cancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  cancelBtnText: {
    color: Colors.light.tint,
    fontWeight: '700',
  },
});
