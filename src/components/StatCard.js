import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, Icon } from 'react-native-paper';
import { COLORS } from '../constants';

export function StatCard({ 
  title, 
  value, 
  icon, 
  color = COLORS.primary,
  onPress = null
}) {
  return (
    <Card 
      style={[styles.card, { borderColor: color + '20' }]}
      onPress={onPress}
    >
      <Card.Content style={styles.content}>
        <Icon source={icon} size={32} color={color} />
        <Text variant="headlineSmall" style={[styles.value, { color }]}>
          {value}
        </Text>
        <Text variant="bodySmall" style={styles.title}>
          {title}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  value: {
    fontWeight: '700',
    marginTop: 8,
  },
  title: {
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});

