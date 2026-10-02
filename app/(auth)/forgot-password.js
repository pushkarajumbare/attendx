import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { resetPassword } from '../../src/services/authService';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your registered email address');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      Alert.alert(
        'Password Reset Email Sent ✉️',
        'Check your inbox for password reset instructions.',
        [{ text: 'Back to Login', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Reset Failed', error.message || 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
            <MaterialCommunityIcons name="lock-reset" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.brand, { color: colors.primary }]}>AttendX</Text>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>
            Reset Password
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your email and we will send you a link to reset your account password.
          </Text>
        </View>

        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Email Address *"
              placeholder="e.g. user@university.edu"
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

            <Button
              mode="contained"
              onPress={handleReset}
              loading={loading}
              disabled={loading}
              style={styles.btn}
              buttonColor={colors.primary}
              contentStyle={styles.btnContent}
            >
              Send Reset Link
            </Button>

            <Button
              mode="text"
              textColor={colors.textSecondary}
              onPress={() => router.back()}
              style={{ marginTop: 8 }}
            >
              Back to Sign In
            </Button>
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
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brand: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  title: { fontWeight: '800', marginTop: 4, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 13, marginTop: 4, paddingHorizontal: 16 },
  card: { borderRadius: 18, borderWidth: 1 },
  cardContent: { paddingVertical: 18 },
  input: { marginBottom: 14 },
  btn: { marginTop: 6, borderRadius: 12 },
  btnContent: { paddingVertical: 8 },
});
