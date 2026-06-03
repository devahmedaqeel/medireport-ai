import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from './AppCard';
import { fs, scale, verticalScale } from '../utils/responsive';

export default function ManualReviewCard({ latestReport, isDarkMode = false }) {
  if (!latestReport) {
    return null;
  }

  const confidenceVal = latestReport.extractionConfidence || latestReport.report?.extractionConfidence || 0.85;
  const isLowConfidence = confidenceVal < 0.75;

  if (!isLowConfidence) {
    return null;
  }

  const colors = {
    bg: isDarkMode ? '#3f170e' : '#fff7ed',
    border: isDarkMode ? '#7f1d1d' : '#fdba74',
    title: isDarkMode ? '#fca5a5' : '#9a3412',
    message: isDarkMode ? '#fca5a5' : '#c2410c',
  };

  return (
    <AppCard style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={[styles.title, { color: colors.title }]}>Manual Review Required</Text>
      </View>
      <Text style={[styles.message, { color: colors.message }]}>
        Some values in your latest report could not be read with high certainty by the OCR parser. 
        Please carefully cross-check the numbers shown in the app against your physical lab printout.
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    padding: scale(14),
    borderRadius: 20,
    marginBottom: verticalScale(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: {
    fontSize: fs(16),
    marginRight: 6,
  },
  title: {
    fontSize: fs(14),
    fontWeight: '900',
    color: '#9a3412',
  },
  message: {
    fontSize: fs(12),
    color: '#c2410c',
    lineHeight: 18,
    fontWeight: '500',
  },
});
