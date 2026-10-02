import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../config/theme';
import { THEME_COLORS } from '../constants';

const THEME_STORAGE_KEY = '@attendx_theme_mode';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  // Load saved theme preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved !== null) {
          setIsDark(saved === 'dark');
        } else if (systemScheme) {
          setIsDark(systemScheme === 'dark');
        }
      })
      .catch(() => {});
  }, [systemScheme]);

  const toggleTheme = (overrideValue) => {
    setIsDark((prev) => {
      const next = typeof overrideValue === 'boolean' ? overrideValue : !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  };

  const value = useMemo(() => {
    const activeTheme = isDark ? darkTheme : lightTheme;
    const tokens = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

    return {
      isDark,
      theme: activeTheme,
      colors: {
        ...THEME_COLORS,
        ...tokens,
        primary: THEME_COLORS.primary,
        primaryDark: THEME_COLORS.primaryDark,
        primaryLight: THEME_COLORS.primaryLight,
        secondary: THEME_COLORS.secondary,
        success: THEME_COLORS.success,
        danger: THEME_COLORS.danger,
        warning: THEME_COLORS.warning,
        info: THEME_COLORS.info,
      },
      toggleTheme,
    };
  }, [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if accessed outside ThemeProvider
    return {
      isDark: false,
      theme: lightTheme,
      colors: { ...THEME_COLORS, ...THEME_COLORS.light },
      toggleTheme: () => {},
    };
  }
  return context;
}
