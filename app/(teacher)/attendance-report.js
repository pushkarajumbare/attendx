import { useState, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View, Alert, Share, RefreshControl } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Text, Card, Menu, Button, DataTable, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  getClassroomAttendanceExportData,
  getClassroomAttendanceReport,
  getStudentLectureHistory,
  setStudentSessionAttendance,
} from '../../src/services/attendanceService';
import {
  calculateAttendancePercentage,
  exportAttendanceToCSV,
  formatDate,
  formatDateTime,
  formatTime,
} from '../../src/utils/helpers';
import { ATTENDANCE_STATUS, THEME_COLORS } from '../../src/constants';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorScreen } from '../../src/components/ErrorScreen';
import { FadeInView } from '../../src/components/FadeInView';
import { IconBadge } from '../../src/components/IconBadge';

export default function AttendanceReportScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid || user?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentRows, setStudentRows] = useState([]);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [updatingLectureId, setUpdatingLectureId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const selectedClassRef = useRef(null);
  selectedClassRef.current = selectedClass;

  const loadData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const classes = await getTeacherClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      if (safeClasses.length > 0) {
        const cls =
          safeClasses.find((item) => item.classroomId === selectedClassRef.current?.classroomId) ||
          safeClasses[0];
        setSelectedClass(cls);
        const report = await getClassroomAttendanceReport(cls.classroomId, uid);
        setStudentRows(report || []);
      } else {
        setSelectedClass(null);
        setStudentRows([]);
      }
    } catch (loadErr) {
      console.log('Attendance report load error:', loadErr);
      setError(loadErr.message || 'Failed to load attendance report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const handleExportCSV = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      if (!selectedClass?.classroomId) throw new Error('Select a classroom before exporting.');
      const data = await getClassroomAttendanceExportData(selectedClass.classroomId, uid);
      const csv = exportAttendanceToCSV(data);
      const filename = `attendance-${selectedClass.classroomId}-${Date.now()}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Attendance CSV' });
      } else {
        await Share.share({ title: 'Attendance Report', message: csv });
      }
    } catch (err) {
      Alert.alert('Export Failed', err.message || 'Could not export CSV report.');
    } finally {
      setExporting(false);
    }
  };

  const openStudentHistory = async (student) => {
    if (!selectedClass?.classroomId) return;
    setHistoryStudent(student);
    setHistoryVisible(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistoryRows(await getStudentLectureHistory(student.studentId, selectedClass.classroomId));
    } catch (err) {
      setHistoryRows([]);
      setHistoryError(err.message || 'Could not load lecture history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleStudentLecture = async (lecture) => {
    if (!historyStudent || !selectedClass?.classroomId || !uid || updatingLectureId) return;
    const currentlyPresent = lecture.attendance?.status === ATTENDANCE_STATUS.PRESENT;
    const nextStatus = currentlyPresent ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PRESENT;

    setUpdatingLectureId(lecture.sessionId);
    try {
      const updatedRecord = await setStudentSessionAttendance({
        teacherId: uid,
        classroomId: selectedClass.classroomId,
        sessionId: lecture.sessionId,
        studentId: historyStudent.studentId,
        status: nextStatus,
      });

      setHistoryRows((prev) =>
        prev.map((row) =>
          row.sessionId === lecture.sessionId
            ? { ...row, attendance: updatedRecord }
            : row
        )
      );

      // Refresh main report totals cleanly in background
      const refreshedReport = await getClassroomAttendanceReport(selectedClass.classroomId, uid);
      setStudentRows(refreshedReport || []);
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update attendance record.');
    } finally {
      setUpdatingLectureId(null);
    }
  };

  const totalStudents = studentRows.length;
  const completedLectures = studentRows[0]?.total || 0;
  const presentCount = studentRows.reduce((sum, student) => sum + student.present, 0);
  const percentage = calculateAttendancePercentage(presentCount, totalStudents * completedLectures);

  if (loading) {
    return <LoadingScreen message="Loading attendance reports..." iconName="chart-box-outline" />;
  }

  if (error) {
    return <ErrorScreen title="Report Unavailable" message={error} onRetry={loadData} />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <FadeInView>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              style={[styles.select, { borderColor: colors.border, backgroundColor: colors.surface }]}
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
                setLoading(true);
                try {
                  setError(null);
                  setStudentRows(await getClassroomAttendanceReport(cls.classroomId, uid));
                } catch (loadError) {
                  setError(loadError.message || 'Failed to load classroom report');
                } finally {
                  setLoading(false);
                }
              }}
            />
          ))}
        </Menu>

        <Card style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content>
            <View style={styles.cardHeader}>
              <IconBadge name="chart-box-outline" size={20} boxSize={38} borderRadius={12} />
              <Text variant="titleMedium" style={{ color: colors.text, fontWeight: '700' }}>
                Attendance Overview
              </Text>
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={styles.statBox}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total Enrolled</Text>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{totalStudents}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Lectures</Text>
                <Text style={{ color: THEME_COLORS.success, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{completedLectures}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Overall Rate</Text>
                <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{percentage}%</Text>
              </View>
            </View>

            <View style={styles.actionBtns}>
              <Button
                mode="contained"
                icon="file-download"
                onPress={handleExportCSV}
                loading={exporting}
                disabled={exporting || !selectedClass}
                buttonColor={colors.primary}
                textColor="#FFFFFF"
                style={{ flex: 1, borderRadius: 10 }}
              >
                Export CSV
              </Button>
              {selectedClass && (
                <Button
                  mode="outlined"
                  icon="account-group"
                  textColor={colors.primary}
                  style={{ borderColor: colors.primary, borderRadius: 10 }}
                  onPress={() =>
                    router.push({
                      pathname: '/(teacher)/classroom-students',
                      params: { classroomId: selectedClass.classroomId },
                    })
                  }
                >
                  Roll Nos
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>

        <View style={styles.tableHeadingRow}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
            Student Attendance (Tap row to edit)
          </Text>
        </View>

        <DataTable style={[styles.dataTable, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DataTable.Header style={{ borderBottomColor: colors.border }}>
            <DataTable.Title textStyle={{ color: colors.text, fontWeight: '700' }}>Roll</DataTable.Title>
            <DataTable.Title style={{ flex: 2 }} textStyle={{ color: colors.text, fontWeight: '700' }}>Student</DataTable.Title>
            <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>P</DataTable.Title>
            <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>A</DataTable.Title>
            <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>%</DataTable.Title>
          </DataTable.Header>

          {studentRows.length === 0 ? (
            <DataTable.Row style={{ borderBottomWidth: 0 }}>
              <DataTable.Cell style={{ justifyContent: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 12 }}>
                  No students are enrolled in this classroom.
                </Text>
              </DataTable.Cell>
            </DataTable.Row>
          ) : (
            studentRows.map((student) => (
              <DataTable.Row
                key={student.studentId}
                onPress={() => openStudentHistory(student)}
                style={{ borderBottomColor: colors.border }}
              >
                <DataTable.Cell textStyle={{ color: colors.textSecondary, fontWeight: '600' }}>
                  {student.rollNumber || ''}
                </DataTable.Cell>
                <DataTable.Cell style={{ flex: 2 }} textStyle={{ color: colors.text, fontWeight: '600' }}>
                  {student.name}
                </DataTable.Cell>
                <DataTable.Cell numeric textStyle={{ color: THEME_COLORS.success, fontWeight: '700' }}>
                  {student.present}
                </DataTable.Cell>
                <DataTable.Cell numeric textStyle={{ color: colors.textSecondary }}>
                  {student.absent}
                </DataTable.Cell>
                <DataTable.Cell numeric textStyle={{ color: colors.primary, fontWeight: '700' }}>
                  {calculateAttendancePercentage(student.present, student.total)}%
                </DataTable.Cell>
              </DataTable.Row>
            ))
          )}
        </DataTable>
      </FadeInView>

      <Portal>
        <Dialog visible={historyVisible} onDismiss={() => setHistoryVisible(false)} style={{ maxHeight: '84%' }}>
          <Dialog.Title>
            {historyStudent?.rollNumber ? `${historyStudent.rollNumber} · ` : ''}
            {historyStudent?.name || 'Student'}
          </Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              {historyLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
              ) : historyError ? (
                <Text style={{ color: THEME_COLORS.danger, paddingVertical: 16 }}>{historyError}</Text>
              ) : historyRows.length === 0 ? (
                <Text style={{ color: colors.textSecondary, paddingVertical: 16 }}>No completed lectures.</Text>
              ) : (
                historyRows.map((lecture) => {
                  const present = lecture.attendance?.status === ATTENDANCE_STATUS.PRESENT;
                  const isBusy = updatingLectureId === lecture.sessionId;
                  return (
                    <View
                      key={lecture.sessionId}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>
                          {lecture.subject || selectedClass?.className}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          {formatDate(lecture.startTime)} · {formatTime(lecture.startTime)} - {formatTime(lecture.endTime)}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <MaterialCommunityIcons
                            name={present ? 'check-circle' : 'close-circle'}
                            size={15}
                            color={present ? THEME_COLORS.success : THEME_COLORS.danger}
                          />
                          <Text style={{ color: present ? THEME_COLORS.success : THEME_COLORS.danger, fontWeight: '700', fontSize: 12 }}>
                            {present
                              ? lecture.attendance?.markedBy === 'teacher'
                                ? 'Present (Teacher)'
                                : 'Present'
                              : 'Absent'}
                          </Text>
                        </View>
                        {lecture.attendance?.time && present ? (
                          <Text style={{ color: colors.textTertiary, fontSize: 10.5 }}>
                            {formatDateTime(lecture.attendance.time)}
                          </Text>
                        ) : null}
                      </View>

                      <Button
                        mode={present ? 'outlined' : 'contained'}
                        compact
                        loading={isBusy}
                        disabled={Boolean(updatingLectureId)}
                        buttonColor={present ? undefined : THEME_COLORS.success}
                        textColor={present ? THEME_COLORS.danger : '#FFFFFF'}
                        style={{
                          borderRadius: 10,
                          borderColor: present ? THEME_COLORS.danger : THEME_COLORS.success,
                        }}
                        onPress={() => handleToggleStudentLecture(lecture)}
                      >
                        {present ? 'Set Absent' : 'Mark Present'}
                      </Button>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setHistoryVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  select: { marginBottom: 14, borderRadius: 12 },
  summary: { marginBottom: 16, borderRadius: 18, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  statBox: { alignItems: 'center' },
  actionBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  tableHeadingRow: { marginBottom: 10 },
  dataTable: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
});
