import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUp } from '../../src/services/authService';
import { COLORS, ROLES } from '../../src/constants';

export default function SignUpScreen() {
  const router = useRouter();
  const { role: paramRole } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role] = useState(paramRole || ROLES.STUDENT);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp({ email: email.trim(), password, name: name.trim(), role });
      if (role === ROLES.TEACHER) {
        router.replace('/(teacher)/dashboard');
      } else {
        router.replace('/(student)/face-register');
      }
    } catch (error) {
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={styles.title}>
          Create {role === ROLES.TEACHER ? 'Teacher' : 'Student'} Account
        </Text>

        <TextInput label="Full Name" value={name} onChangeText={setName} mode="outlined" style={styles.input} />
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
        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />

        <Button mode="contained" onPress={handleSignUp} loading={loading} style={styles.btn}>
          Sign Up
        </Button>

        <Link href={{ pathname: '/(auth)/login', params: { role } }} asChild>
          <Button mode="text">Already have an account? Sign In</Button>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24 },
  title: { fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  input: { marginBottom: 12 },
  btn: { marginTop: 8, marginBottom: 16 },
});
