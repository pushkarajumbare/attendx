import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ROLES, THEME_COLORS } from '../src/constants';

export default function SplashScreen() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { isDark } = useAppTheme();
  const isMounted = useRef(true);

  const logoScale = useRef(new Animated.Value(0.86)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoScale, logoOpacity]);

  useEffect(() => {
    isMounted.current = true;
    if (loading) return;

    const timer = setTimeout(async () => {
      if (!isMounted.current) return;

      if (!user) {
        router.replace('/role-select');
        return;
      }

      let resolvedProfile = profile;
      if (!resolvedProfile) {
        resolvedProfile = await refreshProfile();
        if (!isMounted.current) return;
      }

      if (!resolvedProfile) {
        router.replace('/role-select');
        return;
      }

      if (resolvedProfile.role === ROLES.TEACHER) {
        router.replace('/(teacher)/dashboard');
        return;
      }

      if (resolvedProfile.role === ROLES.STUDENT) {
        if (!resolvedProfile.faceRegistered) {
          router.replace('/(student)/face-register');
        } else {
          router.replace('/(student)/dashboard');
        }
        return;
      }

      router.replace('/role-select');
    }, 550);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, [loading, user, profile, refreshProfile, router]);

  if (loading) return <LoadingScreen message="Starting AttendX..." />;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? THEME_COLORS.dark.background : THEME_COLORS.primary },
      ]}
    >
      <Animated.View
        style={[
          styles.logoBox,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isDark
                ? 'rgba(37, 99, 235, 0.22)'
                : 'rgba(255, 255, 255, 0.22)',
              borderColor: isDark ? THEME_COLORS.primary : 'rgba(255, 255, 255, 0.45)',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="face-recognition"
            size={48}
            color={isDark ? THEME_COLORS.primary : '#FFFFFF'}
          />
        </View>
        <Text
          style={[
            styles.logo,
            { color: isDark ? THEME_COLORS.primary : '#FFFFFF' },
          ]}
        >
          AttendX
        </Text>
        <Text
          style={[
            styles.tagline,
            { color: isDark ? THEME_COLORS.dark.textSecondary : 'rgba(255,255,255,0.92)' },
          ]}
        >
          Smart Classroom Attendance
        </Text>
      </Animated.View>

      <View style={styles.footerBadge}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={16}
          color={isDark ? THEME_COLORS.secondary : 'rgba(255,255,255,0.85)'}
        />
        <Text
          style={[
            styles.subtitle,
            { color: isDark ? THEME_COLORS.dark.textSecondary : 'rgba(255,255,255,0.85)' },
          ]}
        >
          Offline Face + GPS Verified
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  logo: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  footerBadge: {
    position: 'absolute',
    bottom: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
});
