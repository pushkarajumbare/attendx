import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { COLORS } from '../constants';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    error: COLORS.danger,
    background: COLORS.background,
    surface: COLORS.surface,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#3b82f6',
    secondary: COLORS.secondary,
    error: COLORS.danger,
  },
};
