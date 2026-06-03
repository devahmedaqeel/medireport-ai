import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const loadTheme = async () => {
    try {
      const theme = await AsyncStorage.getItem('app_theme');
      setIsDarkMode(theme === 'dark');
    } catch (e) {
      console.warn("[Theme] Load error:", e.message);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode ? 'dark' : 'light';
      await AsyncStorage.setItem('app_theme', newTheme);
      setIsDarkMode(!isDarkMode);
    } catch (e) {
      console.warn("[Theme] Toggle error:", e.message);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
