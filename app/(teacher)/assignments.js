import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, TextInput, Menu } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getAssignments, uploadAssignment } from '../../src/services/contentService';
import { COLORS } from '../../src/constants';

export default function TeacherAssignmentsScreen() {
  const { profile } = useAuth();

  const uid = profile?.uid; // ✅ SAFE FIX

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [assignments, setAssignments] = useState([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [linkUrl, setLinkUrl] = useState('');

  const [menuVisible, setMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!uid) return; // 🔥 CRASH FIX

        try {
          const classes = await getTeacherClassrooms(uid);

          setClassrooms(classes || []);

          if (classes?.length > 0) {
            setSelectedClass(classes[0]);

            const data = await getAssignments(classes[0].classroomId);
            setAssignments(data || []);
          }
        } catch (error) {
          console.log('Load error:', error);
        }
      };

      load();
    }, [uid])
  );

  const handleUpload = async () => {
    if (!uid) return; // 🔥 CRASH FIX

    if (!title || !deadline || !selectedClass) {
      Alert.alert('Error', 'Fill required fields');
      return;
    }

    try {
      await uploadAssignment(selectedClass.classroomId, uid, {
        title,
        description,
        deadline: new Date(deadline),
        maxMarks: parseInt(maxMarks, 10),
        linkUrl: linkUrl || null,
      });

      const updated = await getAssignments(selectedClass.classroomId);
      setAssignments(updated || []);

      setTitle('');
      setDescription('');
      setDeadline('');
      setMaxMarks('100');
      setLinkUrl('');

      Alert.alert('Success', 'Assignment created');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.select}>
            {selectedClass ? selectedClass.className : 'Select Classroom'}
          </Button>
        }
      >
        {classrooms.map((cls) => (
          <Menu.Item
            key={cls.classroomId}
            title={cls.className}
            onPress={async () => {
              setSelectedClass(cls);
              setMenuVisible(false);

              const data = await getAssignments(cls.classroomId);
              setAssignments(data || []);
            }}
          />
        ))}
      </Menu>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Create Assignment</Text>

          <TextInput label="Title" value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput label="Description" value={description} onChangeText={setDescription} style={styles.input} />
          <TextInput label="Link URL (optional)" value={linkUrl} onChangeText={setLinkUrl} style={styles.input} />
          <TextInput label="Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} style={styles.input} />
          <TextInput label="Max Marks" value={maxMarks} onChangeText={setMaxMarks} style={styles.input} />

          <Button mode="contained" icon="link" onPress={handleUpload}>
            Create Assignment
          </Button>
        </Card.Content>
      </Card>

      {assignments.map((item) => (
        <Card key={item.assignmentId} style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">{item.title}</Text>
            <Text style={styles.meta}>{item.description}</Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  select: { marginBottom: 16 },
  card: { marginBottom: 12, borderRadius: 12 },
  input: { marginBottom: 12 },
  meta: { color: COLORS.textSecondary },
});