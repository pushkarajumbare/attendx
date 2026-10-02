import { useState, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View, Alert, Share, RefreshControl } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Text, Card, Menu, Button, DataTable, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getClassroomAttendanceReport, getClassroomAttendanceExportData, getStudentLectureHistory } from '../../src/services/attendanceService';
import { calculateAttendancePercentage, exportAttendanceToCSV, formatDate, formatTime, formatDateTime } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function AttendanceReportScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentRows, setStudentRows] = useState([]);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
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
        const cls = safeClasses.find((item) => item.classroomId === selectedClassRef.current?.classroomId) || safeClasses[0];
        setSelectedClass(cls);
        const report = await getClassroomAttendanceReport(cls.classroomId, uid);
        setStudentRows(report || []);
      } else {
        setSelectedClass(null);
        setStudentRows([]);
      }
    } catch (error) {
      console.log('Attendance report load error:', error);
      setError(error.message || 'Failed to load attendance report');
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
    } catch (error) {
      setHistoryRows([]);
      setHistoryError(error.message || 'Could not load lecture history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalStudents = studentRows.length;
  const completedLectures = studentRows[0]?.total || 0;
  const presentCount = studentRows.reduce((sum, student) => sum + student.present, 0);
  const percentage = calculateAttendancePercentage(presentCount, totalStudents * completedLectures);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{error}</Text>
        <Button mode="contained" onPress={loadData} buttonColor={colors.primary} style={{ marginTop: 12 }}>Retry</Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
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
            <MaterialCommunityIcons name="chart-box-outline" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={{ color: colors.text, fontWeight: '700' }}>
              Completed Attendance Overview
            </Text>
          </View>

          <View style={styles.summaryStatsRow}>
            <View style={styles.statBox}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total Enrolled</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{totalStudents}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Completed Lectures</Text>
              <Text style={{ color: THEME_COLORS.success, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{completedLectures}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Attendance Rate</Text>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{percentage}%</Text>
            </View>
          </View>

          <Button
            mode="contained"
            icon="file-download"
            onPress={handleExportCSV}
            loading={exporting}
            disabled={exporting || !selectedClass}
            buttonColor={colors.primary}
            style={{ borderRadius: 10, marginTop: 4 }}
          >
            Export Attendance Report (CSV)
          </Button>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 10, color: colors.text }}>
        Student Attendance
      </Text>

      <DataTable style={[styles.dataTable, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DataTable.Header style={{ borderBottomColor: colors.border }}>
          <DataTable.Title textStyle={{ color: colors.text, fontWeight: '700' }}>Student</DataTable.Title>
          <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>Present</DataTable.Title>
          <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>Absent</DataTable.Title>
          <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>Total</DataTable.Title>
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
            <DataTable.Row key={student.studentId} onPress={() => openStudentHistory(student)} style={{ borderBottomColor: colors.border }}>
              <DataTable.Cell textStyle={{ color: colors.text, fontWeight: '600' }}>
                {student.name}{student.rollNumber ? ` (${student.rollNumber})` : ''}
              </DataTable.Cell>
              <DataTable.Cell numeric textStyle={{ color: colors.textSecondary }}>{student.present}</DataTable.Cell>
              <DataTable.Cell numeric textStyle={{ color: colors.textSecondary }}>{student.absent}</DataTable.Cell>
              <DataTable.Cell numeric textStyle={{ color: colors.textSecondary }}>{student.total}</DataTable.Cell>
              <DataTable.Cell numeric textStyle={{ color: colors.primary, fontWeight: '700' }}>
                {calculateAttendancePercentage(student.present, student.total)}%
              </DataTable.Cell>
            </DataTable.Row>
          ))
        )}
      </DataTable>

      <Portal>
        <Dialog visible={historyVisible} onDismiss={() => setHistoryVisible(false)} style={{ maxHeight: '82%' }}>
          <Dialog.Title>{historyStudent?.name || 'Student'} Lecture History</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              {historyLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : historyError ? (
                <Text style={{ color: THEME_COLORS.danger, paddingVertical: 16 }}>{historyError}</Text>
              ) : historyRows.length === 0 ? (
                <Text style={{ color: colors.textSecondary, paddingVertical: 16 }}>No completed lectures.</Text>
              ) : historyRows.map((lecture) => {
                const present = lecture.attendance?.status === 'present';
                return (
                  <View key={lecture.sessionId} style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{lecture.subject || selectedClass?.className}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Date: {formatDate(lecture.startTime)} · Start: {formatTime(lecture.startTime)} · End: {formatTime(lecture.endTime)}
                    </Text>
                    <Text style={{ color: present ? THEME_COLORS.success : THEME_COLORS.danger, fontWeight: '700', marginTop: 3 }}>
                      {present ? '✓ Present' : '✗ Absent'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Marked time: {lecture.attendance?.time ? formatDateTime(lecture.attendance.time) : 'N/A'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions><Button onPress={() => setHistoryVisible(false)}>Close</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 40 },
  select: { marginBottom: 14, borderRadius: 10 },
  summary: { marginBottom: 16, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statBox: { alignItems: 'center' },
  dataTable: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
});