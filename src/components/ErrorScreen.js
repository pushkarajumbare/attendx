import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { THEME_COLORS } from '../constants';

export function ErrorScreen({ 
  title = 'Something went wrong', 
  message = '',
  onRetry = null,
  icon = null
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.iconContainer}>
        {icon || <MaterialCommunityIcons name="alert-circle-outline" size={56} color={THEME_COLORS.danger} />}
      </View>
      <Text variant="titleLarge" style={[styles.title, { color: THEME_COLORS.danger }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      ) : null}
      {onRetry && (
        <Button 
          mode="contained" 
          onPress={onRetry} 
          style={styles.button}
          buttonColor={colors.primary}
        >
          Try Again
        </Button>
      )}
    </View>
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
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
  },
  button: {
    marginTop: 20,
    borderRadius: 12,
  },
});
