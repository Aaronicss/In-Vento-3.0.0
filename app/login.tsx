import { Colors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

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
        router.push('/(tabs)/home'); // navigate to home screen
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
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        Alert.alert('Sign Up Successful', 'Your account has been created! Please check your email to verify your account.');
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

      <Image
        source={require('../assets/burger.png')} // replace with your burger image
        style={styles.image}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="password"
      />

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={isSignUp ? handleSignUp : handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
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
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 5, color: Colors.light.text },
  subtitle: { fontSize: 14, marginBottom: 20, color: 'rgba(17, 24, 28, 0.7)' },
  loginText: { fontSize: 18, fontWeight: '700', marginBottom: 20, color: Colors.light.tint },
  image: { width: 200, height: 200, borderRadius: 20, marginBottom: 20, resizeMode: "contain" },
  input: {
    width: '80%',
    backgroundColor: '#FFF7ED',
    padding: 14,
    borderRadius: 12,
    marginVertical: 8,
    textAlign: 'center',
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: 'rgba(244, 162, 97, 0.15)',
    fontSize: 15,
  },
  button: {
    width: '60%',
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: { textAlign: 'center', fontWeight: '700', color: '#FFFFFF', fontSize: 16 },
  switchButton: {
    marginTop: 15,
    padding: 10,
  },
  switchText: {
    textAlign: 'center',
    color: 'rgba(17, 24, 28, 0.6)',
    fontSize: 14,
  },
});
