import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
import { THEME_COLORS } from '../constants';
import { IconBadge } from './IconBadge';
import { FadeInView } from './FadeInView';

export function ErrorScreen({
  title = 'Something went wrong',
  message = '',
  onRetry = null,
  icon = null,
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <FadeInView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.iconContainer}>
        {icon || (
          <IconBadge
            name="alert-circle-outline"
            size={36}
            boxSize={70}
            borderRadius={22}
            color={THEME_COLORS.danger}
            backgroundColor={isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEF2F2'}
          />
        )}
      </View>
      <Text variant="titleLarge" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      ) : null}
      {onRetry && (
        <Button
          mode="contained"
          icon="refresh"
          onPress={onRetry}
          style={styles.button}
          buttonColor={colors.primary}
          textColor="#FFFFFF"
        >
          Try Again
        </Button>
      )}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 18,
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
  },
  button: {
    marginTop: 20,
    borderRadius: 12,
  },
});
