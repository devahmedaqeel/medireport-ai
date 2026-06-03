import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fs } from '../utils/responsive';

export default function StatusBadge({ status, style, textStyle }) {
  const getDetails = (val) => {
    const s = (val || '').toLowerCase().trim();
    if (s === 'normal' || s === 'low risk') return { color: '#10b981', bg: '#ecfdf5', label: val || 'Normal' };
    if (s === 'low' || s === 'moderate' || s === 'moderate risk') return { color: '#f59e0b', bg: '#fffbeb', label: val || 'Low' };
    if (s === 'high' || s === 'high risk') return { color: '#f97316', bg: '#fff7ed', label: val || 'High' };
    if (s === 'very high' || s === 'critical' || s === 'critical risk') return { color: '#b91c1c', bg: '#fee2e2', label: val || 'Critical' };
    return { color: '#64748b', bg: '#f1f5f9', label: val || 'Unknown' };
  };

  const details = getDetails(status);

  return (
    <View style={[styles.badge, { backgroundColor: details.bg }, style]}>
      <Text style={[styles.text, { color: details.color }, textStyle]}>
        {details.label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  text: {
    fontSize: fs(10),
    fontWeight: '900',
    letterSpacing: 0.5
  }
});
