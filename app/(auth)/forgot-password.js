import { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resetPassword } from '../../src/services/authService';
import { COLORS } from '../../src/constants';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      Alert.alert('Success', 'Password reset link sent to your email', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a password reset link.
        </Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Button mode="contained" onPress={handleReset} loading={loading}>
          Send Reset Link
        </Button>
        <Button mode="text" onPress={() => router.back()} style={styles.back}>
          Back to Login
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  title: { fontWeight: '700', textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: 16 },
  input: { marginBottom: 16 },
  back: { marginTop: 12 },
});
