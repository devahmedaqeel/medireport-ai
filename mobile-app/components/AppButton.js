import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fs } from '../utils/responsive';

export default function AppButton({ 
  title, 
  onPress, 
  loading, 
  disabled, 
  style, 
  textStyle, 
  variant = 'primary' 
}) {
  const btnStyle = [
    styles.button,
    variant === 'secondary' ? styles.secondaryButton : styles.primaryButton,
    (disabled || loading) && styles.disabledButton,
    style
  ];

  const txtStyle = [
    styles.text,
    variant === 'secondary' ? styles.secondaryText : styles.primaryText,
    textStyle
  ];

  return (
    <TouchableOpacity
      style={btnStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#475569' : '#fff'} />
      ) : (
        <Text style={txtStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row'
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  disabledButton: {
    opacity: 0.6
  },
  text: {
    fontSize: fs(16),
    fontWeight: '800'
  },
  primaryText: {
    color: '#fff'
  },
  secondaryText: {
    color: '#475569'
  }
});
