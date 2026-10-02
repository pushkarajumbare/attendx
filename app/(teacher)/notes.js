import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, Menu, ProgressBar, IconButton, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  getNotes,
  uploadNote,
  pickDocument,
  openOrDownloadFile,
  deleteResource,
} from '../../src/services/contentService';
import { formatDate } from '../../src/utils/helpers';
import { THEME_COLORS, COLLECTIONS } from '../../src/constants';

export default function TeacherNotesScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.uid) return;

    try {
      const classes = await getTeacherClassrooms(profile.uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      if (safeClasses.length > 0) {
        const cls = selectedClass || safeClasses[0];
        setSelectedClass(cls);

        const data = await getNotes(cls.classroomId);
        setNotes(data || []);
      }
    } catch (error) {
      console.log('Notes load error:', error);
      Alert.alert('Error', 'Failed to load classroom notes');
    }
  }, [profile?.uid, selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handlePickFile = async () => {
    const file = await pickDocument();
    if (file) {
      setSelectedFile(file);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedClass) {
      Alert.alert('Error', 'Please select a classroom first');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    if (!selectedFile && !linkUrl.trim()) {
      Alert.alert('Error', 'Please attach a document or provide a link URL');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      await uploadNote(
        selectedClass.classroomId,
        profile.uid,
        {
          title: title.trim(),
          description: description.trim(),
          linkUrl: linkUrl.trim(),
          fileAsset: selectedFile,
        },
        (progress) => setUploadProgress(progress)
      );

      // Refresh list
      const updated = await getNotes(selectedClass.classroomId);
      setNotes(updated || []);

      // Reset form
      setTitle('');
      setDescription('');
      setLinkUrl('');
      setSelectedFile(null);
      setUploadProgress(null);
      Alert.alert('Success 🎉', 'File uploaded & published to classroom!');
    } catch (error) {
      console.error('Upload note error:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (note) => {
    Alert.alert('Delete Note', `Are you sure you want to remove "${note.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResource(COLLECTIONS.NOTES, note.noteId || note.id);
            const updated = await getNotes(selectedClass.classroomId);
            setNotes(updated || []);
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete note');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* 1. CLASSROOM SELECTOR */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setMenuVisible(true)}
            style={[styles.selectBtn, { borderColor: colors.border }]}
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
            onPress={async () => {
              setSelectedClass(cls);
              setMenuVisible(false);
              const data = await getNotes(cls.classroomId);
              setNotes(data || []);
            }}
          />
        ))}
      </Menu>

      {/* 2. UPLOAD CARD */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="file-upload" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={[styles.cardTitle, { color: colors.text }]}>
              Upload Notes & Documents
            </Text>
          </View>

          <TextInput
            label="Title *"
            placeholder="e.g. Chapter 4 Lecture Notes"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <TextInput
            label="Description (Optional)"
            placeholder="Add brief details about the document"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          {/* File Picker Button */}
          <TouchableOpacity
            style={[
              styles.filePickerBox,
              {
                borderColor: selectedFile ? colors.primary : colors.border,
                backgroundColor: isDark ? colors.surfaceAccent : (selectedFile ? THEME_COLORS.primaryLight : '#F9FAFB'),
              },
            ]}
            onPress={handlePickFile}
          >
            <MaterialCommunityIcons
              name={selectedFile ? 'file-check' : 'cloud-upload-outline'}
              size={28}
              color={selectedFile ? colors.primary : colors.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.filePickerLabel, { color: selectedFile ? colors.primary : colors.text }]}>
                {selectedFile ? selectedFile.name : 'Tap to Attach File (PDF, DOCX, PPT, Image)'}
              </Text>
              {selectedFile && (
                <Text style={[styles.fileSizeText, { color: colors.textSecondary }]}>
                  Size: {(selectedFile.size / 1024).toFixed(1)} KB
                </Text>
              )}
            </View>
            {selectedFile && (
              <IconButton
                icon="close-circle"
                size={20}
                iconColor={THEME_COLORS.danger}
                onPress={() => setSelectedFile(null)}
              />
            )}
          </TouchableOpacity>

          <TextInput
            label="Or External Web Link (Optional)"
            placeholder="https://..."
            value={linkUrl}
            onChangeText={setLinkUrl}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          {/* Upload Progress Bar */}
          {uploadProgress !== null && (
            <View style={styles.progressBox}>
              <View style={styles.progressLabelRow}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Uploading to Cloud...</Text>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{uploadProgress}%</Text>
              </View>
              <ProgressBar progress={uploadProgress / 100} color={colors.primary} style={styles.progressBar} />
            </View>
          )}

          <Button
            mode="contained"
            icon="upload"
            onPress={handleUpload}
            loading={isUploading}
            disabled={isUploading}
            style={styles.uploadBtn}
            buttonColor={colors.primary}
          >
            {isUploading ? `Uploading (${uploadProgress || 0}%)` : 'Publish Document'}
          </Button>
        </Card.Content>
      </Card>

      {/* 3. NOTES LIST */}
      <Text variant="titleMedium" style={[styles.listHeader, { color: colors.text }]}>
        Published Notes ({notes.length})
      </Text>

      {notes.length === 0 ? (
        <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={{ alignItems: 'center', paddingVertical: 18 }}>
            <MaterialCommunityIcons name="file-document-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No notes published in this classroom yet.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        notes.map((note) => (
          <Card
            key={note.noteId || note.id}
            style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
          >
            <Card.Content>
              <View style={styles.noteTopRow}>
                <View style={styles.noteTitleArea}>
                  <Text variant="titleMedium" style={[styles.noteTitle, { color: colors.text }]}>
                    {note.title}
                  </Text>
                  {note.description ? (
                    <Text style={[styles.noteDesc, { color: colors.textSecondary }]}>
                      {note.description}
                    </Text>
                  ) : null}
                  {note.fileName ? (
                    <Chip icon="attachment" style={styles.fileChip} textStyle={{ fontSize: 11 }}>
                      {note.fileName}
                    </Chip>
                  ) : null}
                  {note.createdAt && (
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                      Uploaded: {formatDate(note.createdAt)}
                    </Text>
                  )}
                </View>
                <IconButton
                  icon="delete-outline"
                  iconColor={THEME_COLORS.danger}
                  size={20}
                  onPress={() => handleDelete(note)}
                />
              </View>
            </Card.Content>
            <Card.Actions style={styles.cardActions}>
              <Button
                mode="contained-tonal"
                icon="open-in-new"
                buttonColor={isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight}
                textColor={colors.primaryDark}
                onPress={() => openOrDownloadFile(note.fileUrl, note.fileName)}
              >
                View / Download File
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
  selectBtn: { marginBottom: 14, borderRadius: 10 },
  card: { marginBottom: 18, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontWeight: '700' },
  input: { marginBottom: 12 },
  filePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 12,
    marginBottom: 12,
  },
  filePickerLabel: { fontSize: 13, fontWeight: '600' },
  fileSizeText: { fontSize: 11, marginTop: 2 },
  progressBox: { marginBottom: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressBar: { height: 6, borderRadius: 3 },
  uploadBtn: { borderRadius: 10, marginTop: 4 },
  listHeader: { fontWeight: '700', marginBottom: 10 },
  emptyCard: { borderRadius: 14, borderWidth: 1 },
  emptyText: { marginTop: 8, fontSize: 13 },
  noteCard: { marginBottom: 12, borderRadius: 14, borderWidth: 1 },
  noteTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  noteTitleArea: { flex: 1 },
  noteTitle: { fontWeight: '700', fontSize: 16 },
  noteDesc: { fontSize: 13, marginTop: 2 },
  fileChip: { alignSelf: 'flex-start', marginTop: 6 },
  dateText: { fontSize: 11, marginTop: 6 },
  cardActions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
});