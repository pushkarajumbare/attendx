import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
import { THEME_COLORS } from '../constants';

export function StatCard({ 
  title, 
  value, 
  icon, 
  color = THEME_COLORS.primary,
  onPress = null
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <Card 
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? colors.border : `${color}30`,
        }
      ]}
      mode="outlined"
      onPress={onPress}
    >
      <Card.Content style={styles.content}>
        <Icon source={icon} size={30} color={color} />
        <Text variant="headlineSmall" style={[styles.value, { color: isDark ? colors.text : color }]}>
          {value}
        </Text>
        <Text variant="bodySmall" style={[styles.title, { color: colors.textSecondary }]}>
          {title}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  value: {
    fontWeight: '800',
    marginTop: 6,
    fontSize: 22,
  },
  title: {
    marginTop: 3,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
  },
});
