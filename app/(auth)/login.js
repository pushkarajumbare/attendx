import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signIn } from '../../src/services/authService';
import { COLORS, ROLES } from '../../src/constants';

export default function LoginScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const profile = await signIn(email.trim(), password);
      if (role && profile.role !== role) {
        Alert.alert('Error', `This account is not registered as a ${role}`);
        return;
      }

      if (profile.role === ROLES.TEACHER) {
        router.replace('/(teacher)/dashboard');
      } else {
        router.replace(profile.faceRegistered ? '/(student)/dashboard' : '/(student)/face-register');
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>AttendX</Text>
        <Text variant="headlineSmall" style={styles.title}>
          {role === ROLES.TEACHER ? 'Teacher Login' : 'Student Login'}
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
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />

        <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.btn}>
          Sign In
        </Button>

        <Link href={{ pathname: '/(auth)/forgot-password' }} asChild>
          <Button mode="text">Forgot Password?</Button>
        </Link>

        <Link href={{ pathname: '/(auth)/signup', params: { role } }} asChild>
          <Button mode="text">Don't have an account? Sign Up</Button>
        </Link>

        <Button mode="text" onPress={() => router.back()}>
          Back to Role Selection
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  brand: { fontSize: 32, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  title: { textAlign: 'center', marginVertical: 24, fontWeight: '600' },
  input: { marginBottom: 12 },
  btn: { marginTop: 8, paddingVertical: 4 },
});
