import { Colors } from '@/constants/theme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';

type Props = TouchableOpacityProps & {
  children: React.ReactNode;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export default function PrimaryButton({ children, loading = false, style, textStyle, disabled, ...rest }: Props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      style={[styles.button, disabled ? styles.disabled : null, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.text, textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.light.primaryButtonBg,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#F2912E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.light.primaryButtonText,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
});
