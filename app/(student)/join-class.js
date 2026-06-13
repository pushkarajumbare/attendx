import { useState } from 'react';
import { StyleSheet, Alert, View } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { joinClassroom } from '../../src/services/classroomService';
import { COLORS } from '../../src/constants';

export default function JoinClassScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // ===========================
  // SAFE UID GUARD (MANDATORY)
  // ===========================
  const uid = profile?.uid;

  const handleJoin = async () => {
    if (!uid) {
      Alert.alert(
        'Error',
        'User not loaded. Please restart the app.'
      );
      return;
    }

    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      Alert.alert('Error', 'Enter classroom code');
      return;
    }

    try {
      setLoading(true);

      const classroom = await joinClassroom(uid, cleanCode);

      if (!classroom) {
        Alert.alert('Error', 'Invalid classroom code');
        return;
      }

      Alert.alert(
        'Success',
        `Joined ${classroom.className}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.log('Join classroom error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Failed to join classroom'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Join Classroom
          </Text>

          <Text style={styles.subtitle}>
            Enter the code shared by your teacher
          </Text>

          <TextInput
            label="Classroom Code"
            value={code}
            onChangeText={setCode}
            mode="outlined"
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. ML26A1B2"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleJoin}
            loading={loading}
            disabled={loading}
          >
            Join Classroom
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 16,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginVertical: 12,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
});