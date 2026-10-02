import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, Alert, Share } from 'react-native';
import { Text, Card, Menu, Button, DataTable } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms, getClassroomStudents } from '../../src/services/classroomService';
import { getAttendanceByClassroom } from '../../src/services/attendanceService';
import { getTodayKey, calculateAttendancePercentage, exportAttendanceToCSV } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function AttendanceReportScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [records, setRecords] = useState([]);
  const [studentNamesMap, setStudentNamesMap] = useState({});
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

        const data = await getAttendanceByClassroom(cls.classroomId, getTodayKey());
        setRecords(data || []);

        const roster = await getClassroomStudents(cls.classroomId);
        const map = {};
        for (const s of roster || []) {
          map[s.studentId] = s.name || 'Student';
        }
        setStudentNamesMap(map);
      }
    } catch (error) {
      console.log('Attendance report load error:', error);
    }
  }, [uid, selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleExportCSV = async () => {
    try {
      if (!records || records.length === 0) {
        Alert.alert('Export Notice', 'No attendance records available for export today.');
        return;
      }

      const csv = exportAttendanceToCSV(records, selectedClass?.className);
      await Share.share({
        title: `Attendance Report - ${selectedClass?.className || 'Classroom'}`,
        message: csv,
      });
    } catch (err) {
      Alert.alert('Export Failed', err.message || 'Could not export CSV report.');
    }
  };

  const totalStudents = selectedClass?.studentIds?.length || 0;
  const presentCount = records.filter((r) => r.status === 'present').length;
  const percentage = calculateAttendancePercentage(presentCount, totalStudents);

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
              const data = await getAttendanceByClassroom(cls.classroomId, getTodayKey());
              setRecords(data || []);
            }}
          />
        ))}
      </Menu>

      <Card style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="chart-box-outline" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={{ color: colors.text, fontWeight: '700' }}>
              Today's Attendance Overview
            </Text>
          </View>

          <View style={styles.summaryStatsRow}>
            <View style={styles.statBox}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total Enrolled</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{totalStudents}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Present Today</Text>
              <Text style={{ color: THEME_COLORS.success, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{presentCount}</Text>
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
            buttonColor={colors.primary}
            style={{ borderRadius: 10, marginTop: 4 }}
          >
            Export Attendance Report (CSV)
          </Button>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 10, color: colors.text }}>
        Verification Log
      </Text>

      <DataTable style={[styles.dataTable, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DataTable.Header style={{ borderBottomColor: colors.border }}>
          <DataTable.Title textStyle={{ color: colors.text, fontWeight: '700' }}>Student</DataTable.Title>
          <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>Distance</DataTable.Title>
          <DataTable.Title numeric textStyle={{ color: colors.text, fontWeight: '700' }}>Biometric</DataTable.Title>
        </DataTable.Header>

        {records.length === 0 ? (
          <DataTable.Row style={{ borderBottomWidth: 0 }}>
            <DataTable.Cell style={{ justifyContent: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 12 }}>
                No attendance records for today
              </Text>
            </DataTable.Cell>
          </DataTable.Row>
        ) : (
          records.map((record) => {
            const displayName = studentNamesMap[record.studentId] || record.studentId?.slice(0, 10) || 'Student';
            return (
              <DataTable.Row key={record.attendanceId} style={{ borderBottomColor: colors.border }}>
                <DataTable.Cell textStyle={{ color: colors.text, fontWeight: '600' }}>
                  {displayName}
                </DataTable.Cell>
                <DataTable.Cell numeric textStyle={{ color: colors.textSecondary }}>
                  {record.distanceMeters ? `${record.distanceMeters}m` : '0m'}
                </DataTable.Cell>
                <DataTable.Cell numeric textStyle={{ color: THEME_COLORS.success, fontWeight: '700' }}>
                  {record.faceConfidence ? `${record.faceConfidence}%` : '100%'}
                </DataTable.Cell>
              </DataTable.Row>
            );
          })
        )}
      </DataTable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  select: { marginBottom: 14, borderRadius: 10 },
  summary: { marginBottom: 16, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statBox: { alignItems: 'center' },
  dataTable: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
});