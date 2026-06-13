import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, IconButton } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import {
  getTeacherClassrooms,
  deleteClassroom,
} from '../../src/services/classroomService';

import { EmptyState } from '../../src/components/EmptyState';
import { COLORS } from '../../src/constants';

export default function TeacherClassroomsScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [classrooms, setClassrooms] = useState([]);

  const loadClassrooms = async (uid) => {
    if (!uid) return;

    try {
      const data = await getTeacherClassrooms(uid);
      setClassrooms(data || []);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Failed to load classrooms');
    }
  };

  // ✅ SAFE useFocusEffect (fixes uid crash)
  useFocusEffect(
    useCallback(() => {
      if (!profile?.uid) return;

      loadClassrooms(profile.uid);
    }, [profile?.uid])
  );

  const handleDelete = (classroom) => {
    if (!profile?.uid) return;

    Alert.alert('Delete Classroom', `Delete ${classroom.className}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClassroom(classroom.classroomId, profile.uid);
            loadClassrooms(profile.uid);
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      <Button
        mode="contained"
        icon="plus"
        onPress={() => router.push('/(teacher)/create-classroom')}
        style={styles.create}
      >
        Create New Classroom
      </Button>

      {classrooms.length === 0 ? (
        <EmptyState
          title="No classrooms"
          subtitle="Create your first classroom to get started"
        />
      ) : (
        classrooms.map((cls) => (
          <Card key={cls.classroomId} style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="titleMedium">{cls.className}</Text>
                  <Text style={styles.subject}>{cls.subject}</Text>
                  <Text style={styles.code}>
                    Code: {cls.classroomCode}
                  </Text>
                </View>

                <IconButton
                  icon="delete"
                  iconColor={COLORS.danger}
                  onPress={() => handleDelete(cls)}
                />
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  create: { marginBottom: 16 },
  card: { marginBottom: 12, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  subject: { color: COLORS.textSecondary },
  code: { marginTop: 8, fontWeight: '600', color: COLORS.primary },
});