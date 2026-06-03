import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppCard from './AppCard';
import StatusBadge from './StatusBadge';
import { fs, scale, verticalScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { calculateHealthScore, getScoreColor } from '../utils/health';

export default function RecentReportTimeline({ reports = [], onSelectReport, isDarkMode }) {
  const cardStyle = [styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }];
  const textStyle = [styles.title, isDarkMode && { color: '#f8fafc' }];
  const emptyTextStyle = [styles.emptyText, isDarkMode && { color: '#64748b' }];

  if (!reports || reports.length === 0) {
    return (
      <AppCard style={cardStyle}>
        <Text style={textStyle}>Recent Analysis</Text>
        <Text style={emptyTextStyle}>
          No reports yet. Your first analysis will appear here.
        </Text>
      </AppCard>
    );
  }

  const items = reports.slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isDarkMode && { color: '#94a3b8' }]}>Recent Analysis History</Text>
      
      <View style={styles.timeline}>
        {items.map((item, idx) => {
          const reportData = item.report || {};
          const isLast = idx === items.length - 1;
          const date = new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          const itemScore = calculateHealthScore(reportData);

          return (
            <View key={idx} style={styles.timelineRow}>
              {/* Timeline Indicator Column */}
              <View style={styles.indicatorCol}>
                <View style={[styles.timelineDot, isDarkMode && { backgroundColor: '#334155' }]}>
                  <Ionicons name="document-text" size={14} color="#0ea5e9" />
                </View>
                {!isLast && <View style={[styles.timelineLine, isDarkMode && { backgroundColor: '#334155' }]} />}
              </View>

              {/* Card Column */}
              <TouchableOpacity
                style={[styles.timelineCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
                onPress={() => onSelectReport(reportData)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.reportType, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>
                    {reportData.reportType || 'General Lab Report'}
                  </Text>
                  <View style={styles.badgeRow}>
                    <StatusBadge status={reportData.overallRisk || 'Green'} />
                    {itemScore !== null && (
                      <View style={[styles.timelineScoreBadge, { backgroundColor: getScoreColor(itemScore) + '15' }]}>
                        <Text style={[styles.timelineScoreText, { color: getScoreColor(itemScore) }]}>
                          ★ {itemScore}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <Text style={[styles.reportDate, isDarkMode && { color: '#64748b' }]}>{date}</Text>
                
                <Text style={[styles.reportSummary, isDarkMode && { color: '#cbd5e1' }]} numberOfLines={2}>
                  {reportData.englishExplanation || 'Analysis complete. Tap to view detailed marker levels.'}
                </Text>

                <View style={styles.detailsBtn}>
                  <Text style={styles.detailsBtnText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={12} color="#0ea5e9" />
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: verticalScale(20),
    paddingHorizontal: scale(4),
  },
  sectionTitle: {
    fontSize: fs(14),
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: verticalScale(16),
  },
  card: {
    padding: scale(16),
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: fs(13),
    color: '#94a3b8',
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 4,
  },
  timeline: {
    paddingLeft: scale(4),
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: verticalScale(8),
  },
  indicatorCol: {
    alignItems: 'center',
    marginRight: scale(12),
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginTop: -4,
    marginBottom: -12,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    marginBottom: verticalScale(12),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportType: {
    fontSize: fs(14),
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  reportDate: {
    fontSize: fs(11),
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 8,
  },
  reportSummary: {
    fontSize: fs(12),
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 10,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  detailsBtnText: {
    fontSize: fs(11),
    fontWeight: '800',
    color: '#0ea5e9',
    marginRight: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineScoreBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: 6,
  },
  timelineScoreText: {
    fontSize: fs(9),
    fontWeight: '800',
  },
});
