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
import { loginUser, loginGuest } from '../services/authService';
import { fs, scale, verticalScale } from '../utils/responsive';
import { useTheme } from '../components/ThemeContext';

export default function LoginScreen({ navigation }) {
  console.log("LOGIN_SCREEN_RENDER");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await loginUser(email, password);
    } catch (err) {
      console.error(err);
      Alert.alert('Login Failed', err.message || 'Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await loginGuest();
      // Navigation will be handled by auth listener in App.js
    } catch (err) {
      Alert.alert('Guest Login Failed', err.message);
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
          <Text style={styles.logoEmoji}>🧬</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>MediReport AI</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Secure Access to Medical Insights</Text>
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
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput 
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          />
        </View>

        <AppButton 
          title="Log In"
          onPress={handleLogin}
          loading={loading}
          style={styles.loginButton}
        />

        <AppButton 
          title="Don't have an account? Sign Up"
          variant="secondary"
          onPress={() => navigation.navigate('SignUp')}
          style={styles.signUpButton}
          textStyle={styles.signUpText}
        />

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <Text style={styles.dividerText}>or</Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <AppButton 
          title="Continue as Guest ➔"
          variant="secondary"
          onPress={handleGuestLogin}
          style={[styles.guestButton, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: colors.cardBorder }]}
          textStyle={{ color: colors.text }}
        />
      </AppCard>

      <View style={styles.footer}>
        <Text style={[styles.footerNote, { color: colors.textMuted }]}>
          🔒 Safe Medical Notice: We use industry-standard reference ranges. This app is for informational analysis, not clinical diagnosis.
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
    shadowColor: '#0ea5e9', 
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
  loginButton: { marginTop: verticalScale(8) },
  signUpButton: { marginTop: verticalScale(12), borderWidth: 0, backgroundColor: 'transparent', height: 44 },
  signUpText: { color: '#0ea5e9', fontSize: fs(13) },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: verticalScale(16) },
  line: { flex: 1, height: 1, backgroundColor: '#f1f5f9' },
  dividerText: { marginHorizontal: scale(12), fontSize: fs(12), color: '#cbd5e1', fontWeight: '600' },
  guestButton: { backgroundColor: '#f8fafc', height: 56 },
  footer: { marginTop: verticalScale(24) },
  footerNote: { fontSize: fs(11), color: '#94a3b8', textAlign: 'center', lineHeight: 18, paddingHorizontal: scale(16) }
});
