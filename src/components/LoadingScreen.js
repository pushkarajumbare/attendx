import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
import { IconBadge } from './IconBadge';

export function LoadingScreen({ message = 'Loading...', iconName = 'face-recognition' }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <IconBadge
        name={iconName}
        size={34}
        boxSize={68}
        borderRadius={22}
        color={colors.primary}
        pulse
      />
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  spinner: {
    marginTop: 18,
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
});
