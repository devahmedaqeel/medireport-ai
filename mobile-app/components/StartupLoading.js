import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

console.log('STARTUP_LOADING_MODULE_LOADED');

/**
 * StartupLoading — shown immediately on app launch while auth initialises.
 *
 * Key design decisions:
 *  - Uses flex:1, NOT absolute positioning (absolute + Dimensions can give 0×0)
 *  - Uses only core RN components (View/Text/ActivityIndicator) — no native modules
 *  - Shows "Continue as Guest" button after 4 seconds of parent-controlled timer
 *  - After 8 seconds shows a longer warning message
 */
export default function StartupLoading({ showGuestButton = false, onGuestPress, isDarkMode = false }) {
  const insets = useSafeAreaInsets();
  const [longWait, setLongWait] = useState(false);

  useEffect(() => {
    // Extra in-component timer: show a "taking longer" message after 8s
    const t = setTimeout(() => setLongWait(true), 8000);
    return () => clearTimeout(t);
  }, []);

  console.log('STARTUP_LOADING_RENDER');

  const colors = {
    bg: isDarkMode ? '#0f172a' : '#ffffff',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    logoBg: isDarkMode ? '#1e293b' : '#f0f9ff',
    logoBorder: isDarkMode ? '#334155' : '#bae6fd',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* App branding */}
      <View style={[styles.logoBox, { backgroundColor: colors.logoBg, borderColor: colors.logoBorder }]}>
        <Text style={styles.logoEmoji}>🧬</Text>
      </View>

      <Text style={[styles.appName, { color: colors.text }]}>MediReport AI</Text>
      <Text style={[styles.tagline, { color: colors.textMuted }]}>Medical Report Analysis</Text>

      {/* Spinner */}
      <ActivityIndicator
        size="large"
        color="#0ea5e9"
        style={styles.spinner}
      />

      <Text style={[styles.loadingText, { color: colors.textMuted }]}>
        {longWait
          ? 'Taking longer than expected...'
          : 'Starting MediReport AI...'}
      </Text>

      {/* Guest button — appears after 4s or if auth hangs */}
      {showGuestButton && (
        <View style={styles.guestSection}>
          <Text style={[styles.guestHint, { color: colors.textMuted }]}>
            {longWait
              ? 'Backend or network may be slow. You can still use guest mode.'
              : 'You can skip login and use guest mode.'}
          </Text>
          <TouchableOpacity
            style={styles.guestButton}
            onPress={onGuestPress}
            activeOpacity={0.8}
          >
            <Text style={styles.guestButtonText}>Continue as Guest →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Medical disclaimer always visible */}
      <View style={[styles.disclaimer, { bottom: 20 + insets.bottom }]}>
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          ⚠️ For informational use only. Not a substitute for medical diagnosis.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // flex:1 ALWAYS fills parent — never invisible like absolute positioning can be
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#bae6fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 40,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  guestSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  guestHint: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  guestButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 200,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  guestButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  disclaimer: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
});
