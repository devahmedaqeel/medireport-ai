import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ResponsiveScreen from '../components/ResponsiveScreen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useTheme } from '../components/ThemeContext';

export default function DisclaimerScreen({ navigation }) {
  const { isDarkMode } = useTheme();

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
  };

  return (
    <ResponsiveScreen style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={styles.emoji}>🛡️</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Safety & Privacy</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Please read our medical guidelines carefully before using the app.</Text>
      </View>

      <AppCard style={[styles.policyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#bae6fd' : '#1e293b' }]}>1. Not a Medical Diagnosis</Text>
        <Text style={[styles.policyText, { color: colors.textMuted }]}>
          This is not a diagnosis. Please consult a qualified doctor.
        </Text>

        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#bae6fd' : '#1e293b' }]}>2. Consult a Professional</Text>
        <Text style={[styles.policyText, { color: colors.textMuted }]}>
          Always consult with a qualified physician or healthcare provider regarding any medical condition or the interpretation of your lab results. Never disregard professional medical advice.
        </Text>

        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#bae6fd' : '#1e293b' }]}>3. Data Privacy</Text>
        <Text style={[styles.policyText, { color: colors.textMuted }]}>
          Your uploaded reports are processed securely. While we use standard encryption, do not upload reports containing sensitive personal identification if you wish to remain completely anonymous in guest mode.
        </Text>

        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#bae6fd' : '#1e293b' }]}>4. Accuracy of OCR</Text>
        <Text style={[styles.policyText, { color: colors.textMuted }]}>
          Optical Character Recognition (OCR) may occasionally misread numbers due to image quality. Always verify the extracted text in the "Verify" screen before generating an analysis.
        </Text>
      </AppCard>

      <AppButton 
        title="I Understand" 
        onPress={() => navigation.goBack()} 
        style={[styles.closeButton, isDarkMode ? { backgroundColor: '#1e293b' } : null]}
      />
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: scale(20), paddingBottom: verticalScale(40) },
  header: { alignItems: 'center', marginBottom: verticalScale(32) },
  iconBadge: { 
    width: scale(70), 
    height: scale(70), 
    borderRadius: scale(35), 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: verticalScale(16), 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6 
  },
  emoji: { fontSize: fs(32) },
  title: { fontSize: fs(24), fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  subtitle: { fontSize: fs(14), color: '#64748b', textAlign: 'center', marginTop: verticalScale(8), lineHeight: 20 },
  policyCard: { backgroundColor: '#fff', borderRadius: 24, padding: scale(20) },
  sectionTitle: { fontSize: fs(15), fontWeight: '800', color: '#1e293b', marginTop: verticalScale(16), marginBottom: verticalScale(6) },
  policyText: { fontSize: fs(13), color: '#64748b', lineHeight: 20 },
  closeButton: { marginTop: verticalScale(24), backgroundColor: '#0f172a' }
});