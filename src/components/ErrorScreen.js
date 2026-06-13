import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../constants';

export function ErrorScreen({ 
  title = 'Something went wrong', 
  message = '',
  onRetry = null,
  icon = null
}) {
  return (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconContainer}>
          {icon}
        </View>
      )}
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
      {onRetry && (
        <Button 
          mode="contained" 
          onPress={onRetry} 
          style={styles.button}
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
    backgroundColor: COLORS.background,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    color: COLORS.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    marginTop: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
  },
});
