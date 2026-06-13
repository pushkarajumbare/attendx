import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Linking, Alert, View } from 'react-native';
import { Text, Card, Button, Menu, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import { getNotes } from '../../src/services/contentService';
import { EmptyState } from '../../src/components/EmptyState';
import { formatDate } from '../../src/utils/helpers';
import { COLORS } from '../../src/constants';

export default function StudentNotesScreen() {
  const { profile } = useAuth();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [notes, setNotes] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // ===========================
  // MANDATORY SAFE UID GUARD
  // ===========================
  const uid = profile?.uid;

  const loadNotes = async () => {
    if (!uid) return;

    try {
      setLoading(true);

      const classes = await getStudentClassrooms(uid);
      const safeClasses = classes || [];

      setClassrooms(safeClasses);

      if (safeClasses.length === 0) {
        setNotes([]);
        return;
      }

      const cls = selectedClass || safeClasses[0];

      if (!cls) {
        setNotes([]);
        return;
      }

      setSelectedClass(cls);

      const data = await getNotes(cls.classroomId);
      setNotes(data || []);
    } catch (error) {
      console.log('Notes loading error:', error);
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [uid])
  );

  const handleClassSelect = async (cls) => {
    try {
      setSelectedClass(cls);
      setMenuVisible(false);

      const data = await getNotes(cls.classroomId);
      setNotes(data || []);
    } catch (error) {
      console.log('Class notes error:', error);
      Alert.alert('Error', 'Failed to load notes');
    }
  };

  const handleDownload = async (url) => {
    if (!url) {
      Alert.alert('Error', 'Invalid file URL');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert('Error', 'Cannot open this file');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log('Download error:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  // ===========================
  // LOADING STATE (SAFE UX)
  // ===========================
  if (!uid) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* CLASS SELECTOR */}
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
            onPress={() => handleClassSelect(cls)}
          />
        ))}
      </Menu>

      {/* EMPTY STATE */}
      {notes.length === 0 ? (
        <EmptyState
          title="No notes uploaded"
          subtitle="Notes from your teacher will appear here"
        />
      ) : (
        notes.map((note) => (
          <Card key={note.noteId} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{note.title}</Text>

              <Text style={styles.meta}>{note.fileName}</Text>

              {note.createdAt && (
                <Text style={styles.date}>
                  Uploaded: {formatDate(note.createdAt)}
                </Text>
              )}
            </Card.Content>

            <Card.Actions>
              <Button onPress={() => handleDownload(note.fileUrl)}>
                Download
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 16,
  },
  select: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  meta: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  date: {
    color: COLORS.textSecondary,
    marginTop: 6,
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});