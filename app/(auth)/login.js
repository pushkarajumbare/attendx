import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { signIn } from '../../src/services/authService';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { FadeInView } from '../../src/components/FadeInView';
import { IconBadge } from '../../src/components/IconBadge';
import { ROLES, THEME_COLORS } from '../../src/constants';

export default function LoginScreen() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { role } = useLocalSearchParams();
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    if (authLoading || !user || !profile) return;
    if (profile.role === ROLES.TEACHER) {
      router.replace('/(teacher)/dashboard');
    } else if (profile.role === ROLES.STUDENT) {
      router.replace(profile.faceRegistered ? '/(student)/dashboard' : '/(student)/face-register');
    }
  }, [authLoading, user, profile, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation Error', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const profile = await signIn(email.trim(), password);
      await refreshProfile();

      if (role && profile.role !== role) {
        Alert.alert('Role Mismatch', `This account is registered as a ${profile.role}, not a ${role}.`);
        return;
      }

      if (profile.role === ROLES.TEACHER) {
        router.replace('/(teacher)/dashboard');
      } else {
        router.replace(profile.faceRegistered ? '/(student)/dashboard' : '/(student)/face-register');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const isTeacherRole = role === ROLES.TEACHER;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeInView style={styles.header}>
          <IconBadge
            name={isTeacherRole ? 'account-tie' : 'school'}
            size={34}
            boxSize={68}
            borderRadius={22}
            color={colors.primary}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.brand, { color: colors.primary }]}>AttendX</Text>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>
            {isTeacherRole ? 'Teacher Portal' : 'Student Portal'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to access your biometric sessions & classrooms
          </Text>
        </FadeInView>

        <FadeInView delay={70}>
          <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Email Address *"
              placeholder="user@university.edu"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              left={<TextInput.Icon icon="email-outline" color={colors.textSecondary} />}
            />

            <TextInput
              label="Password *"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              left={<TextInput.Icon icon="lock-outline" color={colors.textSecondary} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                  color={colors.textSecondary}
                />
              }
            />

            <Button
              mode="contained"
              icon="login-variant"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.btn}
              buttonColor={colors.primary}
              textColor="#FFFFFF"
              contentStyle={styles.btnContent}
            >
              Sign In
            </Button>

            <View style={styles.linksRow}>
              <Link href={{ pathname: '/(auth)/forgot-password' }} asChild>
                <Button mode="text" textColor={colors.textSecondary} compact>
                  Forgot Password?
                </Button>
              </Link>

              <Link href={{ pathname: '/(auth)/signup', params: { role } }} asChild>
                <Button mode="text" textColor={colors.primary} compact>
                  Create Account
                </Button>
              </Link>
            </View>
          </Card.Content>
        </Card>
        </FadeInView>

        <Button
          mode="text"
          icon="arrow-left"
          textColor={colors.textSecondary}
          onPress={() => router.replace('/role-select')}
          style={{ marginTop: 12 }}
        >
          Change Role
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  brandBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brand: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  title: { fontWeight: '800', marginTop: 4, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 13, marginTop: 4, paddingHorizontal: 16 },
  card: { borderRadius: 18, borderWidth: 1 },
  cardContent: { paddingVertical: 18 },
  input: { marginBottom: 14 },
  btn: { marginTop: 6, borderRadius: 12 },
  btnContent: { paddingVertical: 8 },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});
