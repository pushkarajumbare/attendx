import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../config/theme';
import { THEME_COLORS } from '../constants';

const THEME_STORAGE_KEY = '@attendx_theme_mode';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved === 'dark' || saved === 'light') {
          setIsDark(saved === 'dark');
        } else if (systemScheme) {
          setIsDark(systemScheme === 'dark');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [systemScheme]);

  const toggleTheme = useCallback((overrideValue) => {
    setIsDark((prev) => {
      const next = typeof overrideValue === 'boolean' ? overrideValue : !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

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
        primarySoft: isDark ? 'rgba(37, 99, 235, 0.22)' : THEME_COLORS.primaryLight,
        secondary: THEME_COLORS.secondary,
        secondaryDark: THEME_COLORS.secondaryDark,
        secondarySoft: isDark ? 'rgba(249, 115, 22, 0.20)' : THEME_COLORS.secondaryLight,
        success: THEME_COLORS.success,
        successSurface: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
        danger: THEME_COLORS.danger,
        dangerSurface: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
        warning: THEME_COLORS.warning,
        warningSurface: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
        info: THEME_COLORS.info,
        infoSurface: isDark ? 'rgba(2, 132, 199, 0.16)' : '#F0F9FF',
        tabActiveBg: isDark ? 'rgba(37, 99, 235, 0.22)' : '#EFF6FF',
      },
      toggleTheme,
    };
  }, [isDark, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDark: false,
      theme: lightTheme,
      colors: {
        ...THEME_COLORS,
        ...THEME_COLORS.light,
        primarySoft: THEME_COLORS.primaryLight,
        secondarySoft: THEME_COLORS.secondaryLight,
        successSurface: '#ECFDF5',
        dangerSurface: '#FEF2F2',
        warningSurface: '#FFFBEB',
        infoSurface: '#F0F9FF',
        tabActiveBg: '#EFF6FF',
      },
      toggleTheme: () => {},
    };
  }
  return context;
}
