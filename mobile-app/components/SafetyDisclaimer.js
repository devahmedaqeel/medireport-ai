import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fs } from '../utils/responsive';
import { useTheme } from './ThemeContext';

export default function SafetyDisclaimer({ style }) {
  const { isDarkMode } = useTheme();

  const colors = {
    bg: isDarkMode ? '#3f170e' : '#fff',
    border: isDarkMode ? '#7f1d1d' : '#fee2e2',
    text: isDarkMode ? '#fca5a5' : '#b91c1c',
  };

  return (
    <View style={[styles.disclaimerBox, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
      <Text style={[styles.disclaimerText, { color: colors.text }]}>
        ⚠️ MEDICAL DISCLAIMER: This is not a diagnosis. Please consult a qualified doctor.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimerBox: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fee2e2',
    marginTop: 24,
    marginBottom: 16
  },
  disclaimerText: {
    fontSize: fs(11),
    color: '#b91c1c',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '700'
  }
});
