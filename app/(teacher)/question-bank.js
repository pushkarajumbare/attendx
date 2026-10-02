import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, Menu, IconButton, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  getQuestionBank,
  uploadQuestionBank,
  pickDocument,
  openOrDownloadFile,
  deleteResource,
} from '../../src/services/contentService';
import { THEME_COLORS, COLLECTIONS } from '../../src/constants';

export default function TeacherQuestionBankScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!uid) return;

    try {
      const classes = await getTeacherClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      if (safeClasses.length > 0) {
        const cls = selectedClass || safeClasses[0];
        setSelectedClass(cls);

        const data = await getQuestionBank(cls.classroomId);
        setQuestions(data || []);
      }
    } catch (error) {
      console.log('Question bank load error:', error);
    }
  }, [uid, selectedClass]);

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
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    try {
      setIsUploading(true);
      await uploadQuestionBank(
        selectedClass.classroomId,
        uid,
        {
          title: title.trim(),
          description: description.trim(),
          linkUrl: linkUrl.trim(),
          fileAsset: selectedFile,
        }
      );

      const updated = await getQuestionBank(selectedClass.classroomId);
      setQuestions(updated || []);

      setTitle('');
      setDescription('');
      setLinkUrl('');
      setSelectedFile(null);
      Alert.alert('Success 🎉', 'Question bank resource uploaded');
    } catch (err) {
      Alert.alert('Error', err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Resource', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResource(COLLECTIONS.QUESTION_BANK, item.qbId || item.id);
            const updated = await getQuestionBank(selectedClass.classroomId);
            setQuestions(updated || []);
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
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
            onPress={async () => {
              setSelectedClass(cls);
              setMenuVisible(false);
              const data = await getQuestionBank(cls.classroomId);
              setQuestions(data || []);
            }}
          />
        ))}
      </Menu>

      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="help-box-outline" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
              Upload Question Bank / PYQ
            </Text>
          </View>

          <TextInput
            label="Title *"
            placeholder="e.g. Mid-Term Question Paper 2025"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

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
              name={selectedFile ? 'file-check' : 'paperclip'}
              size={24}
              color={selectedFile ? colors.primary : colors.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: selectedFile ? colors.primary : colors.text }}>
                {selectedFile ? selectedFile.name : 'Attach PDF / Question Paper'}
              </Text>
            </View>
          </TouchableOpacity>

          <Button
            mode="contained"
            icon="upload"
            onPress={handleUpload}
            loading={isUploading}
            disabled={isUploading}
            buttonColor={colors.primary}
            style={{ borderRadius: 10, marginTop: 6 }}
          >
            Publish Question Bank
          </Button>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 10, color: colors.text }}>
        Published Questions & Solutions ({questions.length})
      </Text>

      {questions.map((item) => (
        <Card
          key={item.qbId || item.id}
          style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          mode="outlined"
        >
          <Card.Content>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{item.description}</Text>
                ) : null}
              </View>
              <IconButton
                icon="delete-outline"
                iconColor={THEME_COLORS.danger}
                size={20}
                onPress={() => handleDelete(item)}
              />
            </View>
          </Card.Content>
          {item.fileUrl && (
            <Card.Actions style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' }}>
              <Button
                mode="text"
                icon="download"
                textColor={colors.primary}
                onPress={() => openOrDownloadFile(item.fileUrl, item.fileName || 'question_bank.pdf')}
              >
                Download PDF
              </Button>
            </Card.Actions>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  select: { marginBottom: 14, borderRadius: 10 },
  card: { marginBottom: 18, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { marginBottom: 12 },
  filePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 10,
    marginBottom: 12,
  },
  itemCard: { marginBottom: 12, borderRadius: 14, borderWidth: 1 },
});