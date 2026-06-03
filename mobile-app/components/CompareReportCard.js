import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppCard from './AppCard';
import { fs, scale, verticalScale } from '../utils/responsive';

export default function CompareReportCard({ reports = [], isDarkMode }) {
  const cardStyle = [styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }];
  const textStyle = [styles.title, isDarkMode && { color: '#f8fafc' }];
  const subStyle = [styles.subtitle, isDarkMode && { color: '#94a3b8' }];
  const emptyTextStyle = [styles.emptyText, isDarkMode && { color: '#64748b' }];

  if (!reports || reports.length < 2) {
    return (
      <AppCard style={cardStyle}>
        <Text style={textStyle}>Biomarker Comparison</Text>
        <Text style={emptyTextStyle}>
          Compare will appear after two reports are scanned and saved.
        </Text>
      </AppCard>
    );
  }

  const latest = reports[0]?.report?.report?.tests || reports[0]?.report?.tests || reports[0]?.tests || [];
  const previous = reports[1]?.report?.report?.tests || reports[1]?.report?.tests || reports[1]?.tests || [];

  const prevMap = new Map();
  previous.forEach(t => {
    if (t.testName) prevMap.set(t.testName.toLowerCase().trim(), t);
  });

  let improved = 0;
  let worsened = 0;
  let unchanged = 0;
  const list = [];

  latest.forEach(t => {
    if (!t.testName) return;
    const name = t.testName.toLowerCase().trim();
    if (prevMap.has(name)) {
      const prevTest = prevMap.get(name);
      const prevStatus = (prevTest.status || '').toLowerCase();
      const currStatus = (t.status || '').toLowerCase();

      let change = 'unchanged';
      if (prevStatus !== 'normal' && currStatus === 'normal') {
        improved++;
        change = 'improved';
      } else if (prevStatus === 'normal' && currStatus !== 'normal' && currStatus !== 'unknown') {
        worsened++;
        change = 'worsened';
      } else {
        unchanged++;
      }

      list.push({
        name: t.testName,
        prevVal: prevTest.value,
        currVal: t.value,
        unit: t.unit,
        change,
      });
    }
  });

  const totalCompared = improved + worsened + unchanged;

  return (
    <AppCard style={cardStyle}>
      <Text style={textStyle}>Compare with Last Report</Text>
      <Text style={subStyle}>
        Comparing latest scan against report from{' '}
        {new Date(reports[1].createdAt).toLocaleDateString()}
      </Text>

      {totalCompared === 0 ? (
        <Text style={emptyTextStyle}>
          No matching biomarkers found between the last two reports to compare.
        </Text>
      ) : (
        <View>
          <View style={[styles.statRow, isDarkMode && { backgroundColor: '#0f172a' }]}>
            <View style={styles.statItem}>
              <View style={[styles.dot, styles.bgGreen]} />
              <Text style={[styles.statLabel, isDarkMode && { color: '#cbd5e1' }]}>Improved: {improved}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.dot, styles.bgRed]} />
              <Text style={[styles.statLabel, isDarkMode && { color: '#cbd5e1' }]}>Worsened: {worsened}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.dot, styles.bgGray]} />
              <Text style={[styles.statLabel, isDarkMode && { color: '#cbd5e1' }]}>Unchanged: {unchanged}</Text>
            </View>
          </View>

          {list.slice(0, 3).map((item, idx) => (
            <View key={idx} style={[styles.compareRow, isDarkMode && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.markerName, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.valuesGroup}>
                <Text style={[styles.prevVal, isDarkMode && { color: '#64748b' }]}>{item.prevVal} ➔ </Text>
                <Text
                  style={[
                    styles.currVal,
                    item.change === 'improved'
                      ? styles.greenText
                      : item.change === 'worsened'
                      ? styles.redText
                      : (isDarkMode ? { color: '#cbd5e1' } : styles.grayText),
                  ]}
                >
                  {item.currVal} {item.unit}
                </Text>
              </View>
            </View>
          ))}
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
    fontSize: fs(15),
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fs(12),
    color: '#64748b',
    marginBottom: verticalScale(14),
  },
  emptyText: {
    fontSize: fs(13),
    color: '#94a3b8',
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(14),
    backgroundColor: '#f8fafc',
    padding: scale(10),
    borderRadius: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bgGreen: { backgroundColor: '#10b981' },
  bgRed: { backgroundColor: '#ef4444' },
  bgGray: { backgroundColor: '#94a3b8' },
  statLabel: {
    fontSize: fs(11),
    fontWeight: '700',
    color: '#475569',
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  markerName: {
    fontSize: fs(13),
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 10,
  },
  valuesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prevVal: {
    fontSize: fs(12),
    color: '#94a3b8',
  },
  currVal: {
    fontSize: fs(12),
    fontWeight: '800',
  },
  greenText: { color: '#10b981' },
  redText: { color: '#ef4444' },
  grayText: { color: '#475569' },
});
