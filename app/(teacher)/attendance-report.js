import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Menu, Button, DataTable } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getAttendanceByClassroom } from '../../src/services/attendanceService';
import { getTodayKey, calculateAttendancePercentage } from '../../src/utils/helpers';
import { COLORS } from '../../src/constants';

export default function AttendanceReportScreen() {
  const { profile } = useAuth();

  const uid = profile?.uid; // 🔥 SAFE FIX

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [records, setRecords] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  const load = async () => {
    if (!uid) return; // 🔥 CRASH FIX

    try {
      const classes = await getTeacherClassrooms(uid);

      setClassrooms(classes || []);

      if (classes?.length > 0) {
        const cls = classes[0];

        setSelectedClass(cls);

        const data = await getAttendanceByClassroom(
          cls.classroomId,
          getTodayKey()
        );

        setRecords(data || []);
      }
    } catch (error) {
      console.log('Load error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [uid])
  );

  const totalStudents = selectedClass?.studentIds?.length || 0;
  const presentCount = records.filter((r) => r.status === 'present').length;

  const percentage = calculateAttendancePercentage(presentCount, totalStudents);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.select}>
            {selectedClass ? selectedClass.className : 'Select Classroom'}
          </Button>
        }
      >
        {classrooms.map((cls) => (
          <Menu.Item
            key={cls.classroomId}
            title={cls.className}
            onPress={async () => {
              setSelectedClass(cls);
              setMenuVisible(false);

              const data = await getAttendanceByClassroom(
                cls.classroomId,
                getTodayKey()
              );

              setRecords(data || []);
            }}
          />
        ))}
      </Menu>

      <Card style={styles.summary}>
        <Card.Content>
          <Text variant="titleMedium">Today's Summary</Text>

          <Text style={styles.stat}>
            Present: {presentCount} / {totalStudents}
          </Text>

          <Text style={styles.stat}>
            Attendance: {percentage}%
          </Text>
        </Card.Content>
      </Card>

      <DataTable>
        <DataTable.Header>
          <DataTable.Title>Student</DataTable.Title>
          <DataTable.Title numeric>Distance</DataTable.Title>
          <DataTable.Title numeric>Face</DataTable.Title>
        </DataTable.Header>

        {records.map((record) => (
          <DataTable.Row key={record.attendanceId}>
            <DataTable.Cell>
              {record.studentId?.slice(0, 8) || 'Unknown'}...
            </DataTable.Cell>

            <DataTable.Cell numeric>
              {record.distanceMeters || 0}m
            </DataTable.Cell>

            <DataTable.Cell numeric>
              {record.faceConfidence || 0}%
            </DataTable.Cell>
          </DataTable.Row>
        ))}
      </DataTable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  select: { marginBottom: 16 },
  summary: { marginBottom: 16, borderRadius: 12 },
  stat: { marginTop: 8, color: COLORS.textSecondary },
});