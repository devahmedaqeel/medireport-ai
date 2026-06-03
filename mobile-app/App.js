import 'react-native-url-polyfill/auto';

// Strip development logs in production release
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}

console.log("URL_POLYFILL_LOADED");
// ─── PHASE 1: Module-level startup log ───────────────────────────────────────
// If you see APP_START in Metro terminal → bundle loaded, JS is running.
// If you never see it → a module import is crashing before this point.
console.log('APP_START');

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import AppErrorBoundary from './components/AppErrorBoundary';
import StartupLoading   from './components/StartupLoading';
import HomeScreen       from './screens/HomeScreen';
import ScanScreen       from './screens/ScanScreen';
import OCRPreviewScreen from './screens/OCRPreviewScreen';
import ResultScreen     from './screens/ResultScreen';
import HistoryScreen    from './screens/HistoryScreen';
import TrendScreen      from './screens/TrendScreen';
import DisclaimerScreen from './screens/DisclaimerScreen';
import LoginScreen      from './screens/LoginScreen';
import SignUpScreen      from './screens/SignUpScreen';
import { onAuthStateChange, loginGuest } from './services/authService';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import AppLogo from './components/AppLogo';

// All imports loaded successfully if we reach here
console.log('APP_IMPORTS_LOADED');

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();


console.log('NAVIGATORS_CREATED');

// ─── Bottom Tabs ──────────────────────────────────────────────────────────────
function MainTabs() {
  console.log('MAIN_TABS_RENDER');
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { 
          backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
          borderBottomWidth: 1, 
          borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' 
        },
        headerTitleStyle: { 
          fontWeight: '900', 
          color: isDarkMode ? '#f8fafc' : '#0f172a', 
          fontSize: 20 
        },
        headerTitleAlign: 'left',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'alert-circle';
          if (route.name === 'Home')    iconName = focused ? 'home'        : 'home-outline';
          else if (route.name === 'Scan')    iconName = focused ? 'camera'      : 'camera-outline';
          else if (route.name === 'History') iconName = focused ? 'time'        : 'time-outline';
          else if (route.name === 'Trends')  iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: isDarkMode ? '#64748b' : '#94a3b8',
        tabBarStyle: {
          height: 62 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 6,
          backgroundColor: isDarkMode ? '#1e293b' : '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: isDarkMode ? 0.3 : 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'Dashboard',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppLogo size={26} color="#0ea5e9" isDarkMode={isDarkMode} />
              <Text style={{ 
                fontWeight: '900', 
                color: isDarkMode ? '#f8fafc' : '#0f172a', 
                fontSize: 18 
              }}>
                MediReport AI
              </Text>
            </View>
          )
        }} 
      />
      <Tab.Screen name="Trends"  component={TrendScreen}   options={{ title: 'Health Trends' }} />
      <Tab.Screen name="Scan"    component={ScanScreen}    options={{ title: 'Scan Report' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'My History' }} />
    </Tab.Navigator>
  );
}

// ─── AppContent ─────────────────────────────────────────────────────────────────
function AppContent() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [showGuestButton, setShowGuestButton] = useState(false);
  const { isDarkMode } = useTheme();

  // Allow tapping "Continue as Guest" even during startup loading
  const handleGuestLogin = useCallback(async () => {
    console.log('GUEST_LOGIN_PRESSED');
    try {
      const guest = await loginGuest();
      setUser(guest);
    } catch (e) {
      console.warn('[App] Guest login error:', e.message);
    }
    setInitializing(false);
  }, []);

  useEffect(() => {
    console.log('AUTH_PROVIDER_START');
    let settled = false;

    // Show "Continue as Guest" button after 4 seconds if still loading
    const guestButtonTimer = setTimeout(() => {
      setShowGuestButton(true);
    }, 4000);

    // Hard timeout: force past the loading screen after 8 seconds
    const hardTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[App] Auth timed out after 8s — forcing login screen');
        setInitializing(false);
      }
    }, 8000);

    // Start auth init
    const unsubscribe = onAuthStateChange((currentUser) => {
      console.log('AUTH_PROVIDER_DONE', currentUser ? 'USER_FOUND' : 'NO_USER');
      if (!settled) {
        settled = true;
        clearTimeout(hardTimeout);
        clearTimeout(guestButtonTimer);
      }
      setUser(currentUser);
      setInitializing(false);
    });

    return () => {
      clearTimeout(hardTimeout);
      clearTimeout(guestButtonTimer);
      unsubscribe();
    };
  }, []);

  // ── RENDER 2: Full app structure ───────────────────────────────────────────
  console.log('APP_CONTAINER_RENDER');
  return (
    <SafeAreaProvider>
      {initializing ? (
        <View style={[styles.loadingRoot, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}>
          <StartupLoading
            showGuestButton={showGuestButton}
            onGuestPress={handleGuestLogin}
            isDarkMode={isDarkMode}
          />
        </View>
      ) : (
        <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: isDarkMode ? '#1e293b' : '#1e293b' }, // Fallback standard or dynamic
              headerStyle: { backgroundColor: isDarkMode ? '#1e293b' : '#fff' },
              headerTitleStyle: { fontWeight: '800', color: isDarkMode ? '#f8fafc' : '#0f172a' },
              headerTintColor: '#0ea5e9',
            }}
          >
            {user ? (
              // Authenticated routes
              <>
                <Stack.Screen name="Main"       component={MainTabs}        options={{ headerShown: false }} />
                <Stack.Screen name="OCRPreview" component={OCRPreviewScreen} options={{ title: 'Verify OCR' }} />
                <Stack.Screen name="Result"     component={ResultScreen}     options={{ title: 'Analysis' }} />
                <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: 'Safety' }} />
              </>
            ) : (
              // Unauthenticated routes
              <>
                <Stack.Screen name="Login"  component={LoginScreen}  options={{ headerShown: false }} />
                <Stack.Screen name="SignUp" component={SignUpScreen}  options={{ title: 'Create Account' }} />
                <Stack.Screen name="Main"   component={MainTabs}     options={{ headerShown: false }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  console.log('APP_RENDER');  // Proves component function is executing
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  // This root view uses flex:1 — guaranteed to fill the screen.
  // DO NOT use absolute positioning with Dimensions here — Dimensions
  // can return 0 before the native layout pass, causing invisible UI.
  loadingRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
