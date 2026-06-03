import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Alert, Platform, Animated,
  TouchableOpacity, Linking, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import StatusBadge from '../components/StatusBadge';
import SafetyDisclaimer from '../components/SafetyDisclaimer';
import { saveReport } from '../services/api';
import { getCurrentUser } from '../services/authService';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { calculateHealthScore, getScoreColor } from '../utils/health';

// ---------------------------------------------------------------------------
// Status color helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  high: { color: '#ef4444', bg: '#fef2f2', icon: '📈', label: 'HIGH' },
  low: { color: '#f59e0b', bg: '#fffbeb', icon: '📉', label: 'LOW' },
  normal: { color: '#10b981', bg: '#ecfdf5', icon: '✅', label: 'NORMAL' },
  needs_review: { color: '#6366f1', bg: '#eef2ff', icon: '🔍', label: 'REVIEW' },
  unknown: { color: '#64748b', bg: '#f1f5f9', icon: '❓', label: 'UNKNOWN' },
};

function getStatusConfig(status) {
  const s = (status || '').toLowerCase().replace(' ', '_');
  return STATUS_CONFIG[s] || STATUS_CONFIG.unknown;
}

function getRiskConfig(risk) {
  const r = (risk || '').toLowerCase();
  if (r.includes('critical')) return { color: '#dc2626', bg: '#fef2f2', icon: '🚨', gradient: ['#dc2626', '#991b1b'] };
  if (r.includes('high')) return { color: '#ea580c', bg: '#fff7ed', icon: '⚠️', gradient: ['#ea580c', '#c2410c'] };
  if (r.includes('moderate')) return { color: '#d97706', bg: '#fffbeb', icon: '🟡', gradient: ['#d97706', '#b45309'] };
  if (r.includes('low')) return { color: '#10b981', bg: '#ecfdf5', icon: '✅', gradient: ['#10b981', '#059669'] };
  if (r.includes('needs review')) return { color: '#6366f1', bg: '#eef2ff', icon: '🔍', gradient: ['#6366f1', '#4f46e5'] };
  return { color: '#64748b', bg: '#f8fafc', icon: '📋', gradient: ['#64748b', '#475569'] };
}

// ---------------------------------------------------------------------------
// Value bar visualization
// ---------------------------------------------------------------------------
const ValueBar = React.memo(({ value, low, high, status, isDarkMode }) => {
  if (value === null || value === undefined || low === null || high === null) return null;
  const range = high - low;
  if (range <= 0) return null;

  const clampedVal = Math.max(low * 0.5, Math.min(high * 1.5, value));
  const totalRange = high * 1.5 - low * 0.5;
  const pos = ((clampedVal - low * 0.5) / totalRange) * 100;
  const sc = getStatusConfig(status);

  return (
    <View style={{ marginTop: verticalScale(10), marginBottom: verticalScale(4) }}>
      <View style={[valueBarStyles.track, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
        {/* Normal zone */}
        <View style={[
          valueBarStyles.normalZone,
          {
            left: `${(low * 0.5 / (high * 1.5 - low * 0.5)) * 100}%`,
            right: `${100 - ((high - low * 0.5) / totalRange) * 100}%`,
            backgroundColor: isDarkMode ? '#166534' : '#bbf7d0',
          }
        ]} />
        {/* Indicator dot */}
        <View style={[
          valueBarStyles.dot,
          { left: `${pos}%`, backgroundColor: sc.color }
        ]} />
      </View>
      <View style={valueBarStyles.labelsRow}>
        <Text style={[valueBarStyles.boundLabel, { color: isDarkMode ? '#64748b' : '#94a3b8' }]}>{low}</Text>
        <Text style={[valueBarStyles.centerLabel, { color: isDarkMode ? '#475569' : '#cbd5e1' }]}>Normal Range</Text>
        <Text style={[valueBarStyles.boundLabel, { color: isDarkMode ? '#64748b' : '#94a3b8' }]}>{high}</Text>
      </View>
    </View>
  );
});

const valueBarStyles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, position: 'relative', overflow: 'visible', marginHorizontal: 4 },
  normalZone: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4, opacity: 0.8 },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, top: -3, marginLeft: -7, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  boundLabel: { fontSize: 10, fontWeight: '700' },
  centerLabel: { fontSize: 9, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// LOINC badge
// ---------------------------------------------------------------------------
const LoincBadge = ({ loinc, isDarkMode }) => {
  if (!loinc) return null;
  return (
    <View style={[loincStyles.badge, { backgroundColor: isDarkMode ? '#1e3a5f' : '#eff6ff', borderColor: isDarkMode ? '#3b82f6' : '#bfdbfe' }]}>
      <Ionicons name="barcode-outline" size={10} color="#3b82f6" />
      <Text style={loincStyles.text}>LOINC: {loinc}</Text>
    </View>
  );
};
const loincStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start', marginTop: 4 },
  text: { fontSize: 9, fontWeight: '700', color: '#3b82f6' },
});

