import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  StatusBar,
  Modal,
  ScrollView,
  RefreshControl,
  TextInput,
  Switch,
  ActivityIndicator,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ResponsiveScreen from '../components/ResponsiveScreen';
import AppCard from '../components/AppCard';
import StatusBadge from '../components/StatusBadge';
import { getCurrentUser, logoutUser } from '../services/authService';
import { checkBackendHealth, getReportHistory, clearReportHistory, API_BASE, searchWikiOnline } from '../services/api';
import { fs, scale, verticalScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';
import { calculateHealthScore, getScoreColor, getScoreColorLight, getScoreStatusText } from '../utils/health';

// Premium Dashboard Components
import HealthSummaryCard from '../components/HealthSummaryCard';
import CriticalAlertsCard from '../components/CriticalAlertsCard';
import ReportConfidenceCard from '../components/ReportConfidenceCard';
import CompareReportCard from '../components/CompareReportCard';
import QuickActionGrid from '../components/QuickActionGrid';
import HealthTipsCard from '../components/HealthTipsCard';
import RecentReportTimeline from '../components/RecentReportTimeline';
import ManualReviewCard from '../components/ManualReviewCard';

// --- DATA SOURCE: MEDICAL DICTIONARY ---
const TEST_DEFINITIONS = [
  { 
    name: 'Blood Sugar / Glucose', 
    aliases: ['sugar', 'glucose', 'diabetes', 'shakar', 'glycemia', 'sugar test'],
    english: 'Blood sugar means the amount of glucose in your blood. It helps show how your body is handling energy and diabetes risk.', 
    urdu: 'Blood sugar ka matlab khoon mein glucose ki quantity hoti hai. Is se pata chalta hai body sugar ko kaise control kar rahi hai.',
    safetyNote: 'This is not a diagnosis. Please verify with a doctor.'
  },
  { 
    name: 'Fasting Blood Sugar (FBS)', 
    aliases: ['fbs', 'fasting sugar', 'nahar munh sugar'],
    english: 'Measures glucose level after fasting (8-12 hours). Normal: 70-99 mg/dL. Prediabetes: 100-125 mg/dL. Diabetes: 126 mg/dL or higher.', 
    urdu: '8 se 12 ghante bhookay rehne ke baad sugar ka test. Normal: 70-99 mg/dL, Diabetes: 126 mg/dL ya zyada.',
    safetyNote: 'Requires at least 8 hours of fasting. Verify with a doctor.'
  },
  { 
    name: 'Random Blood Sugar (RBS)', 
    aliases: ['rbs', 'random sugar', 'anytime sugar'],
    english: 'Measures blood sugar at any time of day, regardless of when you last ate. Normal is usually below 140 mg/dL.', 
    urdu: 'Din mein kisi bhi waqt sugar ka test. Is ke liye bhooka rehna zaroori nahi. Normal aam tor par 140 se kam hota hai.',
    safetyNote: 'Results vary based on your last meal. Verify with a doctor.'
  },
  { 
    name: 'HbA1c (Glycated Hemoglobin)', 
    aliases: ['hba1c', 'a1c', '3 month sugar', 'average sugar'],
    english: 'Shows your average blood sugar level over the past 2-3 months. Normal: below 5.7%. Diabetes: 6.5% or higher.', 
    urdu: 'Pichlay 2 se 3 mahine ki sugar ki ost. Normal: 5.7% se kam, Diabetes: 6.5% ya zyada.',
    safetyNote: 'Best marker for long-term control. Verify with a doctor.'
  },
  { 
    name: 'Hemoglobin (Hb)', 
    aliases: ['hb', 'hgb', 'hemoglobin', 'blood level', 'anemia test'],
    english: 'A protein in red blood cells that carries oxygen. Low levels indicate anemia (khoon ki kami).', 
    urdu: 'Khoon ke surkh khalyat mein oxygen pohnchane wala protein. Kami se anemia (khoon ki kami) hoti hai.',
    safetyNote: 'Normal ranges differ for males and females.'
  },
  { 
    name: 'WBC (White Blood Cells)', 
    aliases: ['wbc', 'tlc', 'white cells', 'infection marker', 'leukocytes'],
    english: 'Immune system cells that fight infections. High levels often mean the body is fighting an infection.', 
    urdu: 'Beemariyon se larrnay walay cells. Ziyada hona jism mein kisi infection ya sozish ki alamat hai.',
    safetyNote: 'Very high levels require immediate doctor consultation.'
  },
  { 
    name: 'Platelets', 
    aliases: ['platelet count', 'plt', 'clotting cells', 'dengue test'],
    english: 'Small blood cells that help your blood clot. Low levels (thrombocytopenia) can cause easy bruising or bleeding.', 
    urdu: 'Khoon jamane aur zakhmon ko bhernay mein madad daine walay cells. Kami se khoon behne ka khatra hota hai.',
    safetyNote: 'Commonly monitored during Dengue or Viral fevers.'
  },
  { 
    name: 'Cholesterol (Total)', 
    aliases: ['cholesterol', 'total fats', 'blood fat'],
    english: 'Total amount of cholesterol in your blood. Desirable: below 200 mg/dL. High: 240 mg/dL or higher.', 
    urdu: 'Khoon mein majmooi charbi ki miqdar. Behtareen: 200 se kam. Zyada hona dil ki beemari ka khatra barhata hai.',
    safetyNote: 'High cholesterol often has no symptoms.'
  },
  { 
    name: 'LDL Cholesterol', 
    aliases: ['ldl', 'bad cholesterol', 'bad fat'],
    english: 'Known as "bad" cholesterol. It builds up in your arteries and increases heart attack risk. Optimal: below 100 mg/dL.', 
    urdu: 'Ise "bura" cholesterol kehte hain kyunke ye sharyano mein jam kar dil ke daure ka khatra barhata hai.',
    safetyNote: 'Lowering LDL is a primary goal in heart health.'
  },
  { 
    name: 'HDL Cholesterol', 
    aliases: ['hdl', 'good cholesterol', 'good fat'],
    english: 'Known as "good" cholesterol. It helps remove other forms of cholesterol from your bloodstream.', 
    urdu: 'Ise "acha" cholesterol kehte hain kyunke ye sharyano se faltu charbi ko saaf karne mein madad deta hai.',
    safetyNote: 'Higher levels are generally better for heart health.'
  },
  { 
    name: 'Triglycerides', 
    aliases: ['trig', 'tg', 'blood fats', 'vldl'],
    english: 'A type of fat (lipid) found in your blood. High levels can lead to thickening of artery walls. Normal: below 150 mg/dL.', 
    urdu: 'Khoon mein mojood charbi ki aik qisam. Is ki zyadti sharyano ko sakht kar sakti hai. Normal: 150 se kam.',
    safetyNote: 'Often high in people with poorly controlled diabetes.'
  },
  { 
    name: 'Creatinine', 
    aliases: ['creatinine', 'kidney test', 'renal function', 'kft', 'rft'],
    english: 'A waste product filtered by kidneys. High levels suggest kidneys are not filtering blood properly.', 
    urdu: 'Gurday ki karkardagi ka ahem test. Zyada hona gurday ki susti ya kharabi ko zahir karta hai.',
    safetyNote: 'Reference ranges vary based on age and muscle mass.'
  },
  { 
    name: 'BUN (Blood Urea Nitrogen)', 
    aliases: ['urea', 'bun', 'nitrogen test', 'kidney urea'],
    english: 'Measures the amount of nitrogen in your blood that comes from urea. Used to check kidney and liver health.', 
    urdu: 'Khoon mein urea ki miqdar. Ye test gurday aur jigar ki sehat janchnay ke liye kiya jata hai.',
    safetyNote: 'High urea can also be caused by dehydration.'
  },
  { 
    name: 'ALT (SGPT)', 
    aliases: ['alt', 'sgpt', 'liver enzyme', 'liver test', 'lft'],
    english: 'An enzyme found mostly in the liver. High levels indicate liver inflammation or damage (e.g., Hepatitis).', 
    urdu: 'Jigar mein mojood enzyme. Zyada hona jigar mein sozish ya kisi nuqsan (maslan Hepatitis) ki alamat hai.',
    safetyNote: 'Temporary spikes can happen due to certain medications.'
  },
  { 
    name: 'AST (SGOT)', 
    aliases: ['ast', 'sgot', 'liver enzyme 2'],
    english: 'An enzyme found in liver, heart, and muscles. Elevated along with ALT usually points to liver issues.', 
    urdu: 'Jigar, dil aur muscles mein paya janay wala enzyme. ALT ke sath iska barhna jigar ke masail ki nishandahi karta hai.',
    safetyNote: 'Used alongside ALT for a better liver health picture.'
  },
  { 
    name: 'TSH (Thyroid Stimulating Hormone)', 
    aliases: ['tsh', 'thyroid test', 'thyroid function', 'tft'],
    english: 'Controls thyroid hormone production. High TSH means underactive thyroid (Hypothyroidism). Low means overactive (Hyperthyroidism).', 
    urdu: 'Thyroid gland ko control karne wala hormone. Zyada hona sust thyroid aur kam hona teiz thyroid ki alamat hai.',
    safetyNote: 'Normal range is typically 0.4 to 4.0 mIU/L.'
  },
  { 
    name: 'Bilirubin', 
    aliases: ['bilirubin', 'jaundice test', 'yarqan', 'total bilirubin'],
    english: 'A yellowish pigment made during the breakdown of red blood cells. High levels cause Jaundice (yellowing of skin/eyes).', 
    urdu: 'Khoon ke tootne se banne wala peela mada. Ziyada hona Yarqan (Jaundice) ya jigar ki kharabi zahir karta hai.',
    safetyNote: 'Total, Direct, and Indirect bilirubin tell different stories.'
  },
  { 
    name: 'Urine Protein', 
    aliases: ['albumin urine', 'proteinuria', 'urine test', 'pue'],
    english: 'Presence of protein in urine. Usually suggests kidney stress or damage, especially in diabetes or high blood pressure.', 
    urdu: 'Peshab mein protein ka ana. Ye gurday par dabao ya kharabi ki alamat hai, khas tor par sugar ke mareezon mein.',
    safetyNote: 'Occasional small amounts can be normal after heavy exercise.'
  },
  { 
    name: 'Vitamin D (25-OH)', 
    aliases: ['vit d', 'vitamin d3', 'bone vitamin', 'sunshine vitamin'],
    english: 'Crucial for bone health and immune system. Most people in urban areas are deficient. Normal: 30-100 ng/mL.', 
    urdu: 'Haddion aur quwwat-e-madafat ke liye nihayat zaroori. Kami se jism aur haddion mein dard ho sakta hai.',
    safetyNote: 'Consult a doctor for the right supplement dose.'
  },
  { 
    name: 'Uric Acid', 
    aliases: ['uric acid', 'gout test', 'joint pain test'],
    english: 'Waste product that can form crystals in joints. High levels cause Gout (painful joints) or kidney stones.', 
    urdu: 'Khoon mein mojood fuzla. Ziyada hone se jorron mein dard (Gout) ya gurday ki pathri ho sakti hai.',
    safetyNote: 'Diet plays a big role in controlling uric acid.'
  }
];

// Helper to normalize search query
const normalizeSearch = (query) => {
  if (!query) return '';
  return query
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
    .replace(/\s{2,}/g, " ") // Remove extra spaces
    .replace(/\b(what|is|meaning|kya|hai|ka|ki|ke|report|test|of|in|the|a|an)\b/g, "") // Remove filler words
    .trim();
};

export default function HomeScreen({ navigation }) {
  console.log("DASHBOARD_RENDER");
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [recentReports, setRecentReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
  const [wikiSearch, setWikiSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [onlineResults, setOnlineResults] = useState([]);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  const { isDarkMode, toggleTheme } = useTheme();

  const getFilteredLocalWiki = useCallback((search) => {
    const query = normalizeSearch(search);
    if (!query) return [];
    
    return TEST_DEFINITIONS.filter(t => {
      const nameMatch = t.name.toLowerCase().includes(query);
      const aliasMatch = t.aliases && t.aliases.some(a => a.toLowerCase().includes(query) || query.includes(a.toLowerCase()));
      const engMatch = t.english.toLowerCase().includes(query);
      const urduMatch = t.urdu.toLowerCase().includes(query);
      return nameMatch || aliasMatch || engMatch || urduMatch;
    });
  }, []);

  const handleSearchSubmit = async () => {
    const query = wikiSearch.trim();
    if (!query) return;
    
    const localMatches = getFilteredLocalWiki(query);
    
    if (localMatches.length > 0) {
      setOnlineResults([]);
      return;
    }
    
    // Fallback: run online search
    await triggerOnlineSearch();
  };

  const triggerOnlineSearch = async () => {
    const query = wikiSearch.trim();
    if (!query) return;
    setSearchingOnline(true);
    setOnlineResults([]);
    setSearchError(null);
    try {
      const data = await searchWikiOnline(query);
      if (data && data.success === false) {
        setSearchError(data.error || "Online search is unavailable right now.");
        setOnlineResults([]);
      } else if (data && data.results && data.results.length > 0) {
        setOnlineResults(data.results);
      } else {
        setOnlineResults([]);
        setSearchError("No results found online. Showing local medical information instead.");
      }
    } catch (e) {
      console.warn("Online search failed:", e);
      setSearchError(e.message || "Could not connect to online search service.");
      setOnlineResults([]);
    } finally {
      setSearchingOnline(false);
    }
  };
  const [displayName, setDisplayName] = useState('');
  const [tempName, setTempName] = useState('');

  const loadCustomName = useCallback(async () => {
    try {
      const name = await AsyncStorage.getItem('user_display_name');
      if (name) {
        setDisplayName(name);
        setTempName(name);
      } else {
        const defaultName = currentUser ? (currentUser.email ? currentUser.email.split('@')[0] : 'User') : 'Guest';
        setDisplayName(defaultName);
        setTempName(defaultName);
      }
    } catch (e) {
      console.warn("[Name] Load error:", e.message);
    }
  }, [currentUser]);

  const handleClearHistory = async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to permanently delete all your scanned and saved reports? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: async () => {
            try {
              const userId = currentUser?.id || 'guest';
              await clearReportHistory(userId);
              Alert.alert("Success", "Your scan history has been cleared.");
              setShowProfile(false);
              fetchDashboardData();
            } catch (err) {
              Alert.alert("Error", "Failed to clear history.");
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    try {
      setShowProfile(false);
      await logoutUser();
    } catch (err) {
      Alert.alert("Error", "Failed to log out.");
    }
  };

  const handleExportPdf = async () => {
    if (!recentReports || recentReports.length === 0) {
      Alert.alert(
        "No Reports Found",
        "Please scan or enter a report first before exporting a PDF summary."
      );
      return;
    }
    
    const userId = currentUser?.id || 'guest';
    const url = `${API_BASE}/api/reports/pdf/${userId}`;
    
    Alert.alert(
      "Export PDF Summary",
      "Would you like to generate and download a shareable PDF summary of your latest report?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Download PDF", 
          onPress: async () => {
            try {
              const { Linking } = require('react-native');
              await Linking.openURL(url);
            } catch (err) {
              Alert.alert("Error", "Could not open browser to download PDF.");
            }
          } 
        }
      ]
    );
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      await checkBackendHealth();
    } catch (err) {
      console.warn("[WARN] Backend health check failed:", err.message);
    }
    try {
      const user = getCurrentUser();
      const userId = user?.id || 'guest';
      const history = await getReportHistory(userId);
      if (Array.isArray(history)) {
        setRecentReports(history.slice(0, 5));
      }
    } catch (err) {
      console.warn("[WARN] Dashboard history fetch failed:", err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    loadCustomName();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
      loadCustomName();
    });

    const interval = setInterval(() => {
      const user = getCurrentUser();
      setCurrentUser(user);
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [navigation, fetchDashboardData, loadCustomName]);

  useEffect(() => {
    const query = wikiSearch.trim();
    if (!query) {
      setOnlineResults([]);
      setSearchingOnline(false);
      return;
    }

    const localMatches = getFilteredLocalWiki(query);
    
    if (localMatches.length > 0) {
      setOnlineResults([]);
      setSearchingOnline(false);
      return;
    }

    // Automatically search Google after 1.5s of no typing if no local results
    const delayDebounceFn = setTimeout(async () => {
      setSearchingOnline(true);
      setOnlineResults([]);
      try {
        const data = await searchWikiOnline(query);
        if (data && data.results && data.results.length > 0) {
          setOnlineResults(data.results);
        } else {
          setOnlineResults([]);
        }
      } catch (e) {
        console.warn("Auto search online failed: ", e.message);
      } finally {
        setSearchingOnline(false);
      }
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [wikiSearch, getFilteredLocalWiki]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  // --- LOGIC: DYNAMIC HEALTH SCORE ---
  const healthScore = useMemo(() => {
    return calculateHealthScore(recentReports[0]);
  }, [recentReports]);

  // Animations for Health Score
  const blinkAnim = useRef(new Animated.Value(0.3)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [blinkAnim]);

  useEffect(() => {
    if (healthScore !== null) {
      Animated.timing(progressAnim, {
        toValue: healthScore,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [healthScore]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // --- LOGIC: WATCHLIST (ABNORMAL MARKERS) ---
  const abnormalWatchlist = useMemo(() => {
    if (!recentReports || recentReports.length === 0) return [];
    const latest = recentReports[0]?.report?.report?.tests || recentReports[0]?.report?.tests || [];
    return latest.filter(t => {
      const s = (t.status || '').toLowerCase().trim();
      return s !== 'normal' && s !== 'unknown' && s !== '';
    });
  }, [recentReports]);

  // --- LOGIC: BIOMARKERS STATUS COLOR ---
  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'normal') return '#10b981';
    if (s === 'high' || s === 'low' || s === 'moderate') return '#f59e0b';
    if (s === 'very high' || s === 'critical') return '#ef4444';
    return '#94a3b8'; // Gray for unknown
  };

  const getWatchlistBorderColor = () => {
    if (!recentReports || recentReports.length === 0) return '#64748b';
    if (abnormalWatchlist.length > 0) {
      const hasCritical = abnormalWatchlist.some(t => {
        const s = (t.status || '').toLowerCase().trim();
        return s === 'critical' || s === 'very high';
      });
      return hasCritical ? '#ef4444' : '#f59e0b';
    }
    return '#10b981';
  };

  const filteredWiki = getFilteredLocalWiki(wikiSearch);

  const latestReport = recentReports.length > 0 ? recentReports[0]?.report : null;

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    scanBannerBg: isDarkMode ? '#1e3a8a' : '#0ea5e9',
    scanBannerTitle: '#ffffff',
    scanBannerDesc: isDarkMode ? '#93c5fd' : '#e0f2fe',
    scanIconBg: '#ffffff',
    scanIconColor: isDarkMode ? '#1e3a8a' : '#0ea5e9',
  };


  return (
    <ResponsiveScreen 
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + Math.max(insets.bottom, 10) }]} 
      edges={['bottom']} 
      scrollable={true}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#0f172a' : '#fff'} />
      
      {/* 1. GREETING & HEADER */}
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <Text style={[styles.greetingText, { color: colors.text }]} numberOfLines={1}>
            Hi, {displayName || 'User'} 👋
          </Text>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{new Date().toDateString()}</Text>
        </View>
        <TouchableOpacity style={styles.avatarCircle} onPress={() => { setTempName(displayName); setShowProfile(true); }}>
          <Ionicons name="person-circle" size={scale(40)} color="#0ea5e9" />
        </TouchableOpacity>
      </View>
 
      {/* 2. HEALTH SCORE & QUICK METRIC WIDGET */}
      <View style={styles.topWidgetsRow}>
        <TouchableOpacity 
          style={{ flex: 1.2 }}
          activeOpacity={0.8}
          onPress={() => {
            if (recentReports && recentReports.length > 0) {
              navigation.navigate('Result', { result: recentReports[0].report });
            } else {
              navigation.navigate('Scan');
            }
          }}
        >
          <AppCard style={[
            styles.scoreCard, 
            { 
              backgroundColor: colors.cardBg, 
              borderColor: getScoreColor(healthScore) + '25',
              borderTopColor: getScoreColor(healthScore),
              borderTopWidth: 5,
              marginBottom: 0,
              height: '100%'
            }
          ]}>
            <View style={styles.scoreCardHeader}>
              <Text style={[styles.widgetTitle, { color: colors.textMuted }]}>Health Score</Text>
              <View style={[styles.pulseContainer, { backgroundColor: getScoreColorLight(healthScore) }]}>
                <Animated.View style={[
                  styles.pulseLight, 
                  { 
                    backgroundColor: getScoreColor(healthScore),
                    opacity: blinkAnim,
                  }
                ]} />
                <Text style={[styles.pulseText, { color: getScoreColor(healthScore) }]}>
                  {getScoreStatusText(healthScore)}
                </Text>
              </View>
            </View>
            
            <View style={styles.scoreContainer}>
              <Text style={[styles.scoreValue, { color: getScoreColor(healthScore) }]}>
                {healthScore !== null ? healthScore : '--'}
              </Text>
              <Text style={[styles.scoreMax, { color: isDarkMode ? '#475569' : '#cbd5e1' }]}>/100</Text>
            </View>

            {/* Animated Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
              <Animated.View style={[
                styles.progressBarFill, 
                { 
                  width: animatedWidth, 
                  backgroundColor: getScoreColor(healthScore) 
                }
              ]} />
            </View>

            <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
              {healthScore !== null ? 'Based on latest report ↗' : 'Tap to scan first report ↗'}
            </Text>
          </AppCard>
        </TouchableOpacity>
 
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.8}
          onPress={() => {
            navigation.navigate('Trends');
          }}
        >
          <AppCard style={[
            styles.watchlistCard, 
            { 
              backgroundColor: colors.cardBg, 
              borderColor: getWatchlistBorderColor() + '25', 
              borderTopColor: getWatchlistBorderColor(),
              borderTopWidth: 5,
              marginBottom: 0, 
              height: '100%' 
            }
          ]}>
            <View style={styles.scoreCardHeader}>
              <Text style={[styles.widgetTitle, { color: colors.textMuted }]}>Biomarkers</Text>
              {recentReports.length > 0 && (
                <View style={[
                  styles.pulseContainer, 
                  { 
                    backgroundColor: abnormalWatchlist.length > 0 ? getScoreColorLight(abnormalWatchlist.length === 1 ? 60 : 30) : 'rgba(16, 185, 129, 0.12)' 
                  }
                ]}>
                  <Text style={[
                    styles.pulseText, 
                    { 
                      color: abnormalWatchlist.length > 0 ? getScoreColor(abnormalWatchlist.length === 1 ? 60 : 30) : '#10b981' 
                    }
                  ]}>
                    {abnormalWatchlist.length > 0 ? `${abnormalWatchlist.length} Alert${abnormalWatchlist.length > 1 ? 's' : ''}` : 'All Clear'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.watchlistItems}>
              {recentReports.length === 0 ? (
                <>
                  <View style={styles.watchItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#64748b' }]} />
                    <Text style={[styles.watchText, { color: colors.textMuted }]} numberOfLines={1}>No scans yet ↗</Text>
                  </View>
                  <View style={styles.watchItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#0ea5e9' }]} />
                    <Text style={[styles.watchText, { color: colors.textMuted }]} numberOfLines={1}>0 Reports Saved ↗</Text>
                  </View>
                </>
              ) : abnormalWatchlist.length === 0 ? (
                <>
                  <View style={styles.watchItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                    <Text style={[styles.watchText, { color: colors.text }]} numberOfLines={1}>All markers normal ↗</Text>
                  </View>
                  <View style={styles.watchItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#0ea5e9' }]} />
                    <Text style={[styles.watchText, { color: colors.text }]} numberOfLines={1}>
                      {recentReports.length} {recentReports.length === 1 ? 'Report' : 'Reports'} Saved ↗
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.watchItem}>
                    <Animated.View style={[
                      styles.statusDot, 
                      { 
                        backgroundColor: getStatusColor(abnormalWatchlist[0].status),
                        opacity: blinkAnim 
                      }
                    ]} />
                    <Text style={[styles.watchText, { color: colors.text }]} numberOfLines={1}>
                      {abnormalWatchlist[0].testName}: {abnormalWatchlist[0].status} ↗
                    </Text>
                  </View>
                  {abnormalWatchlist.length >= 2 ? (
                    <View style={styles.watchItem}>
                      <Animated.View style={[
                        styles.statusDot, 
                        { 
                          backgroundColor: getStatusColor(abnormalWatchlist[1].status),
                          opacity: blinkAnim 
                        }
                      ]} />
                      <Text style={[styles.watchText, { color: colors.text }]} numberOfLines={1}>
                        {abnormalWatchlist[1].testName}: {abnormalWatchlist[1].status} ↗
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.watchItem}>
                      <View style={[styles.statusDot, { backgroundColor: '#0ea5e9' }]} />
                      <Text style={[styles.watchText, { color: colors.text }]} numberOfLines={1}>
                        {recentReports.length} {recentReports.length === 1 ? 'Report' : 'Reports'} Saved ↗
                      </Text>
                    </View>
                  )}
                  {abnormalWatchlist.length > 2 && (
                    <Text style={styles.moreAlertsText} numberOfLines={1}>
                      + {abnormalWatchlist.length - 2} more out of range ↗
                    </Text>
                  )}
                </>
              )}
            </View>
          </AppCard>
        </TouchableOpacity>
      </View>
 
      {/* 3. PRIMARY ACTION: AI SCAN */}
      <TouchableOpacity 
        style={[styles.scanBanner, { backgroundColor: colors.scanBannerBg }]} 
        activeOpacity={0.9} 
        onPress={() => navigation.navigate('Scan')}
      >
        {/* Decorative Circles */}
        <View style={[styles.bannerCircle1, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)' }]} />
        <View style={[styles.bannerCircle2, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.15)' }]} />

        <View style={styles.scanTextContainer}>
          <Text style={[styles.scanTitle, { color: colors.scanBannerTitle }]}>New Lab Scan</Text>
          <Text style={[styles.scanDesc, { color: colors.scanBannerDesc }]}>Analyze blood, urine, or radiology reports instantly.</Text>
        </View>
        <View style={[styles.scanIconBox, { backgroundColor: colors.scanIconBg }]}>
          <Ionicons name="camera" size={scale(28)} color={colors.scanIconColor} />
        </View>
      </TouchableOpacity>
 
      {/* 4. QUICK ACTION GRID */}
      <QuickActionGrid 
        navigation={navigation}
        isDarkMode={isDarkMode}
        onManualPress={(type) => {
          if (type === 'wiki') {
            setShowWiki(true);
          } else if (type === 'manual') {
            navigation.navigate('Scan', { openManual: true });
          } else if (type === 'pdf') {
            handleExportPdf();
          } else {
            navigation.navigate('Scan');
          }
        }}
      />
 
      {/* 5. HOW IT WORKS CARD (EMPTY STATE ONLY) */}
      {recentReports.length === 0 && (
        <AppCard style={[styles.howItWorksCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.howItWorksTitle, { color: colors.text }]}>How MediReport AI Works 💡</Text>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>1</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Take or upload a photo of your medical lab report.</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>2</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Our AI extracts and verifies all values and references.</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>3</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Get a safe Roman Urdu and English analysis instantly!</Text>
          </View>
        </AppCard>
      )}
 
      {/* 6. HEALTH OVERVIEW MODULES */}
      {latestReport && (
        <View>
          <ManualReviewCard latestReport={latestReport} isDarkMode={isDarkMode} />
          <HealthSummaryCard latestReport={latestReport} isDarkMode={isDarkMode} />
          <ReportConfidenceCard latestReport={latestReport} isDarkMode={isDarkMode} />
          <CompareReportCard reports={recentReports} isDarkMode={isDarkMode} />
        </View>
      )}
 
      {/* 7. ALERTS / WATCHLIST CARD */}
      <CriticalAlertsCard latestReport={latestReport} isDarkMode={isDarkMode} />
 
      {/* 8. TIMELINE / RECENT ACTIVITY */}
      <RecentReportTimeline 
        reports={recentReports} 
        isDarkMode={isDarkMode}
        onSelectReport={(report) => navigation.navigate('Result', { result: report })}
      />
 
      {/* 9. HEALTH TIPS CARD */}
      <HealthTipsCard latestReport={latestReport} isDarkMode={isDarkMode} />
 
      {/* 10. SAFETY DISCLAIMER */}
      <View style={[styles.disclaimerContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          ⚠️ This is not a diagnosis. Please consult a qualified doctor.
        </Text>
      </View>
 
      {/* MODAL: MEDICAL WIKI */}
      <Modal visible={showWiki} animationType="fade" transparent={true} onRequestClose={() => setShowWiki(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.6)' }]}>
          <View style={[styles.wikiContainer, { backgroundColor: colors.cardBg }]}>
            <View style={styles.wikiHeader}>
              <Text style={[styles.wikiTitle, { color: colors.text }]}>Medical Encyclopedia</Text>
              <TouchableOpacity onPress={() => setShowWiki(false)}>
                <Ionicons name="close-circle" size={32} color={isDarkMode ? '#94a3b8' : '#cbd5e1'} />
              </TouchableOpacity>
            </View>
            <View style={styles.wikiSearchContainer}>
              <TextInput 
                style={[
                  styles.wikiInputStyle, 
                  { 
                    backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', 
                    color: colors.text,
                    borderColor: isDarkMode ? '#334155' : '#cbd5e1'
                  }
                ]}
                placeholder="Search test (e.g. Hb, Sugar...)"
                placeholderTextColor={colors.textMuted}
                value={wikiSearch}
                onChangeText={(text) => {
                  setWikiSearch(text);
                  if (onlineResults.length > 0) {
                    setOnlineResults([]);
                  }
                }}
                onSubmitEditing={handleSearchSubmit}
              />
              <TouchableOpacity 
                style={styles.wikiSearchSubmitBtn} 
                onPress={handleSearchSubmit} 
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.wikiSearchSubmitText}>Search</Text>
              </TouchableOpacity>
            </View>

            {wikiSearch.trim().length > 0 && (
              <TouchableOpacity 
                style={[
                  styles.onlineSearchBtn, 
                  { 
                    backgroundColor: isDarkMode ? '#1e293b' : '#f0f9ff',
                    borderColor: isDarkMode ? '#334155' : '#0ea5e9'
                  }
                ]}
                onPress={triggerOnlineSearch}
                activeOpacity={0.8}
              >
                <Ionicons name="globe-outline" size={16} color="#0ea5e9" style={{ marginRight: 6 }} />
                <Text style={[styles.onlineSearchText, { color: isDarkMode ? '#38bdf8' : '#0284c7' }]}>
                  Fetch Google results for "{wikiSearch.trim()}"
                </Text>
                <Ionicons name="arrow-forward-outline" size={14} color="#0ea5e9" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}
 
            <ScrollView style={styles.wikiScroll}>
              {searchingOnline ? (
                <View style={styles.searchingOnlineLoader}>
                  <ActivityIndicator size="large" color="#0ea5e9" style={{ marginBottom: 10 }} />
                  <Text style={[styles.searchingOnlineText, { color: colors.text }]}>Searching Google Database...</Text>
                  <Text style={[styles.searchingOnlineSub, { color: colors.textMuted }]}>Extracting medical definitions for "{wikiSearch}"</Text>
                </View>
              ) : onlineResults.length > 0 ? (
                /* Google / Online Results */
                <View style={{ gap: 16 }}>
                  <Text style={[styles.onlineHeaderTitle, { color: colors.textMuted }]}>Google Search Results (Structured)</Text>
                  {onlineResults.map((t, idx) => (
                    <View key={idx} style={[styles.wikiItem, { borderBottomColor: colors.border }]}>
                      <Text style={styles.wikiItemName}>{t.title}</Text>
                      <Text style={[styles.wikiItemEng, { color: colors.text, lineHeight: 20 }]}>{t.snippet}</Text>
                      {t.link ? (
                        <TouchableOpacity 
                          style={styles.linkRow} 
                          onPress={async () => {
                            const { Linking } = require('react-native');
                            try {
                              await Linking.openURL(t.link);
                            } catch (e) {}
                          }}
                        >
                          <Text style={styles.linkText}>Source: {t.link.split('/')[2] || 'Web'} ↗</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : filteredWiki.length > 0 ? (
                /* Local Results */
                filteredWiki.map((t, idx) => (
                  <View key={idx} style={[styles.wikiItem, { borderBottomColor: colors.border }]}>
                    <Text style={styles.wikiItemName}>{t.name}</Text>
                    <Text style={[styles.wikiItemEng, { color: colors.textMuted }]}>• {t.english}</Text>
                    <Text style={[styles.wikiItemUrdu, { color: colors.text }]}>• {t.urdu}</Text>
                    {t.safetyNote && (
                      <View style={[styles.safetyNoteBox, { backgroundColor: isDarkMode ? '#334155' : '#f8fafc' }]}>
                        <Text style={[styles.safetyNoteText, { color: colors.textMuted }]}>
                          <Ionicons name="information-circle" size={12} color="#0ea5e9" /> {t.safetyNote}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                /* Empty Results */
                <View style={styles.emptyWikiContainer}>
                  {searchError ? (
                    <View style={[styles.inlineErrorBox, { backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderColor: isDarkMode ? '#991b1b' : '#fee2e2' }]}>
                      <Ionicons name="alert-circle" size={20} color="#ef4444" />
                      <Text style={[styles.inlineErrorText, { color: isDarkMode ? '#fecaca' : '#b91c1c' }]}>{searchError}</Text>
                    </View>
                  ) : (
                    <Ionicons name="search-outline" size={36} color={colors.textMuted} style={{ marginBottom: 8 }} />
                  )}
                  
                  <Text style={[styles.emptyWikiText, { color: colors.text }]}>
                    {wikiSearch.trim() ? `No exact result for "${wikiSearch}"` : 'Search for a medical test'}
                  </Text>
                  
                  <View style={styles.suggestionBox}>
                    <Text style={[styles.suggestionTitle, { color: colors.textMuted }]}>Try searching for:</Text>
                    <View style={styles.suggestionRow}>
                      {['Sugar', 'Glucose', 'HbA1c', 'Cholesterol', 'Creatinine', 'ALT', 'TSH'].map((item) => (
                        <TouchableOpacity 
                          key={item} 
                          style={[styles.suggestionChip, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}
                          onPress={() => setWikiSearch(item)}
                        >
                          <Text style={[styles.suggestionChipText, { color: colors.text }]}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: PROFILE SETTINGS */}
      <Modal visible={showProfile} animationType="slide" transparent={true} onRequestClose={() => setShowProfile(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.6)' }]}>
          <View style={[styles.wikiContainer, { backgroundColor: colors.cardBg }]}>
            <View style={styles.wikiHeader}>
              <Text style={[styles.wikiTitle, { color: colors.text }]}>My Profile</Text>
              <TouchableOpacity onPress={() => setShowProfile(false)}>
                <Ionicons name="close-circle" size={32} color={isDarkMode ? '#94a3b8' : '#cbd5e1'} />
              </TouchableOpacity>
            </View>

            {/* Profile Info */}
            <View style={[styles.profileInfoSection, { borderBottomColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={scale(72)} color="#0ea5e9" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={[styles.profileNameText, { color: colors.text }]}>
                {displayName || 'User'}
              </Text>
              <Text style={[styles.profileEmailText, { color: colors.textMuted }]}>
                {currentUser?.email || 'guest@local'}
              </Text>

              {/* Name Editor */}
              <View style={styles.nameEditBox}>
                <TextInput
                  style={[styles.nameEditInput, { 
                    backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', 
                    color: colors.text,
                    borderColor: isDarkMode ? '#334155' : '#cbd5e1'
                  }]}
                  value={tempName}
                  onChangeText={setTempName}
                  placeholder="Edit Name..."
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity 
                  style={styles.nameSaveBtn}
                  onPress={async () => {
                    if (!tempName.trim()) {
                      Alert.alert("Error", "Name cannot be empty");
                      return;
                    }
                    try {
                      await AsyncStorage.setItem('user_display_name', tempName.trim());
                      setDisplayName(tempName.trim());
                      Alert.alert("Success", "Name updated successfully!");
                    } catch (e) {
                      Alert.alert("Error", "Failed to save name");
                    }
                  }}
                >
                  <Text style={styles.nameSaveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.roleBadge, { backgroundColor: currentUser?.isGuest || !currentUser?.email ? (isDarkMode ? '#334155' : '#f1f5f9') : '#e0f2fe', marginTop: 12 }]}>
                <Text style={[styles.roleBadgeText, { color: currentUser?.isGuest || !currentUser?.email ? (isDarkMode ? '#94a3b8' : '#64748b') : '#0369a1' }]}>
                  {currentUser?.isGuest || !currentUser?.email ? 'GUEST SESSION' : 'REGISTERED USER'}
                </Text>
              </View>
            </View>

            {/* Settings Options */}
            <ScrollView style={{ marginVertical: 16 }}>
              {/* Theme Settings Row */}
              <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsLabelCol}>
                  <Ionicons name={isDarkMode ? "moon" : "sunny"} size={22} color="#0ea5e9" />
                  <Text style={[styles.settingsLabelText, { color: colors.text }]}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#cbd5e1', true: '#0ea5e9' }}
                  thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
                />
              </View>

              {/* Clear History Settings Row */}
              <TouchableOpacity 
                style={[styles.settingsRow, { borderBottomColor: colors.border }]}
                onPress={handleClearHistory}
              >
                <View style={styles.settingsLabelCol}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                  <Text style={[styles.settingsLabelText, { color: '#ef4444' }]}>Clear Scan History</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ef4444" />
              </TouchableOpacity>

              {/* Logout Row */}
              <TouchableOpacity 
                style={styles.settingsRow}
                onPress={handleLogout}
              >
                <View style={styles.settingsLabelCol}>
                  <Ionicons name="log-out-outline" size={22} color="#94a3b8" />
                  <Text style={[styles.settingsLabelText, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>Sign Out / Exit</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
 
      <View style={styles.bottomGap} />
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: scale(20), paddingTop: verticalScale(10) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(24) },
  greetingText: { fontSize: fs(24), fontWeight: '900', color: '#0f172a', flex: 1, marginRight: 10 },
  dateText: { fontSize: fs(13), color: '#94a3b8', marginTop: 2 },
  avatarCircle: { flexShrink: 0 },
  
  topWidgetsRow: { flexDirection: 'row', gap: scale(12), marginBottom: verticalScale(24), alignItems: 'stretch' },
  scoreCard: { flex: 1.2, padding: scale(16), borderRadius: 24, marginBottom: 0, backgroundColor: '#fff' },
  scoreCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(6) },
  pulseContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(6), paddingVertical: verticalScale(3), borderRadius: 10 },
  pulseLight: { width: scale(7), height: scale(7), borderRadius: scale(3.5) },
  pulseText: { fontSize: fs(9), fontWeight: '800', textTransform: 'uppercase', marginLeft: scale(4) },
  progressBarBg: { height: verticalScale(6), width: '100%', borderRadius: 3, marginVertical: verticalScale(8), overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  widgetTitle: { fontSize: fs(11), fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 0 },
  scoreContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 },
  scoreValue: { fontSize: fs(34), fontWeight: '900' },
  scoreMax: { fontSize: fs(14), color: '#cbd5e1', fontWeight: '700' },
  scoreSub: { fontSize: fs(10), color: '#94a3b8' },

  watchlistCard: { flex: 1, padding: scale(16), borderRadius: 24, marginBottom: 0 },
  watchlistItems: { gap: 8, marginTop: 4 },
  watchItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  watchText: { fontSize: fs(11), fontWeight: '700', color: '#475569' },

  scanBanner: { borderRadius: 28, padding: scale(20), flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(28), overflow: 'hidden', position: 'relative' },
  bannerCircle1: { position: 'absolute', right: -20, top: -20, width: scale(100), height: scale(100), borderRadius: scale(50) },
  bannerCircle2: { position: 'absolute', right: 40, bottom: -40, width: scale(80), height: scale(80), borderRadius: scale(40) },
  scanTextContainer: { flex: 1, zIndex: 2 },
  scanTitle: { fontSize: fs(20), fontWeight: '900', marginBottom: 4 },
  scanDesc: { fontSize: fs(12), lineHeight: 18 },
  scanIconBox: { width: scale(56), height: scale(56), borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 10, zIndex: 2 },

  howItWorksCard: {
    backgroundColor: '#f8fafc',
    padding: scale(18),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: verticalScale(16),
  },
  howItWorksTitle: {
    fontSize: fs(15),
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: verticalScale(12),
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  stepNum: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: scale(22),
    fontWeight: '800',
    fontSize: fs(11),
    marginRight: scale(10),
  },
  stepText: {
    fontSize: fs(12),
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },

  disclaimerContainer: {
    padding: scale(16),
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: verticalScale(16),
    marginBottom: verticalScale(16),
  },
  disclaimerText: {
    fontSize: fs(11),
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Wiki Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  wikiContainer: { backgroundColor: '#fff', borderRadius: 32, padding: 24, maxHeight: '85%' },
  wikiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  wikiTitle: { fontSize: fs(20), fontWeight: '900', color: '#0f172a' },
  wikiInput: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginBottom: 20, fontSize: fs(14) },
  wikiScroll: { gap: 16 },
  wikiItem: { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 12 },
  wikiItemName: { fontSize: fs(15), fontWeight: '800', color: '#0ea5e9', marginBottom: 4 },
  wikiItemEng: { fontSize: fs(13), color: '#475569', lineHeight: 18 },
  wikiItemUrdu: { fontSize: fs(13), color: '#1e293b', fontWeight: '600' },
  moreAlertsText: { fontSize: fs(9), color: '#64748b', fontWeight: '700', marginTop: scale(4) },
  profileInfoSection: { alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, marginBottom: 10, width: '100%' },
  profileNameText: { fontSize: fs(18), fontWeight: '900', marginBottom: 4 },
  profileEmailText: { fontSize: fs(13), color: '#94a3b8', marginBottom: 12 },
  nameEditBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, width: '100%', paddingHorizontal: scale(10) },
  nameEditInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, fontSize: fs(14) },
  nameSaveBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  nameSaveBtnText: { color: '#ffffff', fontWeight: '800', fontSize: fs(13) },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { fontSize: fs(10), fontWeight: '800' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  settingsLabelCol: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsLabelText: { fontSize: fs(14), fontWeight: '700' },
  bottomGap: { height: verticalScale(100) },
  wikiSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    width: '100%',
  },
  wikiInputStyle: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: fs(14),
  },
  wikiSearchSubmitBtn: {
    backgroundColor: '#0ea5e9',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wikiSearchSubmitText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: fs(13),
  },
  searchingOnlineLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(40),
  },
  searchingOnlineText: {
    fontSize: fs(15),
    fontWeight: '800',
    marginBottom: 4,
  },
  searchingOnlineSub: {
    fontSize: fs(12),
  },
  onlineHeaderTitle: {
    fontSize: fs(11),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  linkRow: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  linkText: {
    color: '#0ea5e9',
    fontSize: fs(11),
    fontWeight: '700',
  },
  onlineSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  onlineSearchText: {
    fontSize: fs(13),
    fontWeight: '800',
  },
  emptyWikiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(30),
    paddingHorizontal: scale(10),
  },
  emptyWikiText: {
    fontSize: fs(14),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyWikiSub: {
    fontSize: fs(12),
    textAlign: 'center',
  },
  safetyNoteBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  safetyNoteText: {
    fontSize: fs(11),
    fontStyle: 'italic',
    lineHeight: 16,
  },
  inlineErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  inlineErrorText: {
    fontSize: fs(12),
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  suggestionBox: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  suggestionTitle: {
    fontSize: fs(12),
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  suggestionChipText: {
    fontSize: fs(11),
    fontWeight: '600',
  },
});
