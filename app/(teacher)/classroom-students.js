import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Card, Button, Searchbar, Chip, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import {
  getClassroomByCode,
  getStudentClassrooms,
} from '../../src/services/classroomService';
import { getAttendanceStats } from '../../src/services/attendanceService';
import { COLORS } from '../../src/constants';

export default function ClassroomStudentsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { classroomId } = useLocalSearchParams();

  const uid = profile?.uid;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentDetails, setStudentDetails] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const loadClassroomData = useCallback(async () => {
    if (!uid || !classroomId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Get classroom from Firestore
      const classroomDoc = await getClassroomByCode(classroomId);
      if (classroomDoc) {
        setClassroom(classroomDoc);
        
        // Load attendance stats for each student
        const detailsMap = {};
        if (classroomDoc.studentIds && classroomDoc.studentIds.length > 0) {
          for (const studentId of classroomDoc.studentIds) {
            try {
              const stats = await getAttendanceStats(studentId, classroomDoc.classroomId);
              detailsMap[studentId] = stats;
            } catch (err) {
              console.log('Stats error for student:', studentId, err);
              detailsMap[studentId] = { present: 0, total: 0 };
            }
          }
        }
        setStudentDetails(detailsMap);
      } else {
        setError('Classroom not found');
      }
    } catch (err) {
      console.log('Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, classroomId]);

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

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  const calculatePercentage = (stats) => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.present / stats.total) * 100);
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 80) return COLORS.success;
    if (percentage >= 60) return COLORS.warning;
    return COLORS.danger;
  };

  const filteredStudents = classroom?.studentIds?.filter((studentId) => {
    if (!searchQuery?.trim()) return true;
    // Simple filter - in production, would need student names from database
    return studentId?.toLowerCase()?.includes(searchQuery?.toLowerCase() ?? '');
  }) || [];

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading students...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="titleMedium" style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={loadClassroomData} style={styles.retryBtn}>
          Retry
        </Button>
      </View>
    );
  }

  // No classroom
  if (!classroom) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="titleMedium">Classroom not found</Text>
        <Button mode="outlined" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.scroll}
    >
      {/* CLASSROOM HEADER */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="headlineSmall">{classroom.className}</Text>
          <Text style={styles.subject}>{classroom.subject}</Text>
          <Chip icon="account-multiple" style={styles.chip}>
            {classroom.studentIds?.length || 0} Students
          </Chip>
        </Card.Content>
      </Card>

      {/* SEARCH */}
      <Searchbar
        placeholder="Search students..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.search}
      />

      {/* STUDENTS LIST */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Class Roster
      </Text>

      {filteredStudents.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No students yet
            </Text>
            <Text style={styles.emptyText}>
              Students can join using the classroom code
            </Text>
          </Card.Content>
        </Card>
      ) : (
        filteredStudents.map((studentId, index) => {
          const stats = studentDetails[studentId] || { present: 0, total: 0 };
          const percentage = calculatePercentage(stats);
          const attendanceColor = getAttendanceColor(percentage);

          return (
            <Card key={studentId} style={styles.studentCard}>
              <Card.Content style={styles.studentContent}>
                <View style={styles.studentRow}>
                  {/* AVATAR + NUMBER */}
                  <View style={styles.studentInfo}>
                    <View style={styles.numberBadge}>
                      <Text style={styles.numberText}>{index + 1}</Text>
                    </View>
                    <Avatar.Text
                      size={40}
                      label={studentId.slice(0, 2).toUpperCase()}
                      style={{ backgroundColor: COLORS.primary }}
                    />
                    <View style={styles.studentMeta}>
                      <Text variant="titleSmall" style={styles.studentId}>
                        {studentId}
                      </Text>
                      <Text variant="bodySmall" style={styles.statsText}>
                        {stats.present} / {stats.total} attended
                      </Text>
                    </View>
                  </View>

                  {/* ATTENDANCE PERCENTAGE */}
                  <View style={styles.attendanceBox}>
                    <Text
                      variant="headlineSmall"
                      style={[styles.percentage, { color: attendanceColor }]}
                    >
                      {percentage}%
                    </Text>
                    <Text style={styles.percentageLabel}>Attendance</Text>
                  </View>
                </View>

                {/* PROGRESS BAR */}
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: attendanceColor,
                      },
                    ]}
                  />
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      {/* ACTION BUTTONS */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.actionBtn}
        >
          Back
        </Button>
        <Button
          mode="contained"
          onPress={() => router.push(`/(teacher)/attendance-session`)}
          style={styles.actionBtn}
        >
          Start Session
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 24 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 16 },
  headerCard: { marginBottom: 16, borderRadius: 12 },
  subject: { color: COLORS.textSecondary, marginTop: 4 },
  chip: { alignSelf: 'flex-start', marginTop: 8 },
  search: { marginBottom: 16 },
  sectionTitle: { fontWeight: '600', marginBottom: 12, marginTop: 8 },
  emptyCard: { marginBottom: 16, borderRadius: 12 },
  emptyTitle: { textAlign: 'center', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 8 },
  studentCard: { marginBottom: 12, borderRadius: 12 },
  studentContent: { paddingVertical: 12, paddingHorizontal: 16 },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: { fontWeight: '700', color: COLORS.primary, fontSize: 12 },
  studentMeta: { marginLeft: 12, flex: 1 },
  studentId: { fontWeight: '600', marginBottom: 2 },
  statsText: { color: COLORS.textSecondary },
  attendanceBox: { alignItems: 'center', marginLeft: 12 },
  percentage: { fontWeight: '700' },
  percentageLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  progressContainer: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 2 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionBtn: { flex: 1 },
});