// ---------------------------------------------------------------------------
// Individual test card — full featured
// ---------------------------------------------------------------------------
const TestRowCard = React.memo(({ test, isDarkMode, index }) => {
  const [expanded, setExpanded] = useState(false);
  const sc = getStatusConfig(test.status);

  const value = test.value;
  const unit = test.unit || '';
  const low = test.rangeLow ?? test.minRange ?? test.range_low ?? null;
  const high = test.rangeHigh ?? test.maxRange ?? test.range_high ?? null;
  const refRange = test.reference_range || test.referenceRange || 'Not detected';
  const loinc = test.loinc_code || test.loincCode;
  const learnUrl = test.learn_more_url || test.medline_url || test.medlineplus_url;
  const explanation = test.explanation || '';
  const confidence = test.confidence || 'low';
  const source = test.source || test.source_priority || 'none';

  const confColor = confidence === 'high' ? '#10b981' : confidence === 'medium' ? '#f59e0b' : '#94a3b8';
  const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
  const borderColor = sc.color + '44';
  const textColor = isDarkMode ? '#f8fafc' : '#1e293b';
  const mutedColor = isDarkMode ? '#64748b' : '#94a3b8';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded(e => !e)}
      style={[testCardStyles.card, { backgroundColor: cardBg, borderColor, borderLeftColor: sc.color }]}
    >
      {/* Row 1: Test name + status badge */}
      <View style={testCardStyles.header}>
        <View style={testCardStyles.headerLeft}>
          <Text style={testCardStyles.icon}>{sc.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[testCardStyles.testName, { color: textColor }]} numberOfLines={expanded ? 5 : 2}>
              {test.testName || test.test_name}
            </Text>
            <LoincBadge loinc={loinc} isDarkMode={isDarkMode} />
          </View>
        </View>
        <View style={testCardStyles.headerRight}>
          <View style={[testCardStyles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[testCardStyles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={mutedColor}
            style={{ marginTop: 6 }}
          />
        </View>
      </View>

      {/* Row 2: Value + Range chips */}
      <View style={testCardStyles.metricsRow}>
        <View style={[testCardStyles.chip, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
          <Text style={[testCardStyles.chipLabel, { color: mutedColor }]}>VALUE</Text>
          <Text style={[testCardStyles.chipValue, { color: value !== null ? sc.color : mutedColor }]}>
            {value !== null && value !== undefined ? `${value}` : '—'}
            {unit ? <Text style={[testCardStyles.chipUnit, { color: mutedColor }]}> {unit}</Text> : null}
          </Text>
        </View>

        <View style={[testCardStyles.chip, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
          <Text style={[testCardStyles.chipLabel, { color: mutedColor }]}>REFERENCE RANGE</Text>
          <Text style={[testCardStyles.chipValue, { color: refRange === 'Not detected' ? '#f59e0b' : (isDarkMode ? '#94a3b8' : '#475569') }]}>
            {refRange === 'Not detected' ? '⚠️ Not found' : refRange}
            {unit && refRange !== 'Not detected' ? <Text style={[testCardStyles.chipUnit, { color: mutedColor }]}> {unit}</Text> : null}
          </Text>
        </View>

        <View style={[testCardStyles.chip, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
          <Text style={[testCardStyles.chipLabel, { color: mutedColor }]}>CONFIDENCE</Text>
          <Text style={[testCardStyles.chipValue, { color: confColor }]}>
            {confidence.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Value bar */}
      <ValueBar value={value} low={low} high={high} status={test.status} isDarkMode={isDarkMode} />

      {/* Expanded section */}
      {expanded && (
        <View style={testCardStyles.expandedSection}>
          {/* Explanation */}
          {explanation ? (
            <View style={[testCardStyles.explanationBox, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
              <Text style={[testCardStyles.explanationLabel, { color: mutedColor }]}>📋 INTERPRETATION</Text>
              <Text style={[testCardStyles.explanationText, { color: isDarkMode ? '#cbd5e1' : '#475569' }]}>{explanation}</Text>
            </View>
          ) : null}

          {/* Source info */}
          <View style={testCardStyles.metaRow}>
            <View style={testCardStyles.metaItem}>
              <Text style={[testCardStyles.metaLabel, { color: mutedColor }]}>DATA SOURCE</Text>
              <Text style={[testCardStyles.metaValue, { color: source === 'lab_report_reference_range' ? '#10b981' : '#f59e0b' }]}>
                {source === 'lab_report_reference_range' ? '✅ Lab Report Range' : '⚠️ Not available'}
              </Text>
            </View>
            {(test.trusted_info_source) && (
              <View style={testCardStyles.metaItem}>
                <Text style={[testCardStyles.metaLabel, { color: mutedColor }]}>TRUSTED INFO</Text>
                <Text style={[testCardStyles.metaValue, { color: '#3b82f6' }]}>{test.trusted_info_source}</Text>
              </View>
            )}
          </View>

          {/* Sanity warning */}
          {test.sanityNote && (
            <View style={[testCardStyles.warningRow, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="warning-outline" size={12} color="#f59e0b" />
              <Text style={testCardStyles.warningText}>{test.sanityNote}</Text>
            </View>
          )}

          {/* Needs review message */}
          {(test.status === 'needs_review' || !refRange || refRange === 'Not detected') && (
            <View style={[testCardStyles.warningRow, { backgroundColor: isDarkMode ? '#312e81' : '#eef2ff' }]}>
              <Ionicons name="information-circle-outline" size={12} color="#6366f1" />
              <Text style={[testCardStyles.warningText, { color: '#6366f1' }]}>
                Reference range not found. Please verify this value with your lab or doctor.
              </Text>
            </View>
          )}

          {/* MedlinePlus link */}
          {learnUrl ? (
            <TouchableOpacity
              style={[testCardStyles.medlineBtn, { borderColor: isDarkMode ? '#334155' : '#bfdbfe', backgroundColor: isDarkMode ? '#0f172a' : '#eff6ff' }]}
              onPress={() => Linking.openURL(learnUrl).catch(() => {})}
              accessibilityLabel={`Learn more about ${test.testName} on MedlinePlus`}
            >
              <Ionicons name="library-outline" size={13} color="#3b82f6" style={{ marginRight: 6 }} />
              <Text style={testCardStyles.medlineBtnText}>Learn more on MedlinePlus ↗</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
});

const testCardStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderLeftWidth: 5,
    padding: scale(16),
    marginBottom: verticalScale(10),
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: verticalScale(12) },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  headerRight: { alignItems: 'flex-end', marginLeft: scale(8) },
  icon: { fontSize: fs(20), marginRight: scale(10), marginTop: 2 },
  testName: { fontSize: fs(15), fontWeight: '800', lineHeight: 20, flexWrap: 'wrap' },
  statusPill: { paddingHorizontal: scale(10), paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: fs(10), fontWeight: '900', letterSpacing: 0.5 },
  metricsRow: { flexDirection: 'row', gap: scale(8), marginBottom: verticalScale(2) },
  chip: { flex: 1, borderRadius: 12, padding: scale(8), alignItems: 'center' },
  chipLabel: { fontSize: fs(7), fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  chipValue: { fontSize: fs(13), fontWeight: '900', textAlign: 'center' },
  chipUnit: { fontSize: fs(9), fontWeight: '600' },
  expandedSection: { marginTop: verticalScale(12), borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: verticalScale(12) },
  explanationBox: { borderRadius: 12, padding: scale(12), marginBottom: verticalScale(10), borderWidth: 1 },
  explanationLabel: { fontSize: fs(8), fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  explanationText: { fontSize: fs(12), lineHeight: 18, fontWeight: '500' },
  metaRow: { flexDirection: 'row', gap: scale(12), marginBottom: verticalScale(8) },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: fs(8), fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: fs(11), fontWeight: '700' },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: scale(8), borderRadius: 10, marginBottom: verticalScale(6) },
  warningText: { flex: 1, fontSize: fs(11), fontWeight: '600', color: '#f59e0b', lineHeight: 15 },
  medlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: verticalScale(8), marginTop: verticalScale(4) },
  medlineBtnText: { fontSize: fs(12), fontWeight: '700', color: '#3b82f6' },
});

// ---------------------------------------------------------------------------
// Health Score Ring
// ---------------------------------------------------------------------------
const HealthScoreRing = ({ score, color, isDarkMode }) => {
  if (score === null || score === undefined) return null;
  const size = scale(90);
  return (
    <View style={[ringStyles.container, { width: size, height: size, borderRadius: size / 2, borderColor: color, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      <Text style={[ringStyles.score, { color }]}>{score}</Text>
      <Text style={[ringStyles.label, { color: isDarkMode ? '#64748b' : '#94a3b8' }]}>/ 100</Text>
    </View>
  );
};
const ringStyles = StyleSheet.create({
  container: { borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: fs(26), fontWeight: '900' },
  label: { fontSize: fs(9), fontWeight: '700', marginTop: -2 },
});

// ---------------------------------------------------------------------------
// Confidence Bar
// ---------------------------------------------------------------------------
const ConfidenceBar = ({ percent, isDarkMode }) => {
  const color = percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <View style={{ marginTop: 6 }}>
      <View style={[confBarStyles.track, { backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }]}>
        <View style={[confBarStyles.fill, { width: `${Math.min(100, percent)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[confBarStyles.label, { color }]}>{percent}% extraction confidence</Text>
    </View>
  );
};
const confBarStyles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  label: { fontSize: fs(10), fontWeight: '700', marginTop: 4 },
});

// ---------------------------------------------------------------------------
// Summary Stats bar
// ---------------------------------------------------------------------------
const SummaryStats = ({ tests, isDarkMode }) => {
  const counts = useMemo(() => {
    const c = { normal: 0, high: 0, low: 0, needs_review: 0 };
    tests.forEach(t => {
      const s = (t.status || '').toLowerCase();
      if (c[s] !== undefined) c[s]++;
      else c.needs_review++;
    });
    return c;
  }, [tests]);

  const items = [
    { label: 'Normal', count: counts.normal, color: '#10b981' },
    { label: 'High', count: counts.high, color: '#ef4444' },
    { label: 'Low', count: counts.low, color: '#f59e0b' },
    { label: 'Review', count: counts.needs_review, color: '#6366f1' },
  ];

  return (
    <View style={[summaryStyles.row, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
      {items.map((item, i) => (
        <View key={i} style={[summaryStyles.item, i < items.length - 1 && { borderRightWidth: 1, borderRightColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
          <Text style={[summaryStyles.count, { color: item.color }]}>{item.count}</Text>
          <Text style={[summaryStyles.label, { color: isDarkMode ? '#64748b' : '#94a3b8' }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
};
const summaryStyles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: verticalScale(12), overflow: 'hidden' },
  item: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(12) },
  count: { fontSize: fs(22), fontWeight: '900' },
  label: { fontSize: fs(9), fontWeight: '700', marginTop: 2, letterSpacing: 0.4 },
});

// ---------------------------------------------------------------------------
// Main ResultScreen
// ---------------------------------------------------------------------------
export default function ResultScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const result = route.params?.result || {};
  const report = result.report || {};
  const tests = useMemo(() => {
    const t = result.tests || report.tests || [];
    // Filter out generic test headers
    return t.filter(t => {
      const n = (t.testName || t.test_name || '').toLowerCase();
      return !['test name', 'result value', 'unit', 'reference range field', 'general test name'].includes(n);
    });
  }, [result, report]);

  const [saving, setSaving] = useState(false);
  const { isDarkMode } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f1f5f9',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
  };

  const healthScore = useMemo(() => {
    if (result.health_score !== null && result.health_score !== undefined) return result.health_score;
    if (result.report?.health_score !== null && result.report?.health_score !== undefined) return result.report.health_score;
    return calculateHealthScore(result);
  }, [result]);

  const scoreColor = useMemo(() => getScoreColor(healthScore), [healthScore]);

  const riskLabel = result.risk_level || result.overallRisk || report.overallRisk || report.risk_level || 'Needs Review';
  const riskCfg = useMemo(() => getRiskConfig(riskLabel), [riskLabel]);

  const confidencePct = useMemo(() => {
    const raw = result.confidence_percent
      ?? Math.round((result.extractionConfidence || result.reportTypeConfidence || 0) * 100);
    return Math.max(0, Math.min(100, raw));
  }, [result]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const userId = getCurrentUser()?.id || 'guest';
      await saveReport(userId, result);
      Alert.alert(
        '✅ Saved',
        'Report saved to your history.',
        [
          { text: 'View History', onPress: () => navigation.navigate('History') },
          { text: 'Done', onPress: () => navigation.navigate('Home') },
        ]
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save report. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [result, navigation]);

  const renderHeader = useMemo(() => {
    const reportType = result.reportType || result.report_type || report.reportType || 'Lab Report';
    const patterns = result.detectedPatterns || [];
    const englishExplanation = result.englishExplanation || result.summary || '';
    const romanUrduExplanation = result.romanUrduExplanation || '';
    const needsReview = result.needs_review || false;
    const ocrEngine = result.ocrEngine || result.engine_used || 'unknown';

    return (
      <View>
        {/* ── OCR & Confidence Banner ── */}
        <View style={[hdrStyles.banner, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: colors.cardBorder }]}>
          <View style={hdrStyles.bannerItem}>
            <Ionicons name="scan-outline" size={16} color="#0ea5e9" />
            <Text style={[hdrStyles.bannerLabel, { color: colors.textMuted }]}>OCR ENGINE</Text>
            <Text style={[hdrStyles.bannerValue, { color: colors.text }]}>{ocrEngine.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <View style={[hdrStyles.divider, { backgroundColor: colors.cardBorder }]} />
          <View style={hdrStyles.bannerItem}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
            <Text style={[hdrStyles.bannerLabel, { color: colors.textMuted }]}>MARKERS FOUND</Text>
            <Text style={[hdrStyles.bannerValue, { color: colors.text }]}>{tests.length}</Text>
          </View>
          <View style={[hdrStyles.divider, { backgroundColor: colors.cardBorder }]} />
          <View style={hdrStyles.bannerItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#6366f1" />
            <Text style={[hdrStyles.bannerLabel, { color: colors.textMuted }]}>SOURCE</Text>
            <Text style={[hdrStyles.bannerValue, { color: '#6366f1' }]}>Lab Range</Text>
          </View>
        </View>

        {/* ── Manual Review Warning ── */}
        {needsReview && (
          <View style={[hdrStyles.reviewWarning, { backgroundColor: isDarkMode ? '#1c1917' : '#fff7ed', borderColor: '#f59e0b' }]}>
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <Text style={hdrStyles.reviewText}>Manual review recommended. Verify all values against your original report.</Text>
          </View>
        )}

        {/* ── Report Type + Health Score ── */}
        <AppCard style={[hdrStyles.mainCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={hdrStyles.mainCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={[hdrStyles.typeLabel, { color: colors.textMuted }]}>📋 DETECTED REPORT TYPE</Text>
              <Text style={[hdrStyles.reportType, { color: colors.text }]}>{reportType}</Text>
              <ConfidenceBar percent={confidencePct} isDarkMode={isDarkMode} />
            </View>
            <HealthScoreRing score={healthScore} color={scoreColor} isDarkMode={isDarkMode} />
          </View>
        </AppCard>

        {/* ── Risk Assessment Card ── */}
        <View style={[hdrStyles.riskCard, { backgroundColor: riskCfg.bg, borderColor: riskCfg.color + '55' }]}>
          <View style={hdrStyles.riskHeader}>
            <Text style={hdrStyles.riskIcon}>{riskCfg.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[hdrStyles.riskTitle, { color: riskCfg.color }]}>OVERALL HEALTH RISK</Text>
              <Text style={[hdrStyles.riskLevel, { color: riskCfg.color }]}>{riskLabel}</Text>
            </View>
            <Animated.View style={[hdrStyles.riskPulse, { backgroundColor: riskCfg.color, opacity: pulseAnim }]} />
          </View>
        </View>

        {/* ── Summary Stats ── */}
        {tests.length > 0 && <SummaryStats tests={tests} isDarkMode={isDarkMode} />}

        {/* ── Detected Patterns ── */}
        {patterns.length > 0 && (
          <AppCard style={[hdrStyles.patternsCard, { backgroundColor: isDarkMode ? '#172554' : '#eff6ff', borderColor: isDarkMode ? '#1e40af' : '#bfdbfe' }]}>
            <Text style={[hdrStyles.patternsHeader, { color: isDarkMode ? '#3b82f6' : '#1d4ed8' }]}>🔍 DETECTED HEALTH PATTERNS</Text>
            {patterns.map((p, i) => (
              <View key={i} style={hdrStyles.patternItem}>
                <Text style={[hdrStyles.patternTitle, { color: isDarkMode ? '#60a5fa' : '#1e40af' }]}>{p.name}</Text>
                <Text style={[hdrStyles.patternText, { color: isDarkMode ? '#93c5fd' : '#1e3a8a' }]}>{p.english}</Text>
                {p.romanUrdu && (
                  <Text style={[hdrStyles.patternUrdu, { color: isDarkMode ? '#60a5fa' : '#2563eb' }]}>{p.romanUrdu}</Text>
                )}
              </View>
            ))}
          </AppCard>
        )}

        {/* ── English Interpretation ── */}
        {englishExplanation ? (
          <AppCard style={[hdrStyles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[hdrStyles.sectionTitle, { color: colors.text }]}>🇬🇧 Medical Interpretation</Text>
            <Text style={[hdrStyles.sectionText, { color: colors.textMuted }]}>{englishExplanation}</Text>
          </AppCard>
        ) : null}

        {/* ── Roman Urdu Interpretation ── */}
        {romanUrduExplanation ? (
          <AppCard style={[hdrStyles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[hdrStyles.sectionTitle, { color: colors.text }]}>🇵🇰 رومن اردو تشریح</Text>
            <Text style={[hdrStyles.sectionText, { color: colors.textMuted }]}>{romanUrduExplanation}</Text>
          </AppCard>
        ) : null}

        {/* ── Marker breakdown heading ── */}
        {tests.length > 0 && (
          <Text style={[hdrStyles.markerHeading, { color: colors.textMuted }]}>
            📊 Detailed Marker Breakdown ({tests.length} tests)
          </Text>
        )}

        {tests.length === 0 && (
          <View style={[hdrStyles.noMarkersBox, { backgroundColor: isDarkMode ? '#1e293b' : '#fff7ed', borderColor: '#f59e0b' }]}>
            <Ionicons name="search-outline" size={32} color="#f59e0b" />
            <Text style={hdrStyles.noMarkersTitle}>No Markers Detected</Text>
            <Text style={[hdrStyles.noMarkersText, { color: colors.textMuted }]}>
              The OCR could not extract any lab test values. Try a clearer image or use manual entry.
            </Text>
          </View>
        )}
      </View>
    );
  }, [result, report, tests, riskLabel, riskCfg, healthScore, scoreColor, confidencePct, isDarkMode, colors, pulseAnim]);

  const renderFooter = useMemo(() => (
    <View style={{ marginTop: verticalScale(16) }}>
      <AppButton
        title="💾 Save to My History"
        onPress={handleSave}
        loading={saving}
        style={[footerStyles.saveBtn, { backgroundColor: isDarkMode ? '#1e3a5f' : '#0f172a' }]}
      />

      {/* MedlinePlus Attribution */}
      <TouchableOpacity
        style={[footerStyles.medlineAttr, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: isDarkMode ? '#334155' : '#bfdbfe' }]}
        onPress={() => Linking.openURL('https://medlineplus.gov/lab-tests/').catch(() => {})}
      >
        <Ionicons name="library-outline" size={14} color="#3b82f6" />
        <Text style={footerStyles.medlineAttrText}>Powered by MedlinePlus — Trusted medical information from the U.S. National Library of Medicine</Text>
      </TouchableOpacity>

      <SafetyDisclaimer />

      {/* Feedback */}
      <AppCard style={[footerStyles.feedbackCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[footerStyles.feedbackHeader, { color: colors.textMuted }]}>Was this analysis helpful?</Text>
        <View style={footerStyles.feedbackRow}>
          {['✅ Correct', '❌ Wrong', '❓ Unclear'].map((label, i) => (
            <AppButton
              key={i}
              title={label}
              variant="secondary"
              onPress={() => Alert.alert('Thank you', 'Your feedback helps improve our AI accuracy.')}
              style={[footerStyles.fbBtn, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: colors.cardBorder }]}
              textStyle={{ fontSize: fs(11), fontWeight: '700', color: colors.textMuted }}
            />
          ))}
        </View>
      </AppCard>
    </View>
  ), [handleSave, saving, isDarkMode, colors]);

  const renderItem = useCallback(({ item, index }) => (
    <TestRowCard test={item} isDarkMode={isDarkMode} index={index} />
  ), [isDarkMode]);

  const keyExtractor = useCallback((item, index) => (item.testName || item.test_name || '') + index, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <FlatList
        data={tests}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.content, { paddingBottom: 120 + Math.max(insets.bottom, 10) }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </SafeAreaView>
  );
}

const hdrStyles = StyleSheet.create({
  banner: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: verticalScale(12), overflow: 'hidden' },
  bannerItem: { flex: 1, alignItems: 'center', paddingVertical: verticalScale(12), gap: 2 },
  bannerLabel: { fontSize: fs(8), fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  bannerValue: { fontSize: fs(11), fontWeight: '900' },
  divider: { width: 1 },
  reviewWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: scale(14), borderRadius: 14, borderWidth: 1.5, marginBottom: verticalScale(12) },
  reviewText: { flex: 1, fontSize: fs(12), fontWeight: '600', color: '#92400e', lineHeight: 18 },
  mainCard: { padding: scale(20), marginBottom: verticalScale(12) },
  mainCardRow: { flexDirection: 'row', alignItems: 'center', gap: scale(16) },
  typeLabel: { fontSize: fs(9), fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  reportType: { fontSize: fs(22), fontWeight: '900', lineHeight: 28, marginBottom: 4 },
  riskCard: { flexDirection: 'row', borderRadius: 18, borderWidth: 1.5, padding: scale(18), marginBottom: verticalScale(12), alignItems: 'center' },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12), flex: 1 },
  riskIcon: { fontSize: fs(28) },
  riskTitle: { fontSize: fs(9), fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  riskLevel: { fontSize: fs(20), fontWeight: '900' },
  riskPulse: { width: scale(10), height: scale(10), borderRadius: scale(5) },
  patternsCard: { borderRadius: 18, padding: scale(18), marginBottom: verticalScale(12), borderWidth: 1.5 },
  patternsHeader: { fontSize: fs(10), fontWeight: '900', letterSpacing: 0.8, marginBottom: verticalScale(12) },
  patternItem: { marginBottom: verticalScale(12) },
  patternTitle: { fontSize: fs(14), fontWeight: '800', marginBottom: 4 },
  patternText: { fontSize: fs(13), lineHeight: 18, marginBottom: 2 },
  patternUrdu: { fontSize: fs(13), fontStyle: 'italic' },
  sectionCard: { padding: scale(20), marginBottom: verticalScale(12), borderRadius: 18, borderWidth: 1 },
  sectionTitle: { fontSize: fs(15), fontWeight: '800', marginBottom: verticalScale(10) },
  sectionText: { fontSize: fs(13), lineHeight: 20 },
  markerHeading: { fontSize: fs(13), fontWeight: '900', letterSpacing: 0.5, marginBottom: verticalScale(12), marginLeft: scale(4), textTransform: 'uppercase' },
  noMarkersBox: { borderRadius: 18, borderWidth: 1.5, padding: scale(32), alignItems: 'center', gap: verticalScale(10), marginBottom: verticalScale(16) },
  noMarkersTitle: { fontSize: fs(18), fontWeight: '900', color: '#f59e0b' },
  noMarkersText: { fontSize: fs(13), textAlign: 'center', lineHeight: 20 },
});

const footerStyles = StyleSheet.create({
  saveBtn: { height: 58, borderRadius: 18, marginBottom: verticalScale(12) },
  medlineAttr: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: scale(14), borderRadius: 14, borderWidth: 1, marginBottom: verticalScale(12) },
  medlineAttrText: { flex: 1, fontSize: fs(10), fontWeight: '600', color: '#3b82f6', lineHeight: 15 },
  feedbackCard: { padding: scale(16), marginTop: verticalScale(8), alignItems: 'center' },
  feedbackHeader: { fontSize: fs(13), fontWeight: '800', marginBottom: verticalScale(12) },
  feedbackRow: { flexDirection: 'row', gap: scale(8), width: '100%' },
  fbBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: scale(16) },
});