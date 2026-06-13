import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Button, Card, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getAttendanceByClassroom } from '../../src/services/attendanceService';
import { StatCard } from '../../src/components/StatCard';
import { EmptyState } from '../../src/components/EmptyState';
import { getTodayKey } from '../../src/utils/helpers';
import { COLORS } from '../../src/constants';

export default function TeacherDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [todayPresent, setTodayPresent] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const uid = profile?.uid;

  const loadData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const classes = await getTeacherClassrooms(uid);
      setClassrooms(classes || []);

      let present = 0;
      for (const cls of classes || []) {
        try {
          const records = await getAttendanceByClassroom(cls.classroomId, getTodayKey());
          present += records?.length || 0;
        } catch (err) {
          console.log('Attendance fetch error:', err);
        }
      }
      setTodayPresent(present);
    } catch (err) {
      console.log('Dashboard error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
    setRefreshing(false);
  }, [loadData]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="titleMedium" style={styles.errorText}>Something went wrong</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <Button mode="contained" onPress={loadData} style={styles.retryBtn}>
          Retry
        </Button>
      </View>
    );
  }

  // Not logged in
  if (!uid) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="titleMedium">Please log in</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.scroll}
    >
      <Text variant="headlineSmall" style={styles.greeting}>
        Welcome, {profile?.name?.split(' ')[0] || 'Teacher'}
      </Text>

      <View style={styles.statsRow}>
        <StatCard title="Classrooms" value={classrooms.length} icon="google-classroom" />
        <StatCard title="Present Today" value={todayPresent} icon="account-check" color={COLORS.success} />
      </View>

      <View style={styles.actions}>
        <Button mode="contained" icon="plus" onPress={() => router.push('/(teacher)/create-classroom')}>
          Create Classroom
        </Button>
        <Button mode="outlined" icon="calendar-clock" onPress={() => router.push('/(teacher)/attendance-session')}>
          Start Attendance
        </Button>
      </View>

      <Text variant="titleMedium" style={styles.section}>Quick Access</Text>
      <View style={styles.quickRow}>
        <Button mode="outlined" compact onPress={() => router.push('/(teacher)/notes')}>Notes</Button>
        <Button mode="outlined" compact onPress={() => router.push('/(teacher)/assignments')}>Assignments</Button>
        <Button mode="outlined" compact onPress={() => router.push('/(teacher)/question-bank')}>Q. Bank</Button>
        <Button mode="outlined" compact onPress={() => router.push('/(teacher)/announcements')}>Announce</Button>
      </View>

      <Text variant="titleMedium" style={styles.section}>Your Classrooms</Text>
      
      {classrooms && classrooms.length > 0 ? (
        classrooms.map((cls) => (
          <Card key={cls.classroomId} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{cls.className}</Text>
              <Text style={styles.subject}>{cls.subject}</Text>
              <Chip icon="key" style={styles.chip}>Code: {cls.classroomCode}</Chip>
              <Text style={styles.students}>{cls.studentIds?.length || 0} students enrolled</Text>
            </Card.Content>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.emptyTitle}>No Classrooms</Text>
            <Text style={styles.emptyText}>Create your first classroom to get started</Text>
            <Button mode="contained" onPress={() => router.push('/(teacher)/create-classroom')} style={styles.emptyBtn}>
              Create Classroom
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, fontWeight: '600' },
  errorSubtext: { marginTop: 8, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: 16 },
  greeting: { fontWeight: '700', marginBottom: 16 },
  statsRow: { flexDirection: 'row', marginHorizontal: -6 },
  actions: { gap: 8, marginVertical: 16 },
  section: { fontWeight: '600', marginBottom: 12, marginTop: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  card: { marginBottom: 12, borderRadius: 12 },
  emptyCard: { marginBottom: 12, borderRadius: 12, borderColor: COLORS.border, borderWidth: 1 },
  emptyTitle: { textAlign: 'center', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginVertical: 8 },
  emptyBtn: { marginTop: 12 },
  subject: { color: COLORS.textSecondary },
  chip: { alignSelf: 'flex-start', marginTop: 8 },
  students: { marginTop: 8, color: COLORS.textSecondary },
});
