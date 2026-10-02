import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppTheme } from '../src/context/ThemeContext';
import { ROLES, THEME_COLORS } from '../src/constants';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="face-recognition" size={24} color={colors.primary} />
        </View>
        <TouchableOpacity
          style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => toggleTheme()}
        >
          <MaterialCommunityIcons name={isDark ? 'weather-sunny' : 'weather-night'} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.primary }]}>AttendX</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          AI Biometric Attendance & Classroom System
        </Text>
      </View>

      <Card
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        mode="outlined"
        onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.TEACHER } })}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBox, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}>
              <MaterialCommunityIcons name="account-tie" size={32} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge" style={[styles.cardTitle, { color: colors.text }]}>Teacher</Text>
              <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Faculty & Instructor Access</Text>
            </View>
          </View>
          <Text variant="bodyMedium" style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Create classrooms, launch GPS-fenced attendance sessions, and upload study files & assignments.
          </Text>
          <Button
            mode="contained"
            buttonColor={colors.primary}
            style={styles.btn}
            contentStyle={{ paddingVertical: 4 }}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.TEACHER } })}
          >
            Continue as Teacher
          </Button>
        </Card.Content>
      </Card>

      <Card
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        mode="outlined"
        onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.STUDENT } })}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBox, { backgroundColor: isDark ? colors.surfaceAccent : '#E0F2FE' }]}>
              <MaterialCommunityIcons name="account-school" size={32} color={isDark ? THEME_COLORS.secondary : '#0284C7'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge" style={[styles.cardTitle, { color: colors.text }]}>Student</Text>
              <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Course Enrollee Access</Text>
            </View>
          </View>
          <Text variant="bodyMedium" style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Enroll in classrooms using teacher code, access lecture notes, and verify face biometrics for check-in.
          </Text>
          <Button
            mode="contained"
            buttonColor={isDark ? THEME_COLORS.secondary : '#0284C7'}
            style={styles.btn}
            contentStyle={{ paddingVertical: 4 }}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.STUDENT } })}
          >
            Continue as Student
          </Button>
        </Card.Content>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 28,
  },
  brand: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
  },
  cardContent: {
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontWeight: '800',
  },
  cardDesc: {
    marginVertical: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    marginTop: 6,
    borderRadius: 12,
  },
});
