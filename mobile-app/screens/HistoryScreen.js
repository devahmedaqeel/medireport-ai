import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StatusBadge from '../components/StatusBadge';
import { getReportHistory } from '../services/api';
import { getCurrentUser } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { calculateHealthScore, getScoreColor } from '../utils/health';

// Memoized individual history item card
const HistoryCard = React.memo(({ item, navigation, isDarkMode }) => {
  const reportData = item.report || {};
  const itemScore = useMemo(() => calculateHealthScore(reportData), [reportData]);
  const riskLabel = useMemo(() => {
    const risk = (reportData.overallRisk || reportData.risk_level || '').toLowerCase();
    // Handle new text-based risk labels
    if (risk.includes('critical')) return 'Critical';
    if (risk.includes('high')) return 'High';
    if (risk.includes('moderate') || risk.includes('medium')) return 'Moderate';
    if (risk.includes('low') || risk.includes('normal')) return 'Low Risk';
    // Legacy color-based labels from old schema
    if (risk === 'red') return 'Critical';
    if (risk === 'orange') return 'High';
    if (risk === 'yellow') return 'Moderate';
    if (risk === 'green') return 'Low Risk';
    // Needs review
    if (risk.includes('review') || risk.includes('unknown')) return 'Review';
    return 'Review';
  }, [reportData]);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={() => navigation.navigate('Result', { result: item.report })}
      style={styles.cardContainer}
    >
      <AppCard style={[styles.historyCard, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
        <View style={styles.cardInfo}>
          <Text style={[styles.reportType, { color: isDarkMode ? '#f8fafc' : '#1e293b' }]} numberOfLines={1}>{reportData.reportType || 'General Report'}</Text>
          <Text style={[styles.dateText, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>{formatDate(item.createdAt)}</Text>
          <Text style={[styles.summaryText, { color: isDarkMode ? '#cbd5e1' : '#64748b' }]} numberOfLines={1}>
            {reportData.englishExplanation || 'No summary available.'}
          </Text>
        </View>
        <View style={styles.rightContainer}>
          <StatusBadge status={riskLabel} style={styles.riskBadge} />
          {itemScore !== null && (
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(itemScore) + '15', marginTop: verticalScale(4) }]}>
              <Text style={[styles.scoreBadgeText, { color: getScoreColor(itemScore) }]}>
                ★ {itemScore}
              </Text>
            </View>
          )}
        </View>
      </AppCard>
    </TouchableOpacity>
  );
});

export default function HistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { isDarkMode } = useTheme();

  const fetchHistory = useCallback(async () => {
    try {
      const user = getCurrentUser();
      const userId = user?.id || 'guest';
      const data = await getReportHistory(userId);
      if (Array.isArray(data)) {
        const sortedData = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHistory(sortedData);
      } else {
        setHistory([]);
      }
      setError(null);
    } catch (err) {
      console.warn('[HistoryScreen] Failed to load history:', err.message);
      setError('Failed to load history. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchHistory();
    });

    return unsubscribe;
  }, [navigation, fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, []);

  const renderItem = useCallback(({ item }) => {
    return <HistoryCard item={item} navigation={navigation} isDarkMode={isDarkMode} />;
  }, [navigation, isDarkMode]);

  const keyExtractor = useCallback((item) => {
    return item.reportId;
  }, []);

  const emptyComponent = useMemo(() => {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
          <Text style={styles.emptyEmoji}>📜</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: isDarkMode ? '#f8fafc' : '#1e293b' }]}>No Scans Yet</Text>
        <Text style={styles.emptySub}>Your scanned reports will appear here for easy access.</Text>
        <AppButton 
          title="Scan First Report" 
          onPress={() => navigation.navigate('Scan')}
          style={styles.emptyButton}
        />
      </View>
    );
  }, [navigation, isDarkMode]);

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]} edges={['bottom']}>
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
        {error && <Text style={styles.errorBanner}>{error}</Text>}
        <FlatList
          data={history}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={[
            history.length === 0 ? styles.emptyList : styles.list,
            { paddingBottom: 110 + Math.max(insets.bottom, 10) }
          ]}
          ListEmptyComponent={emptyComponent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  list: { padding: scale(16), paddingBottom: verticalScale(100) },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(40) },
  cardContainer: { marginBottom: verticalScale(2) },
  historyCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 0,
    padding: scale(16)
  },
  cardInfo: { flex: 1, marginRight: scale(10) },
  reportType: { fontSize: fs(16), fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(2) },
  dateText: { fontSize: fs(11), color: '#94a3b8', marginBottom: verticalScale(6), fontWeight: '600' },
  summaryText: { fontSize: fs(13), color: '#64748b' },
  riskBadge: { flexShrink: 0 },
  rightContainer: { alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 },
  scoreBadge: { paddingHorizontal: scale(6), paddingVertical: verticalScale(2), borderRadius: 6 },
  scoreBadgeText: { fontSize: fs(9), fontWeight: '800' },
  emptyContainer: { alignItems: 'center', width: '100%' },
  emptyIconCircle: { 
    width: scale(100), 
    height: scale(100), 
    borderRadius: scale(50), 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: verticalScale(20), 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 10 
  },
  emptyEmoji: { fontSize: fs(40) },
  emptyTitle: { fontSize: fs(20), fontWeight: '800', color: '#1e293b', marginBottom: verticalScale(8) },
  emptySub: { fontSize: fs(13), color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: verticalScale(24), paddingHorizontal: scale(20) },
  emptyButton: { paddingHorizontal: scale(24), height: 50 },
  loadingText: { marginTop: verticalScale(12), fontSize: fs(13), color: '#64748b', fontWeight: '600' },
  errorBanner: { backgroundColor: '#fee2e2', color: '#ef4444', padding: scale(12), textAlign: 'center', fontWeight: '700', fontSize: fs(13) }
});
