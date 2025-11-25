import { Colors } from '@/constants/theme';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { upsertProfile } from '../services/profileService';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animated background burger image
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // try biometric unlock if a refresh token is stored
    (async () => {
      try {
        const storedAccess = await SecureStore.getItemAsync('sb_access_token');
        const storedRefresh = await SecureStore.getItemAsync('sb_refresh_token');
        const tokenToUse = (storedAccess && storedRefresh) ? { access: storedAccess, refresh: storedRefresh } : (storedRefresh ? { access: null, refresh: storedRefresh } : null);
        if (tokenToUse) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock to sign in' });
            if (res.success) {
              // try to restore session using stored tokens
              try {
                if (tokenToUse.access && tokenToUse.refresh) {
                  await supabase.auth.setSession({ access_token: tokenToUse.access, refresh_token: tokenToUse.refresh } as any);
                } else if (tokenToUse.refresh) {
                  // fallback: still try with refresh only
                  await supabase.auth.setSession({ refresh_token: tokenToUse.refresh } as any);
                }
                router.push('/(tabs)/home');
              } catch (err) {
                // ignore and allow manual login
                // eslint-disable-next-line no-console
                console.warn('biometric restore failed', err);
              }
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('biometric check error', e);
      }
    })();

    const scaleSeq = Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]);

    const rotateSeq = Animated.sequence([
      Animated.timing(rotateAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]);

    const loop = Animated.loop(Animated.parallel([scaleSeq, rotateSeq]));
    loop.start();
    return () => loop.stop();
  }, [scaleAnim, rotateAnim]);

  // Login with Supabase
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        Alert.alert('Login Successful', 'Welcome to In-Vento!');
        // Offer biometric storage of refresh token for faster unlock
        try {
          const refresh = data.session?.refresh_token;
          if (refresh) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && isEnrolled) {
              Alert.alert('Enable Biometric Login', 'Would you like to enable fingerprint/biometric unlock for faster login?', [
                { text: 'No' },
                { text: 'Yes', onPress: async () => {
                  try {
                    await SecureStore.setItemAsync('sb_refresh_token', refresh);
                    // eslint-disable-next-line no-console
                    console.log('Refresh token saved for biometric unlock');
                  } catch (err) {
                    // eslint-disable-next-line no-console
                    console.warn('Failed to save refresh token', err);
                  }
                }},
              ]);
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('biometric setup error', e);
        }
        router.push('/(tabs)/home'); // navigate to the tabs-based home screen
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Please check your email or password.');
    } finally {
      setLoading(false);
    }
  };

  // Sign up with Supabase
  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Normalize phone to E.164-like form: remove spaces and ensure leading '+' if provided
      let normalizedPhone = phone?.trim() || '';
      if (normalizedPhone) {
        normalizedPhone = normalizedPhone.replace(/\s+/g, '');
        if (!normalizedPhone.startsWith('+')) normalizedPhone = `+${normalizedPhone}`;
      }
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            display_name: displayName || undefined,
            phone: normalizedPhone || undefined,
          },
        },
      });

      // Log response for debugging (inspect data.user and metadata)
      // This helps verify whether Supabase accepted the `phone` metadata.
      // You can view this output in Metro/Expo logs or device console.
      // eslint-disable-next-line no-console
      console.log('signUp response:', { data, error });

      if (error) throw error;

      if (data.user) {
        Alert.alert('Sign Up Successful', 'Your account has been created! Please check your email to verify your account.');

        // If your project uses a `profiles` table, try to persist display name and phone there.
        // This operation is guarded so it won't crash if the table doesn't exist.
        try {
          await upsertProfile({
            id: data.user.id,
            email: email,
            display_name: displayName || null,
            phone: normalizedPhone || null,
          });
        } catch (upsertError) {
          // eslint-disable-next-line no-console
          console.warn('profiles upsert failed (maybe table missing):', upsertError);
        }

        // Also try to set the top-level `phone` field on the Auth user (so it appears under Users.phone)
        // This requires a valid session (we have one from signUp when email confirmation returns a session).
        if (normalizedPhone) {
          try {
            const { error: updateError } = await supabase.auth.updateUser({ phone: normalizedPhone });
            if (updateError) {
              // eslint-disable-next-line no-console
              console.warn('auth.updateUser phone failed:', updateError);
            }
          } catch (updateErr) {
            // eslint-disable-next-line no-console
            console.warn('auth.updateUser threw:', updateErr);
          }
        }

        // Optionally navigate to home after sign up
        // router.push('/(tabs)/home');
      }
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IN-VENTO:</Text>
      <Text style={styles.subtitle}>Intelligent Inventory System</Text>

      <Text style={styles.loginText}>{isSignUp ? 'USER SIGN UP' : 'USER LOGIN'}</Text>

      <Animated.Image
        source={require('../assets/burger.png')} // replace with your burger image
        style={[styles.image, styles.animatedImage, { transform: [{ scale: scaleAnim }, { rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }] }]}
      />

      <View style={styles.form}>

      {isSignUp && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor="rgba(17,24,28,0.45)"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Phone (e.g. +1234567890)"
            placeholderTextColor="rgba(17,24,28,0.45)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        </>
      )}


      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="rgba(17,24,28,0.45)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="rgba(17,24,28,0.45)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="password"
      />

      </View>

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={isSignUp ? handleSignUp : handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.light.tint} />
        ) : (
          <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Login'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.switchButton} 
        onPress={() => setIsSignUp(!isSignUp)}
      >
        <Text style={styles.switchText}>
          {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    position: 'relative',
    paddingHorizontal: 20,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 5, color: '#FFFFFF' },
  subtitle: { fontSize: 14, marginBottom: 20, color: 'rgba(255,255,255,0.9)' },
  loginText: { fontSize: 18, fontWeight: '700', marginBottom: 20, color: '#FFFFFF' },
  image: { width: 200, height: 200, borderRadius: 20, marginBottom: 20, resizeMode: "contain" },
  animatedImage: {
    position: 'absolute',
    top: 80,
    width: 320,
    height: 320,
    opacity: 0.12,
    zIndex: 0,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  form: {
    zIndex: 1,
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginVertical: 8,
    textAlign: 'center',
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    fontSize: 15,
  },
  button: {
    width: '60%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: { textAlign: 'center', fontWeight: '700', color: Colors.light.tint, fontSize: 16 },
  switchButton: {
    marginTop: 15,
    padding: 10,
  },
  switchText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
});
