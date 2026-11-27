import React, { useRef } from 'react';
import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
import { THEME_COLORS } from '../constants';
import { IconBadge } from './IconBadge';

export function StatCard({
  title,
  value,
  icon,
  color = THEME_COLORS.primary,
  onPress = null,
}) {
  const { colors, isDark } = useAppTheme();
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(pressScale, {
      toValue: 0.97,
      speed: 28,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 22,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const innerCard = (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? colors.border : `${color}30`,
        },
      ]}
      mode="outlined"
    >
      <View style={[styles.topAccentBar, { backgroundColor: color }]} />
      <Card.Content style={styles.content}>
        <IconBadge
          name={icon}
          size={22}
          boxSize={42}
          color={color}
          backgroundColor={isDark ? `${color}22` : `${color}16`}
        />
        <Text
          variant="headlineSmall"
          style={[styles.value, { color: isDark ? colors.text : color }]}
        >
          {value}
        </Text>
        <Text variant="bodySmall" style={[styles.title, { color: colors.textSecondary }]}>
          {title}
        </Text>
      </Card.Content>
    </Card>
  );

  if (onPress) {
    return (
      <Animated.View style={[styles.flexWrapper, { transform: [{ scale: pressScale }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.flexWrapper}
        >
          {innerCard}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={styles.flexWrapper}>{innerCard}</View>;
}

const styles = StyleSheet.create({
  flexWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topAccentBar: {
    height: 3,
    width: '100%',
    opacity: 0.85,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  value: {
    fontWeight: '800',
    marginTop: 8,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  title: {
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
  },
});
