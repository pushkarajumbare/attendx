import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { THEME_COLORS } from '../constants';

export function IconBadge({
  name,
  size = 24,
  boxSize = 44,
  color,
  backgroundColor,
  borderRadius,
  pulse = false,
  style,
}) {
  const { colors, isDark } = useAppTheme();
  const iconColor = color || colors.primary || THEME_COLORS.primary;
  const bg =
    backgroundColor ||
    (isDark ? 'rgba(37, 99, 235, 0.20)' : THEME_COLORS.primaryLight);
  const radius = borderRadius ?? Math.round(boxSize * 0.3);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.07,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, scaleAnim]);

  const Container = pulse ? Animated.View : View;

  const isHex = typeof iconColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(iconColor);
  const borderAccent = isHex
    ? isDark
      ? `${iconColor}38`
      : `${iconColor}25`
    : colors.border;

  return (
    <Container
      style={[
        styles.box,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: radius,
          backgroundColor: bg,
          borderColor: borderAccent,
        },
        pulse && { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <MaterialCommunityIcons name={name} size={size} color={iconColor} />
    </Container>
  );
}

const styles = StyleSheet.create({
  box: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
