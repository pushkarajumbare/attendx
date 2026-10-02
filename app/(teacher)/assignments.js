import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
import { Text, Card, Button, TextInput, Menu, ProgressBar, IconButton, Chip, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  getAssignments,
  uploadAssignment,
  pickDocument,
  openOrDownloadFile,
  deleteResource,
  getAssignmentSubmissionsForTeacher,
} from '../../src/services/contentService';
import { formatDateTime, toValidDate } from '../../src/utils/helpers';
import { THEME_COLORS, COLLECTIONS } from '../../src/constants';

export default function TeacherTasksScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [classroomError, setClassroomError] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState(null);

  // Add Task Toggle & Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [maxMarks, setMaxMarks] = useState('100');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Submissions Modal State
  const [submissionsModalVisible, setSubmissionsModalVisible] = useState(false);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState('');
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Load classrooms on focus
  const loadClassroomsData = useCallback(async () => {
    if (!uid) {
      setLoadingClassrooms(false);
      return;
    }

    try {
      setClassroomError(null);
      const classes = await getTeacherClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      if (safeClasses.length > 0) {
        setSelectedClass((prev) => {
          if (prev && safeClasses.some((c) => c.classroomId === prev.classroomId)) {
            return prev;
          }
          return safeClasses[0];
        });
      } else {
        setSelectedClass(null);
        setTasks([]);
      }
    } catch (error) {
      console.log('Load teacher classrooms error:', error);
      setClassroomError(error.message || 'Failed to load classrooms');
    } finally {
      setLoadingClassrooms(false);
    }
  }, [uid]);

  // Load tasks whenever selected classroom changes
  const loadTasksForClass = useCallback(async (classroomId) => {
    if (!classroomId) {
      setTasks([]);
      setLoadingTasks(false);
      return;
    }
    try {
      setTaskError(null);
      setLoadingTasks(true);
      const data = await getAssignments(classroomId);
      setTasks(data || []);
    } catch (error) {
      console.log('Load tasks error:', error);
      setTasks([]);
      setTaskError(error.message || 'Failed to load tasks');
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClassroomsData();
    }, [loadClassroomsData])
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedClass?.classroomId) {
        loadTasksForClass(selectedClass.classroomId);
      }
    }, [selectedClass?.classroomId, loadTasksForClass])
  );

  const handleSelectClass = (cls) => {
    setSelectedClass(cls);
    setTasks([]);
    setMenuVisible(false);
  };

  const handlePickFile = async () => {
    const file = await pickDocument();
    if (file) {
      setSelectedFile(file);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSetQuickDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDeadlineDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleCreateTask = async () => {
    if (!uid || !selectedClass) {
      Alert.alert('Error', 'Please select a classroom first');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a task title');
      return;
    }

    let parsedDeadline = null;
    if (deadlineDate.trim()) {
      const combined = `${deadlineDate.trim()}T${(deadlineTime.trim() || '23:59')}:00`;
      parsedDeadline = new Date(combined);
      if (Number.isNaN(parsedDeadline.getTime())) {
        parsedDeadline = new Date(`${deadlineDate.trim()} ${(deadlineTime.trim() || '23:59')}`);
      }
      if (Number.isNaN(parsedDeadline.getTime())) {
        Alert.alert('Invalid Date', 'Please enter the deadline date as YYYY-MM-DD (e.g. 2026-10-15)');
        return;
      }
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      await uploadAssignment(
        selectedClass.classroomId,
        uid,
        {
          title: title.trim(),
          description: description.trim(),
          resourceUrl: resourceUrl.trim(),
          deadline: parsedDeadline,
          maxMarks: parseInt(maxMarks, 10) || 100,
          fileAsset: selectedFile,
        },
        (progress) => setUploadProgress(progress)
      );

      await loadTasksForClass(selectedClass.classroomId);

      // Reset form
      setTitle('');
      setDescription('');
      setResourceUrl('');
      setDeadlineDate('');
      setDeadlineTime('23:59');
      setMaxMarks('100');
      setSelectedFile(null);
      setUploadProgress(null);
      setShowAddForm(false);

      Alert.alert('Task Created 🎉', `"${title.trim()}" published for ${selectedClass.className}!`);
    } catch (error) {
      Alert.alert('Upload Error', error.message || 'Failed to create task');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTask = (item) => {
    Alert.alert('Delete Task', `Delete "${item.title}"? This will also remove any student submissions.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResource(COLLECTIONS.ASSIGNMENTS, item.assignmentId || item.id);
            await loadTasksForClass(selectedClass.classroomId);
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleViewSubmissions = async (taskItem) => {
    const taskId = taskItem.assignmentId || taskItem.id;
    if (!selectedClass?.classroomId) return;

    setSelectedTaskTitle(taskItem.title);
    setSubmissionsModalVisible(true);
    setLoadingSubmissions(true);

    try {
      const list = await getAssignmentSubmissionsForTeacher(taskId, selectedClass.classroomId, uid);
      setStudentSubmissions(list);
    } catch (err) {
      console.log('Error fetching submissions:', err);
      Alert.alert('Error', 'Failed to fetch student submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleOpenUrl = async (url) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        openOrDownloadFile(url, 'submission');
      }
    } catch (_) {
      openOrDownloadFile(url, 'submission');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* 1. CLASSROOM SELECTOR HEADER */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="google-classroom" size={20} color={colors.primary} />
            <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
              Select Classroom
            </Text>
          </View>

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
                onPress={() => handleSelectClass(cls)}
              />
            ))}
          </Menu>

          {/* Quick Classroom Horizontal Chips */}
          {classrooms.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {classrooms.map((cls) => {
                  const isSelected = selectedClass?.classroomId === cls.classroomId;
                  return (
                    <Chip
                      key={cls.classroomId}
                      selected={isSelected}
                      onPress={() => handleSelectClass(cls)}
                      style={{
                        backgroundColor: isSelected
                          ? (isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight)
                          : (isDark ? colors.surfaceVariant : '#F3F4F6'),
                      }}
                      textStyle={{
                        color: isSelected ? colors.primary : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      {cls.className}
                    </Chip>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* 2. + ADD TASK BUTTON */}
      <View style={{ marginBottom: 16 }}>
        <Button
          mode={showAddForm ? 'outlined' : 'contained'}
          icon={showAddForm ? 'close-circle' : 'plus-circle'}
          onPress={() => setShowAddForm((prev) => !prev)}
          buttonColor={showAddForm ? undefined : colors.primary}
          textColor={showAddForm ? colors.text : '#FFF'}
          style={{ borderRadius: 12 }}
          contentStyle={{ paddingVertical: 6 }}
        >
          {showAddForm ? 'Cancel New Task' : '+ Add Task'}
        </Button>
      </View>

      {/* 3. ADD TASK FORM (EXPANDABLE) */}
      {showAddForm && (
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1.5 }]} mode="outlined">
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="clipboard-plus-outline" size={22} color={colors.primary} />
              <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                Create Task for {selectedClass?.className || 'Classroom'}
              </Text>
            </View>

            <TextInput
              label="Task Title *"
              placeholder="e.g. Lab Project 1 - Binary Search Tree"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
            />

            <TextInput
              label="Description / Instructions"
              placeholder="Provide instructions, rubric, or requirements..."
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
            />

            <TextInput
              label="Resource / Reference Link (URL)"
              placeholder="https://example.com/resource"
              value={resourceUrl}
              onChangeText={setResourceUrl}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
            />

            {/* Task File Attachment Box */}
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
                <Text style={[styles.filePickerLabel, { color: selectedFile ? colors.primary : colors.text }]}>
                  {selectedFile ? selectedFile.name : 'Upload Task File / Reference (Optional)'}
                </Text>
                {selectedFile && (
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </Text>
                )}
              </View>
              {selectedFile && (
                <IconButton
                  icon="close-circle"
                  size={18}
                  iconColor={THEME_COLORS.danger}
                  onPress={() => setSelectedFile(null)}
                />
              )}
            </TouchableOpacity>

            {/* Deadline Date & Time Inputs */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                label="Deadline Date (YYYY-MM-DD)"
                placeholder="2026-10-15"
                value={deadlineDate}
                onChangeText={setDeadlineDate}
                mode="outlined"
                style={[styles.input, { flex: 1.4 }]}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.text}
              />
              <TextInput
                label="Time (HH:mm)"
                placeholder="23:59"
                value={deadlineTime}
                onChangeText={setDeadlineTime}
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                textColor={colors.text}
              />
            </View>

            {/* Quick Date Presets */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              <Chip compact onPress={() => handleSetQuickDate(0)} textStyle={{ fontSize: 11 }}>Today</Chip>
              <Chip compact onPress={() => handleSetQuickDate(1)} textStyle={{ fontSize: 11 }}>Tomorrow</Chip>
              <Chip compact onPress={() => handleSetQuickDate(3)} textStyle={{ fontSize: 11 }}>+3 Days</Chip>
              <Chip compact onPress={() => handleSetQuickDate(7)} textStyle={{ fontSize: 11 }}>+1 Week</Chip>
            </View>

            <TextInput
              label="Max Marks"
              value={maxMarks}
              onChangeText={setMaxMarks}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { width: 130 }]}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
            />

            {uploadProgress !== null && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.primary, fontSize: 12, marginBottom: 4 }}>Uploading Task: {uploadProgress}%</Text>
                <ProgressBar progress={uploadProgress / 100} color={colors.primary} />
              </View>
            )}

            <Button
              mode="contained"
              icon="publish"
              onPress={handleCreateTask}
              loading={isUploading}
              disabled={isUploading}
              buttonColor={colors.primary}
              style={{ borderRadius: 10, marginTop: 4 }}
              contentStyle={{ paddingVertical: 6 }}
            >
              Publish Task
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* 4. TASKS LIST */}
      <View style={styles.sectionHeaderRow}>
        <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
          {selectedClass?.className || 'Classroom'} Tasks ({tasks.length})
        </Text>
      </View>

      {loadingClassrooms && classrooms.length === 0 ? (
        <ActivityIndicator size="medium" color={colors.primary} style={{ marginVertical: 30 }} />
      ) : classroomError ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ color: THEME_COLORS.danger, textAlign: 'center' }}>{classroomError}</Text>
          <Button mode="text" onPress={loadClassroomsData} textColor={colors.primary}>Retry</Button>
        </View>
      ) : loadingTasks ? (
        <ActivityIndicator size="medium" color={colors.primary} style={{ marginVertical: 30 }} />
      ) : taskError ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ color: THEME_COLORS.danger, textAlign: 'center' }}>{taskError}</Text>
          <Button mode="text" onPress={() => loadTasksForClass(selectedClass?.classroomId)} textColor={colors.primary}>Retry</Button>
        </View>
      ) : tasks.length === 0 ? (
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={40} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
              No tasks created yet for {selectedClass?.className || 'this classroom'}.
            </Text>
            <Button mode="text" icon="plus" textColor={colors.primary} onPress={() => setShowAddForm(true)}>
              Create First Task
            </Button>
          </Card.Content>
        </Card>
      ) : (
        tasks.map((item) => {
          const taskId = item.assignmentId || item.id;
          let isPastDeadline = false;
          if (item.deadline) {
            const deadline = toValidDate(item.deadline);
            isPastDeadline = !deadline || Date.now() >= deadline.getTime();
          }

          return (
            <Card
              key={taskId}
              style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              mode="outlined"
            >
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <Chip icon="star-outline" style={styles.chip} textStyle={{ fontSize: 11 }}>
                        Max: {item.maxMarks || 100} pts
                      </Chip>

                      {item.deadline && (
                        <Chip
                          icon="calendar-clock"
                          style={[styles.chip, isPastDeadline && { backgroundColor: THEME_COLORS.dangerLight }]}
                          textStyle={{
                            fontSize: 11,
                            color: isPastDeadline ? THEME_COLORS.danger : colors.text,
                            fontWeight: isPastDeadline ? '700' : '500',
                          }}
                        >
                          Due: {formatDateTime(item.deadline)}
                        </Chip>
                      )}

                      {isPastDeadline && (
                        <Chip style={{ backgroundColor: THEME_COLORS.dangerLight }} textStyle={{ fontSize: 11, color: THEME_COLORS.danger, fontWeight: '700' }}>
                          Closed
                        </Chip>
                      )}
                    </View>
                  </View>

                  <IconButton
                    icon="delete-outline"
                    iconColor={THEME_COLORS.danger}
                    size={20}
                    onPress={() => handleDeleteTask(item)}
                  />
                </View>
              </Card.Content>

              <Card.Actions style={styles.cardActions}>
                {item.resourceUrl && (
                  <Button
                    mode="outlined"
                    icon="open-in-new"
                    textColor={colors.primary}
                    style={{ borderColor: colors.primary }}
                    onPress={() => handleOpenUrl(item.resourceUrl)}
                  >
                    Open Link
                  </Button>
                )}
                {item.fileUrl && (
                  <Button
                    mode="outlined"
                    icon="download"
                    textColor={colors.primary}
                    style={{ borderColor: colors.primary }}
                    onPress={() => openOrDownloadFile(item.fileUrl, item.fileName || 'task_attachment.pdf')}
                  >
                    Attachment
                  </Button>
                )}

                <Button
                  mode="contained-tonal"
                  icon="account-group"
                  textColor={colors.primary}
                  onPress={() => handleViewSubmissions(item)}
                >
                  View Submissions
                </Button>
              </Card.Actions>
            </Card>
          );
        })
      )}

      {/* 5. TEACHER SUBMISSIONS OVERVIEW MODAL */}
      <Portal>
        <Dialog
          visible={submissionsModalVisible}
          onDismiss={() => setSubmissionsModalVisible(false)}
          style={{ maxHeight: '82%', borderRadius: 16 }}
        >
          <Dialog.Title style={{ fontSize: 17, fontWeight: '700' }}>
            Submissions: {selectedTaskTitle}
          </Dialog.Title>
          <Dialog.Content>
            {loadingSubmissions ? (
              <ActivityIndicator size="medium" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : studentSubmissions.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textSecondary, marginVertical: 24 }}>
                No enrolled students found in this classroom.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                  Enrolled Students ({studentSubmissions.length})
                </Text>
                {studentSubmissions.map((sub, index) => {
                  const isSubmitted = sub.status === 'Submitted';
                  return (
                    <View
                      key={sub.studentId || index}
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: index < studentSubmissions.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>
                            {sub.name} {sub.rollNumber ? `(${sub.rollNumber})` : ''}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                            {sub.email || 'No email registered'}
                          </Text>
                        </View>

                        <Chip
                          style={{
                            backgroundColor: isSubmitted ? THEME_COLORS.successLight : (isDark ? colors.surfaceVariant : '#F3F4F6'),
                          }}
                          textStyle={{
                            fontSize: 11,
                            color: isSubmitted ? THEME_COLORS.success : colors.textSecondary,
                            fontWeight: '700',
                          }}
                        >
                          {sub.status}
                        </Chip>
                      </View>

                      {isSubmitted && sub.submissionUrl && (
                        <View style={{ marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: isDark ? colors.surfaceVariant : '#F8FAFC' }}>
                          <TouchableOpacity onPress={() => handleOpenUrl(sub.submissionUrl)}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.primary,
                                textDecorationLine: 'underline',
                                fontWeight: '600',
                              }}
                              numberOfLines={2}
                            >
                              🔗 {sub.submissionUrl}
                            </Text>
                          </TouchableOpacity>
                          {sub.submittedAt && (
                            <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 3 }}>
                              Submitted: {formatDateTime(sub.submittedAt)}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSubmissionsModalVisible(false)} textColor={colors.primary}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 16, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  selectBtn: { borderRadius: 10 },
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
  filePickerLabel: { fontSize: 13, fontWeight: '600' },
  sectionHeaderRow: { marginBottom: 10 },
  taskCard: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  chip: { alignSelf: 'flex-start' },
  cardActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
