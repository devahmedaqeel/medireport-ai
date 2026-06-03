import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AppCard from './AppCard';
import { fs, scale, verticalScale } from '../utils/responsive';
import { getDailyTips } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HealthTipsCard({ latestReport, isDarkMode = false }) {
  const [dailyTips, setDailyTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDailyTips() {
      setLoading(true);
      try {
        const data = await getDailyTips();
        if (data && Array.isArray(data) && data.length > 0) {
          if (active) {
            setDailyTips(data);
            setIsCached(false);
            setLastUpdated('');
          }
          await AsyncStorage.setItem('@daily_health_tips', JSON.stringify({
            tips: data,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.log("[HealthTipsCard] Failed to fetch online daily tips, trying local cache:", err.message);
        try {
          const cached = await AsyncStorage.getItem('@daily_health_tips');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.tips) && parsed.tips.length > 0 && active) {
              setDailyTips(parsed.tips);
              setIsCached(true);
              const dateStr = new Date(parsed.timestamp).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              setLastUpdated(dateStr);
            }
          }
        } catch (cacheErr) {
          console.warn("[HealthTipsCard] Failed to read daily tips cache:", cacheErr.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDailyTips();
    return () => { active = false; };
  }, []);

  const getTips = () => {
    if (!latestReport) {
      return [
        {
          title: 'Stay Hydrated',
          text: 'Drinking 8-10 glasses of water daily helps your kidneys filter out waste and supports overall metabolic functions.',
        },
        {
          title: 'Fasting and Glucose',
          text: 'Maintain a consistent eating schedule. A balanced intake of complex carbohydrates helps stabilize daily energy levels.',
        },
        {
          title: 'Daily Movement',
          text: 'At least 30 minutes of moderate activity, like walking, helps maintain optimal lipid levels and heart health.',
        },
      ];
    }

    const tests = latestReport.report?.tests || latestReport.tests || [];
    const abnormal = tests.filter(t => (t.status || '').toLowerCase() !== 'normal' && (t.status || '').toLowerCase() !== 'unknown');

    const tips = [];
    let hasKidney = false;
    let hasSugar = false;
    let hasLipid = false;
    let hasCritical = false;

    abnormal.forEach(t => {
      const name = (t.testName || '').toLowerCase();
      const status = (t.status || '').toLowerCase();

      if (status === 'critical') {
        hasCritical = true;
      }
      if (name.includes('creatinine') || name.includes('urea') || name.includes('kidney') || name.includes('urine')) {
        hasKidney = true;
      }
      if (name.includes('sugar') || name.includes('glucose') || name.includes('hba1c') || name.includes('diabetic')) {
        hasSugar = true;
      }
      if (name.includes('lipid') || name.includes('cholesterol') || name.includes('triglycerides') || name.includes('ldl') || name.includes('hdl')) {
        hasLipid = true;
      }
    });

    if (hasCritical) {
      tips.push({
        title: 'Professional Medical Review',
        text: 'One or more of your report markers have been flagged as Critical. We strongly recommend scheduling a follow-up consultation with a qualified doctor to discuss these values.',
      });
    }

    if (hasKidney) {
      tips.push({
        title: 'Optimal Hydration Support',
        text: 'To support kidney function, ensure you stay well-hydrated. Keep caffeine and sodium intake moderate, and avoid self-medicating with NSAID pain relievers.',
      });
    }

    if (hasSugar) {
      tips.push({
        title: 'Glycemic and Diet Control',
        text: 'Focus on dietary fiber, whole grains, and lean proteins. Consider tracking your fasting blood glucose and avoid foods with high levels of refined sugar.',
      });
    }

    if (hasLipid) {
      tips.push({
        title: 'Cardiovascular Wellness',
        text: 'Incorporate heart-healthy fats (olive oil, nuts) and limit saturated fats. Engage in regular physical exercise to help raise HDL and lower LDL levels.',
      });
    }

    // Default safety tips if none triggered
    if (tips.length === 0) {
      tips.push({
        title: 'Regular Physical Activity',
        text: 'Staying active supports heart and lung health, keeps cholesterol in check, and helps normalize daily blood glucose levels.',
      });
      tips.push({
        title: 'Consistent Sleep Schedule',
        text: 'Getting 7-8 hours of quality sleep nightly supports hormone regulation, immune health, and helps control stress-related blood pressure.',
      });
    }

    return tips;
  };

  const fallbackTips = getTips();
  const displayTips = dailyTips.length > 0 ? dailyTips : fallbackTips;
  const isDailyOnline = dailyTips.length > 0 && !isCached;
  const isDailyOffline = dailyTips.length > 0 && isCached;

  const colors = {
    bg: isDarkMode ? '#1e293b' : '#ffffff',
    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    titleColor: isDarkMode ? '#f8fafc' : '#0f172a',
    textColor: isDarkMode ? '#cbd5e1' : '#475569',
    tipBoxBg: isDarkMode ? '#0f172a' : '#f8fafc',
    tipBoxBorder: isDarkMode ? '#334155' : '#e2e8f0',
  };

  return (
    <AppCard style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.borderColor }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={[styles.title, { color: colors.titleColor, flex: 1, marginRight: 8 }]} numberOfLines={1}>
          {isDailyOnline ? 'Daily Health Trends & Tips 🌐' : isDailyOffline ? 'Daily Health Tips (Offline) 🌐' : 'Personalized Health Tips 📌'}
        </Text>
        {loading && <ActivityIndicator size="small" color="#0ea5e9" />}
      </View>
      <Text style={styles.subtitle}>
        {isDailyOnline ? 'Fresh daily advice fetched from AI medical index' : isDailyOffline ? `Last updated: ${lastUpdated} (Cached)` : 'Safe general advice based on latest markers'}
      </Text>

      <View style={styles.tipsList}>
        {displayTips.map((tip, idx) => (
          <View key={idx} style={[styles.tipBox, { backgroundColor: colors.tipBoxBg, borderColor: colors.tipBoxBorder }]}>
            <Text style={styles.tipTitle}>📌 {tip.title}</Text>
            <Text style={[styles.tipText, { color: colors.textColor }]}>{tip.text}</Text>
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
  tipsList: {
    gap: verticalScale(12),
  },
  tipBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: scale(12),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tipTitle: {
    fontSize: fs(13),
    fontWeight: '800',
    color: '#0ea5e9',
    marginBottom: 4,
  },
  tipText: {
    fontSize: fs(12),
    color: '#475569',
    lineHeight: 18,
  },
});
