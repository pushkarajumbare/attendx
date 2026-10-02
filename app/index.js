import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { COLORS, ROLES } from '../src/constants';

export default function SplashScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (loading) return;

    const timer = setTimeout(() => {
      // Guard against routing if component has unmounted
      if (!isMounted.current) return;

      // No user = not logged in, go to role selection
      if (!user) {
        router.replace('/role-select');
        return;
      }

      // Has user but no profile = issue, go to role selection
      if (!profile) {
        router.replace('/role-select');
        return;
      }

      // Teacher role navigation
      if (profile.role === ROLES.TEACHER) {
        router.replace('/(teacher)/dashboard');
        return;
      }

      // Student role navigation
      if (profile.role === ROLES.STUDENT) {
        if (!profile.faceRegistered) {
          router.replace('/(student)/face-register');
        } else {
          router.replace('/(student)/dashboard');
        }
        return;
      }

      // Fallback for Unknown role
      router.replace('/role-select');
    }, 2000);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, [loading, user, profile, router]);

  if (loading) return <LoadingScreen message="Starting AttendX..." />;

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logo}>AttendX</Text>
        <Text style={styles.tagline}>Smart Classroom Attendance</Text>
      </View>
      <Text style={styles.subtitle}>Face + GPS Verified Attendance</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS?.primary || '#1a56db', // Added fallback to prevent style crashes
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  subtitle: {
    position: 'absolute',
    bottom: 60,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
});