import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { THEME_COLORS } from '../constants';

export const lightTheme = {
  ...MD3LightTheme,
  dark: false,
  colors: {
    ...MD3LightTheme.colors,
    primary: THEME_COLORS.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: THEME_COLORS.primaryLight,
    onPrimaryContainer: THEME_COLORS.primaryDark,
    secondary: THEME_COLORS.secondary,
    secondaryContainer: THEME_COLORS.primaryMuted,
    background: THEME_COLORS.light.background,
    surface: THEME_COLORS.light.surface,
    surfaceVariant: THEME_COLORS.light.surfaceVariant,
    error: THEME_COLORS.danger,
    outline: THEME_COLORS.light.border,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: THEME_COLORS.light.surface,
      level2: THEME_COLORS.light.surfaceVariant,
    },
  },
  custom: THEME_COLORS.light,
};

export const darkTheme = {
  ...MD3DarkTheme,
  dark: true,
  colors: {
    ...MD3DarkTheme.colors,
    primary: THEME_COLORS.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: THEME_COLORS.dark.surfaceAccent,
    onPrimaryContainer: THEME_COLORS.primaryLight,
    secondary: THEME_COLORS.secondary,
    secondaryContainer: THEME_COLORS.primaryMuted,
    background: THEME_COLORS.dark.background,
    surface: THEME_COLORS.dark.surface,
    surfaceVariant: THEME_COLORS.dark.surfaceVariant,
    error: THEME_COLORS.danger,
    outline: THEME_COLORS.dark.border,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: THEME_COLORS.dark.surface,
      level2: THEME_COLORS.dark.surfaceVariant,
    },
  },
  custom: THEME_COLORS.dark,
};
