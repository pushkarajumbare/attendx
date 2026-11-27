import { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';
import { FadeInView } from '../src/components/FadeInView';
import { IconBadge } from '../src/components/IconBadge';
import { ROLES, THEME_COLORS } from '../src/constants';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role === ROLES.TEACHER) {
      router.replace('/(teacher)/dashboard');
    } else if (profile.role === ROLES.STUDENT) {
      router.replace(profile.faceRegistered ? '/(student)/dashboard' : '/(student)/face-register');
    }
  }, [loading, user, profile, router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <IconBadge name="face-recognition" size={22} boxSize={42} borderRadius={14} pulse />
            <Text style={[styles.brandMini, { color: colors.text }]}>AttendX</Text>
          </View>
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => toggleTheme()}
            accessibilityLabel="Toggle theme"
          >
            <MaterialCommunityIcons
              name={isDark ? 'weather-sunny' : 'weather-night'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        <FadeInView delay={30} style={styles.header}>
          <Text style={[styles.brand, { color: colors.primary }]}>Welcome to AttendX</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Fast offline biometric attendance, GPS verification & classroom management
          </Text>
        </FadeInView>

        <FadeInView delay={90}>
          <Card
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.TEACHER } })}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <IconBadge
                  name="account-tie"
                  size={28}
                  boxSize={54}
                  borderRadius={16}
                  color={colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="titleLarge" style={[styles.cardTitle, { color: colors.text }]}>
                    Teacher Portal
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.primary, fontWeight: '600' }}>
                    Faculty & Instructor Access
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </View>
              <Text variant="bodyMedium" style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Create classrooms, run GPS-fenced attendance sessions, upload notes, and track task submissions.
              </Text>
              <Button
                mode="contained"
                icon="arrow-right-circle-outline"
                buttonColor={colors.primary}
                textColor="#FFFFFF"
                style={styles.btn}
                contentStyle={styles.btnContent}
                onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.TEACHER } })}
              >
                Continue as Teacher
              </Button>
            </Card.Content>
          </Card>
        </FadeInView>

        <FadeInView delay={150}>
          <Card
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.STUDENT } })}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <IconBadge
                  name="school"
                  size={28}
                  boxSize={54}
                  borderRadius={16}
                  color={THEME_COLORS.secondary}
                  backgroundColor={isDark ? 'rgba(249, 115, 22, 0.18)' : THEME_COLORS.secondaryLight}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="titleLarge" style={[styles.cardTitle, { color: colors.text }]}>
                    Student Portal
                  </Text>
                  <Text variant="bodySmall" style={{ color: THEME_COLORS.secondary, fontWeight: '700' }}>
                    Classroom & Check-In Access
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </View>
              <Text variant="bodyMedium" style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Join classrooms via invite code, verify face biometrics in seconds, access notes, and submit tasks.
              </Text>
              <Button
                mode="contained"
                icon="face-recognition"
                buttonColor={THEME_COLORS.secondary}
                textColor="#FFFFFF"
                style={styles.btn}
                contentStyle={styles.btnContent}
                onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.STUDENT } })}
              >
                Continue as Student
              </Button>
            </Card.Content>
          </Card>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMini: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  themeToggle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { marginBottom: 24 },
  brand: { fontSize: 32, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardContent: { padding: 18 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: '800', fontSize: 19 },
  cardDesc: { fontSize: 13.5, lineHeight: 20, marginBottom: 16 },
  btn: { borderRadius: 12 },
  btnContent: { paddingVertical: 5, flexDirection: 'row-reverse' },
});
