import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from './AppCard';
import StatusBadge from './StatusBadge';
import { fs, scale, verticalScale } from '../utils/responsive';

export default function CriticalAlertsCard({ latestReport, isDarkMode }) {
  const cardStyle = [styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }];
  const textStyle = [styles.title, isDarkMode && { color: '#f8fafc' }];
  const subStyle = [styles.subtitle, isDarkMode && { color: '#ef4444' }];
  const emptyTextStyle = [styles.emptyText, isDarkMode && { color: '#10b981' }];

  if (!latestReport) {
    return (
      <AppCard style={cardStyle}>
        <Text style={textStyle}>Attention Watchlist</Text>
        <Text style={emptyTextStyle}>All clear! No abnormal markers.</Text>
      </AppCard>
    );
  }

  const tests = latestReport.report?.tests || latestReport.tests || [];
  const abnormal = tests.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s === 'high' || s === 'very high' || s === 'low' || s === 'critical';
  });

  if (abnormal.length === 0) {
    return (
      <AppCard style={cardStyle}>
        <Text style={textStyle}>Attention Watchlist</Text>
        <Text style={emptyTextStyle}>All clear! No abnormal markers detected in this report.</Text>
      </AppCard>
    );
  }

  return (
    <AppCard style={cardStyle}>
      <Text style={textStyle}>Attention Watchlist</Text>
      <Text style={subStyle}>Markers requiring closer medical attention</Text>
      
      <View style={styles.list}>
        {abnormal.map((item, idx) => (
          <View key={idx} style={[styles.alertRow, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.testName, isDarkMode && { color: '#f8fafc' }]}>{item.testName}</Text>
              <StatusBadge status={item.status} />
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.valueText, isDarkMode && { color: '#94a3b8' }]}>
                Observed: <Text style={[styles.boldValue, isDarkMode && { color: '#f8fafc' }]}>{item.value} {item.unit}</Text>
              </Text>
              <Text style={[styles.rangeText, isDarkMode && { color: '#64748b' }]}>
                Ref Range: {item.rangeLow} - {item.rangeHigh} {item.unit}
              </Text>
            </View>
            {item.possibleIndication ? (
              <Text style={[styles.explanation, isDarkMode && { backgroundColor: '#1e293b', borderLeftColor: '#f97316', color: '#cbd5e1' }]}>
                💡 {item.possibleIndication.replace(/indicates/gi, 'may suggest').replace(/shows/gi, 'might indicate')} (Please verify with a qualified doctor).
              </Text>
            ) : (
              <Text style={[styles.explanation, isDarkMode && { backgroundColor: '#1e293b', borderLeftColor: '#f97316', color: '#cbd5e1' }]}>
                💡 Out-of-range value which may suggest a possible concern. Please compare with original copy and verify with a qualified doctor.
              </Text>
            )}
          </View>
        ))}
      </View>
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
    fontSize: fs(16),
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fs(12),
    color: '#ef4444',
    marginBottom: verticalScale(16),
    fontWeight: '600',
  },
  emptyText: {
    fontSize: fs(13),
    color: '#10b981',
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 4,
  },
  list: {
    gap: verticalScale(16),
  },
  alertRow: {
    backgroundColor: '#fffcfc',
    borderRadius: 16,
    padding: scale(12),
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: fs(14),
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  valueText: {
    fontSize: fs(12),
    color: '#64748b',
  },
  boldValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  rangeText: {
    fontSize: fs(12),
    color: '#94a3b8',
  },
  explanation: {
    fontSize: fs(11),
    color: '#475569',
    lineHeight: 16,
    fontStyle: 'italic',
    backgroundColor: '#f8fafc',
    padding: scale(8),
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
});
