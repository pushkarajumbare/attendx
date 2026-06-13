import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, TextInput, Menu } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  getNotes,
  uploadNote,
} from '../../src/services/contentService';

import { COLORS } from '../../src/constants';

export default function TeacherNotesScreen() {
  const { profile } = useAuth();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // ✅ SAFE LOAD (fix uid crash)
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!profile?.uid) return;

        try {
          const classes = await getTeacherClassrooms(profile.uid);
          setClassrooms(classes || []);

          if (classes?.length > 0) {
            const first = classes[0];
            setSelectedClass(first);

            const data = await getNotes(first.classroomId);
            setNotes(data || []);
          }
        } catch (error) {
          console.log(error);
          Alert.alert('Error', 'Failed to load data');
        }
      };

      load();
    }, [profile?.uid])
  );

  const handleUpload = async () => {
    if (!profile?.uid) {
      Alert.alert('Error', 'User not loaded');
      return;
    }

    if (!selectedClass) {
      Alert.alert('Error', 'Select a classroom first');
      return;
    }

    if (!link) {
      Alert.alert('Error', 'Please paste a link to the note');
      return;
    }

    try {
      await uploadNote(selectedClass.classroomId, profile.uid, link, title);

      const updated = await getNotes(selectedClass.classroomId);
      setNotes(updated || []);

      setTitle('');
      setLink('');
      Alert.alert('Success', 'Note added');
    } catch (error) {
      Alert.alert('Error', error.message || 'Upload failed');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* CLASS SELECT */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setMenuVisible(true)}
            style={styles.select}
          >
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

              const data = await getNotes(cls.classroomId);
              setNotes(data || []);
            }}
          />
        ))}
      </Menu>

      {/* UPLOAD CARD */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Upload Note</Text>

          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Link URL"
            value={link}
            onChangeText={setLink}
            mode="outlined"
            style={styles.input}
          />
          <Button mode="contained" icon="link" onPress={handleUpload}>
            Add Note Link
          </Button>
        </Card.Content>
      </Card>

      {/* NOTES LIST */}
      {notes.map((note) => (
        <Card key={note.noteId} style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">{note.title}</Text>
            <Text style={styles.meta}>{note.fileName}</Text>
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
  input: { marginVertical: 12 },
  meta: { color: COLORS.textSecondary },
});