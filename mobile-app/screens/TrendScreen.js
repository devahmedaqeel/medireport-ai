import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  Dimensions
} from 'react-native';
import ResponsiveScreen from '../components/ResponsiveScreen';
import AppCard from '../components/AppCard';
import { getReportTrends } from '../services/api';
import { getCurrentUser } from '../services/authService';
import { fs, scale, verticalScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';

const CHART_HEIGHT = verticalScale(130);

// Lightweight native bar chart — avoids % height which is unsupported in RN
const SimpleTrendVisualizer = ({ data, isDarkMode }) => {
  if (!data || data.length < 2) return null;

  const validData = data.filter(d => d.y !== null && d.y !== undefined && !isNaN(Number(d.y)));
  if (validData.length < 2) return null;

  const values = validData.map(d => Number(d.y));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;

  return (
    <View style={{ height: CHART_HEIGHT }}>
      <View style={[trendStyles.chartArea, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
        {validData.map((point, idx) => {
          const heightPx = Math.max(8, ((Number(point.y) - min) / range) * (CHART_HEIGHT - 32));
          const isLatest = idx === validData.length - 1;
          const isHigh = (point.status || '').toLowerCase() === 'high';
          const isLow = (point.status || '').toLowerCase() === 'low';
          const barColor = isHigh ? '#ef4444' : isLow ? '#f59e0b' : '#0ea5e9';
          return (
            <View key={idx} style={trendStyles.barGroup}>
              <Text style={[trendStyles.barValueLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
                {Number(point.y).toFixed(1)}
              </Text>
              <View style={trendStyles.barWrapper}>
                <View 
                  style={[
                    trendStyles.bar, 
                    { height: heightPx, backgroundColor: barColor, opacity: isLatest ? 1 : 0.6 }
                  ]} 
                />
              </View>
              <Text style={trendStyles.barLabel}>
                {new Date(point.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const trendStyles = StyleSheet.create({
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', width: '100%', paddingHorizontal: 8, borderRadius: 12, paddingTop: 4, paddingBottom: 8 },
  barGroup: { alignItems: 'center', flex: 1 },
  barWrapper: { justifyContent: 'flex-end', alignItems: 'center', flex: 1 },
  bar: { width: scale(14), borderRadius: 6, minHeight: 8 },
  barLabel: { fontSize: fs(8), color: '#94a3b8', marginTop: 4, fontWeight: '600', textAlign: 'center' },
  barValueLabel: { fontSize: fs(8), fontWeight: '800', marginBottom: 2, textAlign: 'center' },
});

// Status dot with correct lowercase comparison
const StatusDot = ({ status }) => {
  const s = (status || '').toLowerCase();
  const color = s === 'normal' ? '#10b981' : s === 'high' ? '#ef4444' : s === 'low' ? '#f59e0b' : '#6366f1';
  return <View style={{ width: scale(10), height: scale(10), borderRadius: 5, backgroundColor: color }} />;
};

export default function TrendScreen({ navigation }) {
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const { isDarkMode } = useTheme();

  const fetchTrends = useCallback(async () => {
    setError(null);
    try {
      const user = getCurrentUser();
      const userId = user?.id || 'guest';
      const data = await getReportTrends(userId);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Filter out test names that have no valid numeric data
        const validTrends = {};
        for (const [name, points] of Object.entries(data)) {
          if (
            Array.isArray(points) && 
            points.length > 0 && 
            !['test name', 'result value', 'unit', 'reference range field', 'general test name'].includes(name.toLowerCase())
          ) {
            validTrends[name] = points;
          }
        }
        setTrends(validTrends);
        const markers = Object.keys(validTrends);
        if (markers.length > 0) {
          setSelectedMarker(prev => prev && validTrends[prev] ? prev : markers[0]);
        }
      }
    } catch (err) {
      console.warn('[TrendScreen] Failed to load trends:', err.message);
      setError('Could not load health trends. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
    const unsubscribe = navigation.addListener('focus', fetchTrends);
    return unsubscribe;
  }, [navigation, fetchTrends]);

  const trendData = useMemo(() => {
    if (!selectedMarker || !trends[selectedMarker]) return [];
    return trends[selectedMarker]
      .filter(obs => obs.value !== null && obs.value !== undefined)
      .map((obs, idx) => ({
        x: idx + 1,
        y: obs.value,
        date: obs.date,
        status: obs.status,
        unit: obs.unit,
      }));
  }, [selectedMarker, trends]);

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#f1f5f9',
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading health trends...</Text>
      </View>
    );
  }

  const markers = Object.keys(trends);

  const selectedData = selectedMarker ? (trends[selectedMarker] || []) : [];
  const latestReading = selectedData.length > 0 ? selectedData[selectedData.length - 1] : null;

  return (
    <ResponsiveScreen 
      style={{ backgroundColor: colors.bg }}
      edges={['top']} 
      scrollable={true}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Health Trends</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Monitor how your biomarkers change over time.
        </Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {markers.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={scale(64)} color={isDarkMode ? '#334155' : '#cbd5e1'} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Trends Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Scan or add reports to start tracking your health biomarkers over time.
          </Text>
        </View>
      ) : (
        <>
          {/* Marker selector tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selector} contentContainerStyle={{ paddingRight: scale(20) }}>
            {markers.map(m => (
              <TouchableOpacity 
                key={m} 
                style={[
                  styles.markerTab, 
                  selectedMarker === m 
                    ? styles.markerTabActive 
                    : { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: colors.border }
                ]}
                onPress={() => setSelectedMarker(m)}
                accessibilityLabel={`View trends for ${m}`}
              >
                <Text style={[
                  styles.markerTabText, 
                  selectedMarker === m ? styles.markerTabTextActive : { color: colors.textMuted }
                ]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Current value summary */}
          {latestReading && (
            <View style={[styles.latestRow, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: isDarkMode ? '#334155' : '#bfdbfe' }]}>
              <View>
                <Text style={[styles.latestLabel, { color: colors.textMuted }]}>LATEST READING</Text>
                <Text style={[styles.latestValue, { color: colors.text }]}>
                  {latestReading.value !== null ? latestReading.value : '—'} {latestReading.unit || ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.latestLabel, { color: colors.textMuted }]}>STATUS</Text>
                <Text style={[styles.latestStatus, { 
                  color: (latestReading.status || '').toLowerCase() === 'normal' ? '#10b981' : 
                         (latestReading.status || '').toLowerCase() === 'high' ? '#ef4444' : 
                         (latestReading.status || '').toLowerCase() === 'low' ? '#f59e0b' : '#6366f1'
                }]}>
                  {(latestReading.status || 'Unknown').toUpperCase()}
                </Text>
              </View>
            </View>
          )}

          {/* Chart */}
          <AppCard style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>{selectedMarker} Trend</Text>
            {trendData.length > 1 ? (
              <SimpleTrendVisualizer data={trendData} isDarkMode={isDarkMode} />
            ) : (
              <View style={styles.singleData}>
                <Ionicons name="information-circle-outline" size={28} color="#94a3b8" />
                <Text style={[styles.singleDataText, { color: colors.textMuted }]}>
                  Only one reading found. Add more reports to see a trend graph.
                </Text>
              </View>
            )}
          </AppCard>

          {/* History table */}
          <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
            All Readings ({selectedData.length})
          </Text>
          {selectedData.slice().reverse().map((obs, idx) => (
            <View key={idx} style={[styles.tableRow, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {obs.value !== null && obs.value !== undefined ? `${obs.value}` : '—'} {obs.unit || ''}
                </Text>
                <Text style={[styles.rowDate, { color: colors.textMuted }]}>
                  {obs.date ? new Date(obs.date).toLocaleDateString(undefined, { 
                    year: 'numeric', month: 'short', day: 'numeric' 
                  }) : 'Unknown date'}
                </Text>
              </View>
              <StatusDot status={obs.status} />
            </View>
          ))}

          <View style={{ height: verticalScale(100) }} />
        </>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: verticalScale(12), fontSize: fs(13), fontWeight: '600' },
  header: { padding: scale(20), paddingBottom: verticalScale(10) },
  title: { fontSize: fs(24), fontWeight: '900' },
  subtitle: { fontSize: fs(14), marginTop: verticalScale(4), lineHeight: 20 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: scale(20), padding: scale(12), backgroundColor: '#fee2e2', borderRadius: 12 },
  errorText: { flex: 1, fontSize: fs(12), color: '#ef4444', fontWeight: '600' },
  selector: { paddingLeft: scale(20), marginBottom: verticalScale(16) },
  markerTab: { paddingHorizontal: scale(14), paddingVertical: verticalScale(8), borderRadius: 20, marginRight: scale(8), borderWidth: 1 },
  markerTabActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  markerTabText: { fontSize: fs(12), fontWeight: '700' },
  markerTabTextActive: { color: '#fff' },
  latestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: scale(20), padding: scale(16), borderRadius: 14, borderWidth: 1, marginBottom: verticalScale(12) },
  latestLabel: { fontSize: fs(9), fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  latestValue: { fontSize: fs(20), fontWeight: '900' },
  latestStatus: { fontSize: fs(13), fontWeight: '900' },
  chartCard: { marginHorizontal: scale(20), padding: scale(20), minHeight: verticalScale(180), marginBottom: verticalScale(16) },
  chartTitle: { fontSize: fs(15), fontWeight: '800', marginBottom: verticalScale(16) },
  singleData: { height: verticalScale(100), justifyContent: 'center', alignItems: 'center', gap: 10 },
  singleDataText: { textAlign: 'center', fontSize: fs(12), fontStyle: 'italic', paddingHorizontal: scale(20) },
  sectionHeading: { fontSize: fs(12), fontWeight: '900', marginBottom: verticalScale(8), marginHorizontal: scale(24), textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: verticalScale(14), paddingHorizontal: scale(24), borderBottomWidth: 1 },
  rowValue: { fontSize: fs(16), fontWeight: '800' },
  rowDate: { fontSize: fs(11), marginTop: verticalScale(2) },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: verticalScale(80), paddingHorizontal: scale(40), gap: verticalScale(12) },
  emptyTitle: { fontSize: fs(20), fontWeight: '900', textAlign: 'center' },
  emptyText: { textAlign: 'center', fontSize: fs(14), lineHeight: 22 },
});
