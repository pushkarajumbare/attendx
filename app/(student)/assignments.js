import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View, TouchableOpacity, Linking } from 'react-native';
import { Text, Card, Button, Menu, ActivityIndicator, Chip, ProgressBar, Portal, Dialog, TextInput } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import {
  getAssignments,
  openOrDownloadFile,
  pickDocument,
  submitAssignment,
  getStudentSubmission,
} from '../../src/services/contentService';
import { EmptyState } from '../../src/components/EmptyState';
import { formatDate, formatDateTime } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function StudentTasksScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissionsMap, setSubmissionsMap] = useState({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [submitProgress, setSubmitProgress] = useState(null);

  // URL submission modal
  const [urlDialogVisible, setUrlDialogVisible] = useState(false);
  const [targetAssignmentId, setTargetAssignmentId] = useState(null);
  const [submissionUrlInput, setSubmissionUrlInput] = useState('');

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const classes = await getStudentClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      const cls = selectedClass || safeClasses[0];
      if (cls) {
        setSelectedClass(cls);
        const data = await getAssignments(cls.classroomId);
        const fetchedAssignments = data || [];
        setAssignments(fetchedAssignments);

        // Fetch student submission status for each assignment
        const map = {};
        await Promise.all(
          fetchedAssignments.map(async (item) => {
            const id = item.assignmentId || item.id;
            const sub = await getStudentSubmission(id, uid);
            if (sub) map[id] = sub;
          })
        );
        setSubmissionsMap(map);
      }
    } catch (error) {
      console.log('Assignment load error:', error);
    }
  }, [uid, selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSelectClass = async (cls) => {
    setSelectedClass(cls);
    setMenuVisible(false);
    try {
      const data = await getAssignments(cls.classroomId);
      const fetched = data || [];
      setAssignments(fetched);

      const map = {};
      await Promise.all(
        fetched.map(async (item) => {
          const id = item.assignmentId || item.id;
          const sub = await getStudentSubmission(id, uid);
          if (sub) map[id] = sub;
        })
      );
      setSubmissionsMap(map);
    } catch (err) {
      console.log('Fetch class assignments error:', err);
    }
  };

  const handleFileSubmission = async (assignmentId) => {
    const file = await pickDocument();
    if (!file) return;

    try {
      setSubmittingId(assignmentId);
      setSubmitProgress(0);

      const sub = await submitAssignment(assignmentId, uid, { fileAsset: file }, (progress) => {
        setSubmitProgress(progress);
      });

      setSubmissionsMap((prev) => ({ ...prev, [assignmentId]: sub }));
      Alert.alert('Submitted 🎉', `Your solution file "${file.name}" has been uploaded.`);
    } catch (err) {
      Alert.alert('Submission Error', err.message || 'Failed to submit assignment');
    } finally {
      setSubmittingId(null);
      setSubmitProgress(null);
    }
  };

  const handleUrlSubmitConfirm = async () => {
    const trimmed = submissionUrlInput.trim();
    if (!trimmed) {
      Alert.alert('Validation Error', 'Please enter your completed work URL (e.g. GitHub, Google Drive, Notion)');
      return;
    }

    const assignmentId = targetAssignmentId;
    setUrlDialogVisible(false);

    try {
      setSubmittingId(assignmentId);
      const sub = await submitAssignment(assignmentId, uid, trimmed);

      setSubmissionsMap((prev) => ({ ...prev, [assignmentId]: sub }));
      setSubmissionUrlInput('');
      Alert.alert('Task Submitted 🎉', 'Your solution URL has been recorded successfully!');
    } catch (err) {
      Alert.alert('Submission Error', err.message || 'Failed to submit task');
    } finally {
      setSubmittingId(null);
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

  if (!uid) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* 1. CLASSROOM SELECTOR */}
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
                onPress={() => handleSelectClass(cls)}
              />
            ))}
          </Menu>

          {/* Quick Classroom Pills */}
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

      {/* 2. TASKS LIST */}
      <View style={{ marginBottom: 12, marginTop: 4 }}>
        <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
          {selectedClass?.className || 'Classroom'} Tasks ({assignments.length})
        </Text>
      </View>

      {assignments.length === 0 ? (
        <EmptyState
          title="No Tasks Assigned"
          subtitle="Tasks published by your teacher for this classroom will appear here."
        />
      ) : (
        assignments.map((item) => {
          const assignmentId = item.assignmentId || item.id;
          const isThisSubmitting = submittingId === assignmentId;
          const existingSubmission = submissionsMap[assignmentId];

          // Deadline calculation
          let isPastDeadline = false;
          if (item.deadline) {
            const deadlineMs = item.deadline.toDate ? item.deadline.toDate().getTime() : new Date(item.deadline).getTime();
            if (!Number.isNaN(deadlineMs) && Date.now() > deadlineMs) {
              isPastDeadline = true;
            }
          }

          return (
            <Card
              key={assignmentId}
              style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              mode="outlined"
            >
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.chipRow}>
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

                  {existingSubmission ? (
                    <Chip icon="check-circle" style={{ backgroundColor: THEME_COLORS.successLight }} textStyle={{ fontSize: 11, color: THEME_COLORS.success, fontWeight: '700' }}>
                      Submitted
                    </Chip>
                  ) : isPastDeadline ? (
                    <Chip icon="alert-circle" style={{ backgroundColor: THEME_COLORS.dangerLight }} textStyle={{ fontSize: 11, color: THEME_COLORS.danger, fontWeight: '700' }}>
                      Deadline Passed
                    </Chip>
                  ) : null}
                </View>

                {/* Submitted Work Link Display */}
                {existingSubmission?.submissionUrl && (
                  <View style={[styles.submittedBox, { backgroundColor: isDark ? colors.surfaceVariant : '#F8FAFC' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Your Submission:</Text>
                    <TouchableOpacity onPress={() => handleOpenUrl(existingSubmission.submissionUrl)}>
                      <Text
                        style={{ fontSize: 12, color: colors.primary, textDecorationLine: 'underline', marginTop: 3 }}
                        numberOfLines={2}
                      >
                        🔗 {existingSubmission.submissionUrl}
                      </Text>
                    </TouchableOpacity>
                    {existingSubmission.submittedAt && (
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 3 }}>
                        Recorded on: {formatDateTime(existingSubmission.submittedAt)}
                      </Text>
                    )}
                  </View>
                )}

                {isThisSubmitting && submitProgress !== null && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 11, color: colors.primary, marginBottom: 4 }}>Uploading: {submitProgress}%</Text>
                    <ProgressBar progress={submitProgress / 100} color={colors.primary} />
                  </View>
                )}
              </Card.Content>

              <Card.Actions style={styles.cardActions}>
                {item.fileUrl && (
                  <Button
                    mode="outlined"
                    icon="download"
                    textColor={colors.primary}
                    style={{ borderColor: colors.primary }}
                    onPress={() => openOrDownloadFile(item.fileUrl, item.fileName || 'task_instructions.pdf')}
                  >
                    Teacher File
                  </Button>
                )}

                {isPastDeadline ? (
                  <Button mode="contained" icon="lock" buttonColor={colors.border} textColor={colors.textSecondary} disabled>
                    Submissions Closed
                  </Button>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Button
                      mode="contained"
                      icon="link"
                      buttonColor={colors.primary}
                      disabled={isThisSubmitting}
                      onPress={() => {
                        setTargetAssignmentId(assignmentId);
                        setSubmissionUrlInput(existingSubmission?.submissionUrl || '');
                        setUrlDialogVisible(true);
                      }}
                    >
                      {existingSubmission ? 'Update URL' : 'Submit Task'}
                    </Button>
                    <Button
                      mode="outlined"
                      icon="upload"
                      textColor={colors.primary}
                      disabled={isThisSubmitting}
                      onPress={() => handleFileSubmission(assignmentId)}
                    >
                      File
                    </Button>
                  </View>
                )}
              </Card.Actions>
            </Card>
          );
        })
      )}

      {/* URL Submission Dialog */}
      <Portal>
        <Dialog visible={urlDialogVisible} onDismiss={() => setUrlDialogVisible(false)} style={{ borderRadius: 16 }}>
          <Dialog.Title style={{ fontWeight: '700' }}>Submit Completed Work</Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
              Paste the public link to your project (e.g. GitHub repository, Google Docs, Drive, or Figma):
            </Text>
            <TextInput
              label="Completed Work URL *"
              placeholder="https://github.com/username/project"
              value={submissionUrlInput}
              onChangeText={setSubmissionUrlInput}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="url"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUrlDialogVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button onPress={handleUrlSubmitConfirm} mode="contained" buttonColor={colors.primary}>
              Submit
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
  card: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  select: { borderRadius: 10 },
  taskCard: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  cardHeaderRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chip: { alignSelf: 'flex-start' },
  submittedBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cardActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});