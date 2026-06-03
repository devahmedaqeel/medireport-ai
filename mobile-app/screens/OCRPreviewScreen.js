import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  ActivityIndicator
} from 'react-native';
import ResponsiveScreen from '../components/ResponsiveScreen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import { analyzeTextDirect } from '../services/api';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeContext';

export default function OCRPreviewScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(route.params?.ocrText || '');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('Analyzing medical values...');
  const { isDarkMode } = useTheme();

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
  };

  const analyze = async () => {
    if (!text.trim()) {
      Alert.alert("Empty Text", "Please ensure there is text to analyze.");
      return;
    }
    if (text.trim().length < 10) {
      Alert.alert("Too Short", "Please paste the full content of your lab report.");
      return;
    }
    setLoading(true);
    try {
      setProgressText("Analyzing medical markers...");
      // Single call to analyzeTextDirect — runs parse + analyze + explain in one request
      const result = await analyzeTextDirect(text);
      navigation.navigate('Result', { result });
    } catch (error) {
      console.error("OCR Preview Analysis Error:", error);
      Alert.alert(
        "Analysis Failed",
        "Could not complete the analysis. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveScreen 
      style={{ backgroundColor: colors.bg }}
      keyboardAvoiding={true} 
      scrollable={true}
      contentContainerStyle={[styles.content, { paddingBottom: verticalScale(100) + insets.bottom }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Verify Text</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Check and correct any numbers if the OCR missed them.</Text>
      </View>

      <AppCard style={[styles.editorContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <TextInput 
          value={text} 
          onChangeText={setText} 
          multiline 
          style={[styles.input, { color: colors.text }]} 
          placeholder="Paste or edit report text here..."
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </AppCard>

      <AppButton 
        title="Generate Analysis Result" 
        onPress={analyze} 
        loading={loading}
        style={styles.analyzeButton}
      />

      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={[styles.loadingText, { color: colors.text }]}>{progressText}</Text>
          <Text style={[styles.loadingSub, { color: colors.textMuted }]}>AI interpreting your health markers...</Text>
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: scale(20), paddingBottom: verticalScale(40) },
  header: { marginBottom: verticalScale(20) },
  title: { fontSize: fs(24), fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: fs(14), color: '#64748b', marginTop: verticalScale(4), lineHeight: 20 },
  editorContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    minHeight: verticalScale(320),
    padding: scale(16),
    marginBottom: verticalScale(24)
  },
  input: { 
    flex: 1, 
    fontSize: fs(14), 
    color: '#334155', 
    lineHeight: 22
  },
  analyzeButton: { height: 60, borderRadius: 18 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  loadingText: { marginTop: verticalScale(16), fontSize: fs(18), fontWeight: '800', color: '#0f172a' },
  loadingSub: { fontSize: fs(13), color: '#64748b', marginTop: verticalScale(6) }
});
