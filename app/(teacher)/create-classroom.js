import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { createClassroom } from '../../src/services/classroomService';
import { THEME_COLORS } from '../../src/constants';

export default function CreateClassroomScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!className.trim()) {
      Alert.alert('Validation Error', 'Please enter a classroom name');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Validation Error', 'Please enter a subject name');
      return;
    }

    try {
      setLoading(true);
      const newClass = await createClassroom(profile.uid, {
        className: className.trim(),
        subject: subject.trim(),
      });

      Alert.alert(
        'Classroom Created! 🎉',
        `Classroom "${newClass.className}" created successfully.\n\nUnique Join Code: ${newClass.classroomCode}\nShare this code with your students so they can enroll.`,
        [
          {
            text: 'View Classrooms',
            onPress: () => router.replace('/(teacher)/classrooms'),
          },
        ]
      );
    } catch (error) {
      console.log('Create classroom error:', error);
      Alert.alert('Creation Failed', error.message || 'Could not create classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="google-classroom" size={36} color={colors.primary} />
          </View>
          <Text variant="titleLarge" style={[styles.title, { color: colors.text }]}>
            Create New Classroom
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Students can join using the unique 6-character code generated for this classroom.
          </Text>

          <TextInput
            label="Classroom Name *"
            placeholder="e.g. Computer Science B.Tech 3rd Year"
            value={className}
            onChangeText={setClassName}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <TextInput
            label="Subject / Course Code *"
            placeholder="e.g. CS301 - Data Structures"
            value={subject}
            onChangeText={setSubject}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <Button
            mode="contained"
            icon="plus"
            onPress={handleCreate}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor={colors.primary}
            contentStyle={styles.buttonContent}
          >
            Create Classroom & Generate Code
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, justifyContent: 'center' },
  card: { borderRadius: 18, borderWidth: 1, paddingVertical: 12 },
  cardContent: { alignItems: 'center' },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 13, marginBottom: 20, lineHeight: 19 },
  input: { width: '100%', marginBottom: 14 },
  button: { width: '100%', marginTop: 8, borderRadius: 12 },
  buttonContent: { paddingVertical: 8 },
});