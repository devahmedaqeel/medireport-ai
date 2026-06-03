import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert
} from 'react-native';
import ResponsiveScreen from '../components/ResponsiveScreen';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import { signUpUser } from '../services/authService';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useTheme } from '../components/ThemeContext';

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useTheme();

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    inputBg: isDarkMode ? '#0f172a' : '#fcfdfe',
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUpUser(email, password);
      Alert.alert('Success', 'Your account has been created successfully!');
    } catch (err) {
      console.error(err);
      Alert.alert('Sign Up Failed', err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveScreen 
      style={{ backgroundColor: colors.bg }}
      keyboardAvoiding={true} 
      scrollable={true} 
      contentContainerStyle={styles.content} 
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <View style={[styles.logoBadge, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={styles.logoEmoji}>🌱</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Join MediReport</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Start tracking your health today</Text>
      </View>

      <AppCard style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
          <TextInput 
            value={email}
            onChangeText={setEmail}
            placeholder="yourname@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Create Password</Text>
          <TextInput 
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          />
          <Text style={[styles.inputHint, { color: colors.textMuted }]}>Must be at least 6 characters.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
          <TextInput 
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          />
        </View>

        <AppButton 
          title="Register Account"
          onPress={handleSignUp}
          loading={loading}
          style={styles.registerButton}
        />

        <AppButton 
          title="Already have an account? Log In"
          variant="secondary"
          onPress={() => navigation.navigate('Login')}
          style={styles.loginLinkButton}
          textStyle={styles.loginLinkText}
        />
      </AppCard>

      <View style={styles.footer}>
        <Text style={[styles.footerNote, { color: colors.textMuted }]}>
          🔒 Safe Medical Notice: We use HIPAA-compliant reference standards. This app is for informational analysis, not clinical diagnosis.
        </Text>
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: scale(20), paddingTop: verticalScale(40), paddingBottom: verticalScale(40) },
  header: { alignItems: 'center', marginBottom: verticalScale(32) },
  logoBadge: { 
    width: scale(80), 
    height: scale(80), 
    borderRadius: scale(24), 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: verticalScale(16), 
    elevation: 4, 
    shadowColor: '#10b981', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 10 
  },
  logoEmoji: { fontSize: fs(40) },
  title: { fontSize: fs(28), fontWeight: '900', color: '#0f172a', letterSpacing: -1 },
  subtitle: { fontSize: fs(14), color: '#64748b', marginTop: verticalScale(4) },
  formCard: { backgroundColor: '#fff', padding: scale(20), borderRadius: 32 },
  inputGroup: { marginBottom: verticalScale(16) },
  label: { fontSize: fs(13), fontWeight: '700', color: '#1e293b', marginBottom: verticalScale(6), marginLeft: scale(4) },
  input: { 
    height: 56, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    fontSize: fs(14), 
    color: '#1e293b', 
    backgroundColor: '#fcfdfe' 
  },
  inputHint: { fontSize: fs(11), color: '#94a3b8', marginTop: verticalScale(4), marginLeft: scale(4) },
  registerButton: { marginTop: verticalScale(8), backgroundColor: '#10b981', shadowColor: '#10b981' },
  loginLinkButton: { marginTop: verticalScale(12), borderWidth: 0, backgroundColor: 'transparent', height: 44 },
  loginLinkText: { color: '#10b981', fontSize: fs(13) },
  footer: { marginTop: verticalScale(24) },
  footerNote: { fontSize: fs(11), color: '#94a3b8', textAlign: 'center', lineHeight: 18, paddingHorizontal: scale(16) }
});