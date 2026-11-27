import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Mount-once native-driver entrance container (opacity + vertical settle).
 * Runs strictly on mount so parent state updates / list refreshes never flicker.
 */
export function FadeInView({ children, delay = 0, duration = 260, translateY = 10, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, duration, opacity, offset]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: offset }] }]}>
      {children}
    </Animated.View>
  );
}
