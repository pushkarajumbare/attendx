import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Chip,
  FAB,
} from 'react-native-paper';
import {
  useRouter,
  useFocusEffect,
} from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

import {
  getStudentClassrooms,
} from '../../src/services/classroomService';

import {
  getAttendanceStats,
} from '../../src/services/attendanceService';

import { StatCard } from '../../src/components/StatCard';
import { EmptyState } from '../../src/components/EmptyState';
import { calculateAttendancePercentage } from '../../src/utils/helpers';
import { COLORS } from '../../src/constants';

export default function StudentDashboard() {
  const router = useRouter();
  const { profile } = useAuth();

  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);

  const [stats, setStats] = useState({
    present: 0,
    total: 0,
    percentage: 0,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =========================
  // SAFE DATA LOADER
  // =========================
  const loadData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const classes = await getStudentClassrooms(uid);
      setClassrooms(classes || []);

      let totalPresent = 0;
      let totalSessions = 0;

      const safeClasses = classes || [];

      for (const cls of safeClasses) {
        try {
          const s = await getAttendanceStats(uid, cls.classroomId);

          totalPresent += s?.present || 0;
          totalSessions += s?.total || 0;
        } catch (error) {
          console.log('Attendance stats error:', error);
        }
      }

      setStats({
        present: totalPresent,
        total: totalSessions,
        percentage: calculateAttendancePercentage(
          totalPresent,
          totalSessions
        ),
      });
    } catch (error) {
      console.log('Dashboard load error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // =========================
  // FOCUS EFFECT
  // =========================
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
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
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
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        <Text variant="headlineSmall" style={styles.greeting}>
          Hello, {profile?.name?.split(' ')[0] || 'Student'}
        </Text>

        <Text style={styles.subtitle}>
          Your attendance overview
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            title="Attendance %"
            value={`${stats.percentage}%`}
            icon="percent"
          />

          <StatCard
            title="Present"
            value={stats.present}
            icon="check-circle"
            color={COLORS.success}
          />
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="qrcode"
            onPress={() => router.push('/(student)/join-class')}
          >
            Join Classroom
          </Button>

          <Button
            mode="outlined"
            icon="bell"
            onPress={() => router.push('/(student)/notifications')}
          >
            Notifications
          </Button>
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          My Classrooms
        </Text>

        {classrooms && classrooms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.emptyTitle}>No classrooms yet</Text>
              <Text style={styles.emptyText}>Join a classroom using the code shared by your teacher</Text>
              <Button mode="contained" onPress={() => router.push('/(student)/join-class')} style={styles.emptyBtn}>
                Join Classroom
              </Button>
            </Card.Content>
          </Card>
        ) : (
          classrooms.map((cls) => (
            <Card key={cls.classroomId} style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">{cls.className}</Text>

                <Text style={styles.subject}>{cls.subject}</Text>

                <Chip style={styles.chip}>
                  {cls.classroomCode}
                </Chip>
              </Card.Content>

              <Card.Actions>
                <Button onPress={() => router.push('/(student)/attendance')}>
                  Mark Attendance
                </Button>

                <Button onPress={() => router.push('/(student)/question-bank')}>
                  Question Bank
                </Button>
              </Card.Actions>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="camera"
        style={styles.fab}
        label="Mark Attendance"
        onPress={() => router.push('/(student)/attendance')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.background 
  },
  loadingText: { 
    marginTop: 12, 
    color: COLORS.textSecondary 
  },
  errorText: { 
    color: COLORS.danger, 
    fontWeight: '600' 
  },
  errorSubtext: { 
    marginTop: 8, 
    color: COLORS.textSecondary, 
    textAlign: 'center' 
  },
  retryBtn: { 
    marginTop: 16 
  },
  greeting: {
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  actions: {
    gap: 8,
    marginVertical: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  emptyCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  emptyTitle: { 
    textAlign: 'center', 
    fontWeight: '600' 
  },
  emptyText: { 
    textAlign: 'center', 
    color: COLORS.textSecondary, 
    marginVertical: 8 
  },
  emptyBtn: { 
    marginTop: 12 
  },
  subject: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: COLORS.primary,
  },
});