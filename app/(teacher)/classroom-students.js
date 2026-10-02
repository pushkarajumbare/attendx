import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Card, Button, Searchbar, Chip, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getClassroomStudents, getTeacherClassrooms } from '../../src/services/classroomService';
import { getAttendanceStats } from '../../src/services/attendanceService';
import { THEME_COLORS } from '../../src/constants';

export default function ClassroomStudentsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { classroomId, className: paramClassName } = useLocalSearchParams();
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
      const classes = await getTeacherClassrooms(uid);
      const targetClass = classes?.find((c) => c.classroomId === classroomId);

      if (targetClass) {
        setClassroom(targetClass);
        const roster = await getClassroomStudents(classroomId);
        setStudents(roster || []);

        const detailsMap = {};
        for (const student of roster || []) {
          try {
            const stats = await getAttendanceStats(student.studentId, classroomId);
            detailsMap[student.studentId] = stats;
          } catch (err) {
            detailsMap[student.studentId] = { present: 0, total: 0 };
          }
        }
        setStudentDetails(detailsMap);
      } else {
        setError('Classroom not found');
      }
    } catch (err) {
      console.log('Load classroom students error:', err);
      setError(err.message || 'Failed to load student roster');
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
      (s.studentId && s.studentId.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading student roster...</Text>
      </View>
    );
  }

  if (error || !classroom) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={THEME_COLORS.danger} />
        <Text variant="titleMedium" style={{ color: THEME_COLORS.danger, fontWeight: '700', marginTop: 8 }}>
          {error || 'Classroom not found'}
        </Text>
        <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      contentContainerStyle={styles.scroll}
    >
      <Card style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <Text variant="headlineSmall" style={{ fontWeight: '800', color: colors.text }}>
            {classroom.className}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{classroom.subject || 'General'}</Text>
          <Chip icon="account-group" style={styles.chip} textStyle={{ fontSize: 12 }}>
            {students.length} Enrolled Students
          </Chip>
        </Card.Content>
      </Card>

      <Searchbar
        placeholder="Search by student name or email..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
        inputStyle={{ color: colors.text }}
        iconColor={colors.textSecondary}
      />

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12, color: colors.text }}>
        Class Roster ({filteredStudents.length})
      </Text>

      {filteredStudents.length === 0 ? (
        <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
            <MaterialCommunityIcons name="account-search-outline" size={40} color={colors.textSecondary} />
            <Text style={{ fontWeight: '700', marginTop: 8, color: colors.text }}>No Students Found</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              Students can enroll using classroom code: {classroom.classroomCode}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        filteredStudents.map((student, index) => {
          const stats = studentDetails[student.studentId] || { present: 0, total: 0 };
          const percentage = calculatePercentage(stats);
          const attendanceColor = getAttendanceColor(percentage);

          return (
            <Card
              key={student.studentId}
              style={[styles.studentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              mode="outlined"
            >
              <Card.Content style={styles.studentContent}>
                <View style={styles.studentRow}>
                  <View style={styles.studentInfo}>
                    <View style={[styles.numberBadge, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}>
                      <Text style={[styles.numberText, { color: colors.primary }]}>{index + 1}</Text>
                    </View>
                    <Avatar.Text
                      size={40}
                      label={(student.name || 'Student').slice(0, 2).toUpperCase()}
                      style={{ backgroundColor: colors.primary }}
                    />
                    <View style={styles.studentMeta}>
                      <Text variant="titleSmall" style={{ fontWeight: '700', color: colors.text }}>
                        {student.name || 'Student'}
                      </Text>
                      <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                        {student.email || student.studentId}
                      </Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 30 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  headerCard: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  chip: { alignSelf: 'flex-start', marginTop: 8 },
  search: { marginBottom: 16, borderRadius: 12, borderWidth: 1 },
  emptyCard: { borderRadius: 14, borderWidth: 1 },
  studentCard: { marginBottom: 12, borderRadius: 14, borderWidth: 1 },
  studentContent: { paddingVertical: 12, paddingHorizontal: 14 },
  studentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  studentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  numberBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numberText: { fontWeight: '700', fontSize: 12 },
  studentMeta: { marginLeft: 10, flex: 1 },
  attendanceBox: { alignItems: 'flex-end', marginLeft: 10 },
  progressContainer: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 2 },
});
