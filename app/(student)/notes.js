import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View, RefreshControl } from 'react-native';
import { Text, Card, Button, Menu, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import { getNotes, openOrDownloadFile } from '../../src/services/contentService';
import { EmptyState } from '../../src/components/EmptyState';
import { formatDate } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function StudentNotesScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [notes, setNotes] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotes = useCallback(async () => {
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
  }, [uid, selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, [loadNotes]);

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

  if (!uid) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* CLASS SELECTOR */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setMenuVisible(true)}
            style={[styles.select, { borderColor: colors.border }]}
            textColor={colors.text}
            icon="chevron-down"
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {selectedClass ? `${selectedClass.className} (${selectedClass.classroomCode})` : 'Select Classroom'}
          </Button>
        }
      >
        {classrooms.map((cls) => (
          <Menu.Item
            key={cls.classroomId}
            title={`${cls.className} (${cls.classroomCode})`}
            onPress={() => handleClassSelect(cls)}
          />
        ))}
      </Menu>

      {/* NOTES LIST */}
      {notes.length === 0 && !loading ? (
        <EmptyState
          title="No notes uploaded yet"
          subtitle="Study notes & documents published by your teacher will appear here"
        />
      ) : (
        notes.map((note) => (
          <Card
            key={note.noteId || note.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={[styles.noteTitle, { color: colors.text }]}>
                    {note.title}
                  </Text>
                  {note.description ? (
                    <Text style={[styles.desc, { color: colors.textSecondary }]}>
                      {note.description}
                    </Text>
                  ) : null}
                </View>
              </View>

              {note.fileName ? (
                <Chip icon="attachment" style={styles.chip} textStyle={{ fontSize: 11 }}>
                  {note.fileName}
                </Chip>
              ) : null}

              {note.createdAt && (
                <Text style={[styles.date, { color: colors.textSecondary }]}>
                  Uploaded: {formatDate(note.createdAt)}
                </Text>
              )}
            </Card.Content>

            <Card.Actions style={styles.cardActions}>
              <Button
                mode="contained-tonal"
                icon="download"
                buttonColor={isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight}
                textColor={colors.primaryDark}
                onPress={() => openOrDownloadFile(note.fileUrl, note.fileName)}
              >
                Access & Download File
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  select: { marginBottom: 16, borderRadius: 10 },
  card: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteTitle: { fontWeight: '700', fontSize: 16 },
  desc: { fontSize: 13, marginTop: 2 },
  chip: { alignSelf: 'flex-start', marginTop: 8 },
  date: { marginTop: 8, fontSize: 11 },
  cardActions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});