import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

export function EmptyState({ title, subtitle, icon }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      {icon || <MaterialCommunityIcons name="folder-open-outline" size={48} color={colors.primary} style={{ opacity: 0.8 }} />}
      <Text variant="titleMedium" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
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
    padding: 32,
    minHeight: 200,
  },
  title: {
    marginTop: 14,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
  },
  subtitle: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
});
