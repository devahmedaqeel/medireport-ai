import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from './AppCard';
import { fs, scale, verticalScale } from '../utils/responsive';

export default function ReportConfidenceCard({ latestReport, isDarkMode }) {
  if (!latestReport) {
    return null;
  }

  // extractionConfidence typically comes as a float, e.g. 0.85
  const confidenceVal = latestReport.extractionConfidence || latestReport.report?.extractionConfidence || 0.85;
  const percentage = Math.round(confidenceVal * 100);

  let ocrQuality = 'Good';
  let qualityColor = '#10b981';
  if (percentage < 65) {
    ocrQuality = 'Poor';
    qualityColor = '#ef4444';
  } else if (percentage < 80) {
    ocrQuality = 'Fair';
    qualityColor = '#f59e0b';
  }

  const reviewRequired = percentage < 75;

  return (
    <AppCard style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <Text style={[styles.title, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>AI Extraction & OCR Quality</Text>
      
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Confidence</Text>
          <Text style={[styles.value, { color: percentage > 75 ? '#0ea5e9' : '#f59e0b' }]}>
            {percentage}%
          </Text>
        </View>
        
        <View style={styles.gridItem}>
          <Text style={styles.label}>OCR Quality</Text>
          <Text style={[styles.value, { color: qualityColor }]}>
            {ocrQuality}
          </Text>
        </View>
        
        <View style={styles.gridItem}>
          <Text style={styles.label}>Manual Review</Text>
          <Text style={[styles.value, { color: reviewRequired ? '#ef4444' : '#10b981' }]}>
            {reviewRequired ? 'Required' : 'Not Required'}
          </Text>
        </View>
      </View>

      {reviewRequired && (
        <View style={[styles.warningContainer, isDarkMode && { backgroundColor: '#3f170e', borderColor: '#7f1d1d' }]}>
          <Text style={[styles.warningText, isDarkMode && { color: '#fca5a5' }]}>
            ⚠️ Some values had low OCR readability. Please compare the extracted numbers with your original physical report.
          </Text>
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: scale(16),
    borderRadius: 24,
    backgroundColor: '#fff',
    marginBottom: verticalScale(16),
  },
  title: {
    fontSize: fs(14),
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: verticalScale(16),
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: fs(10),
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: fs(16),
    fontWeight: '900',
  },
  warningContainer: {
    marginTop: verticalScale(12),
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: scale(10),
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  warningText: {
    fontSize: fs(11),
    color: '#b45309',
    lineHeight: 16,
    fontWeight: '500',
  },
});
