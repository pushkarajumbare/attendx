import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
import { IconBadge } from './IconBadge';
import { FadeInView } from './FadeInView';

export function EmptyState({ title, subtitle, icon, iconName = 'folder-open-outline' }) {
  const { colors } = useAppTheme();

  return (
    <FadeInView style={styles.container}>
      {icon || (
        <IconBadge
          name={iconName}
          size={34}
          boxSize={68}
          borderRadius={22}
          color={colors.primary}
        />
      )}
      <Text variant="titleMedium" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </FadeInView>
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
    marginTop: 16,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
  },
  subtitle: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
});
