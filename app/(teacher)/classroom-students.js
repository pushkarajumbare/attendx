import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  Searchbar,
  Chip,
  Avatar,
  Portal,
  Dialog,
  TextInput,
  IconButton,
} from 'react-native-paper';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import {
  getClassroomStudents,
  getTeacherClassrooms,
  updateStudentRollNumber,
} from '../../src/services/classroomService';
import { getAttendanceStats } from '../../src/services/attendanceService';
import { THEME_COLORS } from '../../src/constants';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorScreen } from '../../src/components/ErrorScreen';
import { FadeInView } from '../../src/components/FadeInView';
import { IconBadge } from '../../src/components/IconBadge';

export default function ClassroomStudentsScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { classroomId } = useLocalSearchParams();
  const resolvedClassId = Array.isArray(classroomId) ? classroomId[0] : classroomId;
  const uid = profile?.uid || user?.uid;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentDetails, setStudentDetails] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Roll Number Dialog state
  const [rollDialogVisible, setRollDialogVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [rollInput, setRollInput] = useState('');
  const [savingRoll, setSavingRoll] = useState(false);

  const loadClassroomData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const classes = await getTeacherClassrooms(uid);
      const targetClass =
        (resolvedClassId && classes?.find((c) => c.classroomId === resolvedClassId)) ||
        classes?.[0] ||
        null;

      if (targetClass) {
        setClassroom(targetClass);
        const roster = await getClassroomStudents(targetClass.classroomId);
        setStudents(roster || []);

        const detailsMap = {};
        await Promise.all(
          (roster || []).map(async (student) => {
            try {
              detailsMap[student.studentId] = await getAttendanceStats(
                student.studentId,
                targetClass.classroomId
              );
            } catch (_) {
              detailsMap[student.studentId] = { present: 0, total: 0 };
            }
          })
        );
        setStudentDetails(detailsMap);
      } else {
        setClassroom(null);
        setStudents([]);
        setError('No classroom found');
      }
    } catch (err) {
      console.log('Load classroom students error:', err);
      setError(err.message || 'Failed to load student roster');
    } finally {
      setLoading(false);
    }
  }, [uid, resolvedClassId]);

  useFocusEffect(
    useCallback(() => {
      loadClassroomData();
    }, [loadClassroomData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClassroomData();
    setRefreshing(false);
  }, [loadClassroomData]);

  const openRollDialog = (student) => {
    setEditingStudent(student);
    setRollInput(student.rollNumber || '');
    setRollDialogVisible(true);
  };

  const handleSaveRollNumber = async (overrideBlank = false) => {
    if (!classroom?.classroomId || !uid || !editingStudent || savingRoll) return;
    const valueToSave = overrideBlank ? '' : rollInput.trim();
    setSavingRoll(true);
    try {
      await updateStudentRollNumber(
        classroom.classroomId,
        uid,
        editingStudent.studentId,
        valueToSave
      );
      setRollDialogVisible(false);
      await loadClassroomData();
    } catch (err) {
      Alert.alert('Roll Number Update Failed', err.message || 'Could not update roll number.');
    } finally {
      setSavingRoll(false);
    }
  };

  const calculatePercentage = (stats) => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.present / stats.total) * 100);
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 80) return THEME_COLORS.success;
    if (percentage >= 60) return THEME_COLORS.warning;
    return THEME_COLORS.danger;
  };

  const filteredStudents = students.filter((s) => {
    if (!searchQuery?.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
      (s.studentId && s.studentId.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return <LoadingScreen message="Loading student roster..." iconName="account-group" />;
  }

  if (error || !classroom) {
    return (
      <ErrorScreen
        title="Classroom Unavailable"
        message={error || 'Classroom not found'}
        onRetry={loadClassroomData}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={styles.scroll}
      >
        <FadeInView>
          <Card style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
            <Card.Content>
              <View style={styles.headerTopRow}>
                <IconBadge name="google-classroom" size={24} boxSize={48} borderRadius={16} />
                <View style={{ flex: 1 }}>
                  <Text variant="headlineSmall" style={{ fontWeight: '800', color: colors.text }}>
                    {classroom.className}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {classroom.subject || 'General'} · Code: {classroom.classroomCode}
                  </Text>
                </View>
              </View>

              <View style={styles.headerChipsRow}>
                <Chip
                  icon="account-group"
                  style={{ backgroundColor: colors.primarySoft }}
                  textStyle={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}
                >
                  {students.length} Enrolled
                </Chip>
                <Button
                  mode="outlined"
                  compact
                  icon="calendar-clock"
                  textColor={colors.primary}
                  style={{ borderColor: colors.primary, borderRadius: 10 }}
                  onPress={() => router.push('/(teacher)/attendance-session')}
                >
                  Manage Sessions
                </Button>
                <Button
                  mode="contained-tonal"
                  compact
                  icon="chart-box-outline"
                  buttonColor={colors.primarySoft}
                  textColor={isDark ? THEME_COLORS.secondary : colors.primaryDark}
                  onPress={() => router.push('/(teacher)/attendance-report')}
                >
                  Reports
                </Button>
              </View>
            </Card.Content>
          </Card>
        </FadeInView>

        <Searchbar
          placeholder="Search name, email, or roll number..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
          inputStyle={{ color: colors.text }}
          iconColor={colors.textSecondary}
        />

        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12, color: colors.text }}>
          Enrolled Students ({filteredStudents.length})
        </Text>

        {filteredStudents.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 24 }}>
              <MaterialCommunityIcons name="account-search-outline" size={42} color={colors.primary} />
              <Text style={{ fontWeight: '700', marginTop: 10, color: colors.text }}>No Students Found</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                Share classroom code {classroom.classroomCode} so students can join.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredStudents.map((student, index) => {
            const stats = studentDetails[student.studentId] || { present: 0, total: 0 };
            const percentage = calculatePercentage(stats);
            const attendanceColor = getAttendanceColor(percentage);
            const hasRoll = Boolean(student.rollNumber && student.rollNumber.trim());

            return (
              <Card
                key={student.studentId}
                style={[styles.studentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                mode="outlined"
              >
                <Card.Content style={styles.studentContent}>
                  <View style={styles.studentRow}>
                    <View style={styles.studentInfo}>
                      <View style={[styles.numberBadge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.numberText, { color: colors.primary }]}>{index + 1}</Text>
                      </View>
                      <Avatar.Text
                        size={40}
                        label={(student.name || 'Student').slice(0, 2).toUpperCase()}
                        style={{ backgroundColor: colors.primary }}
                        color="#FFFFFF"
                      />
                      <View style={styles.studentMeta}>
                        <Text variant="titleSmall" style={{ fontWeight: '700', color: colors.text }}>
                          {student.name || 'Student'}
                        </Text>
                        <Text variant="bodySmall" style={{ color: colors.textSecondary }} numberOfLines={1}>
                          {student.email || student.studentId}
                        </Text>
                        <View style={styles.metaBadges}>
                          {hasRoll ? (
                            <Chip
                              compact
                              icon="numeric"
                              style={{ backgroundColor: colors.primarySoft, height: 26 }}
                              textStyle={{ color: colors.primary, fontSize: 11, fontWeight: '700', lineHeight: 16 }}
                            >
                              Roll: {student.rollNumber}
                            </Chip>
                          ) : null}
                          <Chip
                            compact
                            icon="face-recognition"
                            style={{
                              backgroundColor: student.faceRegistered
                                ? colors.successSurface
                                : colors.surfaceVariant,
                              height: 26,
                            }}
                            textStyle={{
                              color: student.faceRegistered ? THEME_COLORS.success : colors.textSecondary,
                              fontSize: 10.5,
                              fontWeight: '600',
                              lineHeight: 16,
                            }}
                          >
                            {student.faceRegistered ? 'Face Ready' : 'Face Pending'}
                          </Chip>
                        </View>
                      </View>
                    </View>

                    <View style={styles.attendanceBox}>
                      <Text variant="headlineSmall" style={{ fontWeight: '800', color: attendanceColor }}>
                        {percentage}%
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {stats.present}/{stats.total} sessions
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${Math.min(percentage, 100)}%`, backgroundColor: attendanceColor },
                      ]}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <Button
                      mode="outlined"
                      compact
                      icon="pencil-outline"
                      textColor={colors.primary}
                      style={{ borderColor: colors.border, borderRadius: 10 }}
                      onPress={() => openRollDialog(student)}
                    >
                      {hasRoll ? 'Edit Roll No' : 'Add Roll No'}
                    </Button>
                    <Button
                      mode="text"
                      compact
                      icon="calendar-check"
                      textColor={colors.primary}
                      onPress={() => router.push('/(teacher)/attendance-report')}
                    >
                      Edit Attendance
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={rollDialogVisible} onDismiss={() => setRollDialogVisible(false)}>
          <Dialog.Title>
            {editingStudent?.rollNumber ? 'Edit Roll Number' : 'Assign Roll Number'}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              Student: {editingStudent?.name || 'Student'}
              {'\n'}Leave empty and save if you want to keep the roll number blank.
            </Text>
            <TextInput
              label="Roll Number (Optional)"
              placeholder="e.g. CS-101 or 24"
              value={rollInput}
              onChangeText={setRollInput}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              right={
                rollInput ? (
                  <TextInput.Icon
                    icon="close"
                    onPress={() => setRollInput('')}
                    color={colors.textSecondary}
                  />
                ) : null
              }
            />
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <Button
              textColor={THEME_COLORS.danger}
              disabled={savingRoll}
              onPress={() => handleSaveRollNumber(true)}
            >
              Keep Blank
            </Button>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button onPress={() => setRollDialogVisible(false)} disabled={savingRoll}>
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor={colors.primary}
                textColor="#FFFFFF"
                loading={savingRoll}
                disabled={savingRoll}
                onPress={() => handleSaveRollNumber(false)}
              >
                Save
              </Button>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  headerCard: { marginBottom: 14, borderRadius: 18, borderWidth: 1 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  search: { marginBottom: 16, borderRadius: 14, borderWidth: 1 },
  emptyCard: { borderRadius: 16, borderWidth: 1 },
  studentCard: { marginBottom: 12, borderRadius: 16, borderWidth: 1 },
  studentContent: { paddingVertical: 12, paddingHorizontal: 14 },
  studentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  studentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  numberBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numberText: { fontWeight: '700', fontSize: 12 },
  studentMeta: { marginLeft: 10, flex: 1 },
  metaBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  attendanceBox: { alignItems: 'flex-end', marginLeft: 8 },
  progressContainer: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
});
