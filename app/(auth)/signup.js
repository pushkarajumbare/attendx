import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { signUp } from '../../src/services/authService';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { ROLES } from '../../src/constants';

export default function SignUpScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { role: paramRole } = useLocalSearchParams();
  const { colors, isDark } = useAppTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role] = useState(paramRole || ROLES.STUDENT);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Validation Error', 'Please complete all required fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp({ email: email.trim(), password, name: name.trim(), role });
      await refreshProfile();

      if (role === ROLES.TEACHER) {
        router.replace('/(teacher)/dashboard');
      } else {
        router.replace('/(student)/face-register');
      }
    } catch (error) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Failed', error.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const isTeacher = role === ROLES.TEACHER;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.brand, { color: colors.primary }]}>AttendX</Text>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>
            Create {isTeacher ? 'Teacher' : 'Student'} Account
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isTeacher ? 'Start managing classes and attendance' : 'Join classes & enroll your biometric face'}
          </Text>
        </View>

        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Full Name *"
              placeholder="e.g. Sarah Connor"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              left={<TextInput.Icon icon="account-outline" color={colors.textSecondary} />}
            />

            <TextInput
              label="Email Address *"
              placeholder="e.g. sarah@university.edu"
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
              placeholder="Minimum 6 characters"
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

            <TextInput
              label="Confirm Password *"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              left={<TextInput.Icon icon="lock-check-outline" color={colors.textSecondary} />}
            />

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              style={styles.btn}
              buttonColor={colors.primary}
              contentStyle={styles.btnContent}
            >
              Create Account
            </Button>

            <Link href={{ pathname: '/(auth)/login', params: { role } }} asChild>
              <Button mode="text" textColor={colors.primary} style={{ marginTop: 8 }}>
                Already have an account? Sign In
              </Button>
            </Link>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  brand: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  title: { fontWeight: '800', marginTop: 4, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 13, marginTop: 4, paddingHorizontal: 12 },
  card: { borderRadius: 18, borderWidth: 1 },
  cardContent: { paddingVertical: 18 },
  input: { marginBottom: 12 },
  btn: { marginTop: 6, borderRadius: 12 },
  btnContent: { paddingVertical: 8 },
});
