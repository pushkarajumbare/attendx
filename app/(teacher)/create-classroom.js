import { useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { createClassroom } from '../../src/services/classroomService';
import { COLORS } from '../../src/constants';

export default function CreateClassroomScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    // ✅ FIX: prevent null uid crash
    if (!profile?.uid) {
      Alert.alert('Error', 'User not loaded. Please try again.');
      return;
    }

    if (!className.trim() || !subject.trim()) {
      Alert.alert('Error', 'Fill all fields');
      return;
    }

    setLoading(true);

    try {
      const classroom = await createClassroom(profile.uid, {
        className: className.trim(),
        subject: subject.trim(),
      });

      Alert.alert(
        'Success',
        `Classroom created!\n\nShare code: ${classroom.classroomCode}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="headlineSmall" style={styles.title}>
          Create Classroom
        </Text>

        <TextInput
          label="Class Name"
          value={className}
          onChangeText={setClassName}
          mode="outlined"
          placeholder="FYBCA-A"
          style={styles.input}
        />

        <TextInput
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          mode="outlined"
          placeholder="Machine Learning"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
        >
          Generate Classroom Code
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, borderRadius: 16 },
  title: { fontWeight: '700', marginBottom: 16 },
  input: { marginBottom: 12 },
});