import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from './AppCard';
import { fs, scale, verticalScale } from '../utils/responsive';

export default function HealthSummaryCard({ latestReport, isDarkMode }) {
  const cardStyle = [styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }];
  const textStyle = [styles.title, isDarkMode && { color: '#f8fafc' }];
  const subStyle = [styles.subtitle, isDarkMode && { color: '#94a3b8' }];
  const emptyTextStyle = [styles.emptyText, isDarkMode && { color: '#64748b' }];

  if (!latestReport) {
    return (
      <AppCard style={cardStyle}>
        <Text style={textStyle}>Health Summary</Text>
        <Text style={emptyTextStyle}>
          No report analyzed yet. Start your first scan to view your health summary.
        </Text>
      </AppCard>
    );
  }

  const tests = latestReport.report?.tests || latestReport.tests || [];
  const total = tests.length;
  const normal = tests.filter(t => (t.status || '').toLowerCase() === 'normal').length;
  const abnormal = tests.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s === 'high' || s === 'very high' || s === 'low' || s === 'critical';
  }).length;
  const uncertain = total - normal - abnormal;

  return (
    <AppCard style={cardStyle}>
      <Text style={textStyle}>Latest Health Summary</Text>
      <Text style={subStyle}>
        Type: {latestReport.reportType || 'General Lab Report'}
      </Text>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Analyzed</Text>
          <Text style={[styles.value, styles.primaryColor]}>{total}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Normal</Text>
          <Text style={[styles.value, styles.greenColor]}>{normal}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Abnormal</Text>
          <Text style={[styles.value, styles.orangeColor]}>{abnormal}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>Review</Text>
          <Text style={[styles.value, isDarkMode ? { color: '#94a3b8' } : styles.grayColor]}>{uncertain}</Text>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: scale(16),
    borderRadius: 24,
    backgroundColor: '#fff',
    borderTopWidth: 4,
    borderTopColor: '#0ea5e9',
    marginBottom: verticalScale(16),
  },
  title: {
    fontSize: fs(16),
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fs(12),
    color: '#64748b',
    marginBottom: verticalScale(16),
    fontWeight: '500',
  },
  emptyText: {
    fontSize: fs(13),
    color: '#94a3b8',
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: fs(11),
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    fontSize: fs(22),
    fontWeight: '900',
  },
  primaryColor: { color: '#0ea5e9' },
  greenColor: { color: '#10b981' },
  orangeColor: { color: '#f59e0b' },
  grayColor: { color: '#64748b' },
});
