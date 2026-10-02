import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Chip, FAB } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import { getAttendanceStats, getActiveSession } from '../../src/services/attendanceService';
import { StatCard } from '../../src/components/StatCard';
import { calculateAttendancePercentage, toValidDate } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function StudentDashboard() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const classroomsRef = useRef([]);
  const sessionsRequestInFlight = useRef(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [stats, setStats] = useState({
    present: 0,
    total: 0,
    percentage: 0,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadActiveSessions = useCallback(async (classes) => {
    if (sessionsRequestInFlight.current) return;
    sessionsRequestInFlight.current = true;
    try {
      const sessions = await Promise.all((classes || []).map(async (classroom) => {
        try {
          const session = await getActiveSession(classroom.classroomId);
          return session ? { ...session, className: classroom.className } : null;
        } catch (sessionError) {
          console.log('Session status notice:', sessionError?.message);
          return null;
        }
      }));
      setActiveSessions(sessions.filter(Boolean));
    } finally {
      sessionsRequestInFlight.current = false;
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const classes = await getStudentClassrooms(uid);
      const safeClasses = classes || [];
      classroomsRef.current = safeClasses;
      setClassrooms(safeClasses);
      await loadActiveSessions(safeClasses);

      const statsByClass = await Promise.all(safeClasses.map(async (classroom) => {
        try {
          return await getAttendanceStats(uid, classroom.classroomId);
        } catch (statsError) {
          console.log('Attendance stats notice:', statsError?.message);
          return { present: 0, total: 0 };
        }
      }));
      const totalPresent = statsByClass.reduce((sum, statsItem) => sum + (statsItem?.present || 0), 0);
      const totalSessions = statsByClass.reduce((sum, statsItem) => sum + (statsItem?.total || 0), 0);

      setStats({
        present: totalPresent,
        total: totalSessions,
        percentage: calculateAttendancePercentage(totalPresent, totalSessions),
      });
    } catch (err) {
      console.log('Student dashboard load error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [uid, loadActiveSessions]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const refreshInterval = setInterval(() => loadActiveSessions(classroomsRef.current), 30000);
      return () => clearInterval(refreshInterval);
    }, [loadData, loadActiveSessions])
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading student dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={THEME_COLORS.danger} />
        <Text variant="titleMedium" style={[styles.errorText, { color: THEME_COLORS.danger }]}>Something went wrong</Text>
        <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</Text>
        <Button mode="contained" onPress={loadData} style={styles.retryBtn} buttonColor={colors.primary}>
          Retry
        </Button>
      </View>
    );
  }

  if (!uid) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text variant="titleMedium" style={{ color: colors.text }}>Please log in</Text>
      </View>
    );
  }

  const studentName = profile?.name ? profile.name.split(' ')[0] : 'Student';
  const isFaceRegistered = profile?.faceRegistered === true;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={styles.scroll}
      >
        {/* 1. WELCOME HEADER */}
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeTextGroup}>
            <Text variant="headlineSmall" style={[styles.greeting, { color: colors.text }]}>
              Hello, {studentName} 👋
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your attendance & classroom overview
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.profileBadge, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}
            onPress={() => router.push('/(student)/profile')}
          >
            <MaterialCommunityIcons name="account-school" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* 2. BIOMETRIC REGISTRATION CALLOUT IF NOT REGISTERED */}
        {!isFaceRegistered && (
          <Card style={[styles.alertCard, { backgroundColor: isDark ? '#2A1A10' : '#FFF7ED', borderColor: colors.primary }]} mode="outlined">
            <Card.Content style={styles.alertCardContent}>
              <MaterialCommunityIcons name="face-recognition" size={32} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.text }]}>Face Registration Required</Text>
                <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
                  Enroll your 5-stage biometric template to enable instant face attendance check-ins.
                </Text>
              </View>
              <Button
                mode="contained"
                buttonColor={colors.primary}
                compact
                onPress={() => router.push('/(student)/face-register')}
              >
                Register
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* 3. STATS CARDS */}
        <View style={styles.statsRow}>
          <StatCard
            title="Attendance"
            value={`${stats.percentage}%`}
            icon="percent"
            color={stats.percentage >= 75 ? THEME_COLORS.success : THEME_COLORS.warning}
          />
          <StatCard
            title="Present Sessions"
            value={`${stats.present} / ${stats.total}`}
            icon="check-circle"
            color={colors.primary}
          />
        </View>

        {activeSessions.length > 0 && (
          <View style={styles.activeSessionsSection}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text }]}>
              Attendance in Progress
            </Text>
            {activeSessions.map((session) => {
              const endTime = toValidDate(session.endTime);
              const remainingMs = endTime ? Math.max(0, endTime.getTime() - now) : 0;
              const hours = Math.floor(remainingMs / 3600000);
              const minutes = Math.floor((remainingMs % 3600000) / 60000);
              const seconds = Math.floor((remainingMs % 60000) / 1000);
              const remaining = hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

              return (
                <Card
                  key={session.sessionId}
                  style={[styles.activeSessionCard, { backgroundColor: isDark ? '#17352D' : '#ECFDF5', borderColor: THEME_COLORS.success }]}
                  mode="outlined"
                >
                  <Card.Content style={styles.activeSessionContent}>
                    <View style={styles.activeSessionInfo}>
                      <View style={styles.activeSessionHeading}>
                        <MaterialCommunityIcons
                          name={remainingMs > 0 ? 'broadcast' : 'broadcast-off'}
                          size={20}
                          color={remainingMs > 0 ? THEME_COLORS.success : colors.textSecondary}
                        />
                        <Text style={[styles.activeSessionStatus, { color: remainingMs > 0 ? THEME_COLORS.success : colors.textSecondary }]}>
                          {remainingMs > 0 ? 'ACTIVE' : 'ENDED'}
                        </Text>
                      </View>
                      <Text variant="titleMedium" style={[styles.className, { color: colors.text }]}>
                        {session.className}
                      </Text>
                      <Text style={{ color: colors.textSecondary }}>
                        {session.subject || 'Attendance session'} · {remainingMs > 0 ? `${remaining} remaining` : 'Session expired'}
                      </Text>
                    </View>
                    <Button
                      mode="contained"
                      compact
                      disabled={remainingMs <= 0}
                      buttonColor={THEME_COLORS.success}
                      textColor="#FFFFFF"
                      onPress={() => router.push({ pathname: '/(student)/attendance', params: { classroomId: session.classroomId } })}
                    >
                      {remainingMs > 0 ? 'Check In' : 'Expired'}
                    </Button>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}

        {/* 4. ACTIONS */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="plus"
            onPress={() => router.push('/(student)/join-class')}
            buttonColor={colors.primary}
            style={{ borderRadius: 12 }}
          >
            Join Classroom with Code
          </Button>
        </View>

        {/* 5. CLASSROOMS */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.text }]}>
          Enrolled Classrooms ({classrooms.length})
        </Text>

        {classrooms.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
              <MaterialCommunityIcons name="google-classroom" size={44} color={colors.primary} style={{ opacity: 0.8 }} />
              <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.text }]}>No Classrooms Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Ask your teacher for their 6-character classroom code and tap Join Classroom.
              </Text>
              <Button
                mode="contained"
                icon="plus"
                onPress={() => router.push('/(student)/join-class')}
                style={styles.emptyBtn}
                buttonColor={colors.primary}
              >
                Join Classroom
              </Button>
            </Card.Content>
          </Card>
        ) : (
          classrooms.map((cls) => (
            <Card
              key={cls.classroomId}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              mode="outlined"
            >
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={[styles.className, { color: colors.text }]}>
                      {cls.className}
                    </Text>
                    <Text style={[styles.subject, { color: colors.textSecondary }]}>
                      {cls.subject || 'General'}
                    </Text>
                  </View>
                  <Chip
                    style={{ backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }}
                    textStyle={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}
                  >
                    {cls.classroomCode}
                  </Chip>
                </View>
              </Card.Content>

              <Card.Actions style={styles.cardActions}>
                <Button
                  mode="text"
                  icon="file-document-outline"
                  textColor={colors.primary}
                  onPress={() => router.push('/(student)/notes')}
                >
                  Notes & Files
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="face-recognition"
                  buttonColor={isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight}
                  textColor={colors.primaryDark}
                  onPress={() => router.push('/(student)/attendance')}
                >
                  Mark Attendance
                </Button>
              </Card.Actions>
            </Card>
          ))
        )}
      </ScrollView>

      {/* FLOATING MARK ATTENDANCE BUTTON */}
      <FAB
        icon="camera"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        label="Scan Face"
        color="#FFFFFF"
        onPress={() => router.push('/(student)/attendance')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 110 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontWeight: '700', fontSize: 16, marginTop: 12 },
  errorSubtext: { marginTop: 6, textAlign: 'center', fontSize: 13, marginBottom: 14 },
  retryBtn: { borderRadius: 10 },

  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTextGroup: { flex: 1 },
  greeting: { fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  alertCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  alertDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  activeSessionsSection: { marginBottom: 16 },
  activeSessionCard: { borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  activeSessionContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeSessionInfo: { flex: 1, gap: 4 },
  activeSessionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeSessionStatus: { fontSize: 12, fontWeight: '800' },
  actions: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 17,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  className: { fontWeight: '700', fontSize: 16 },
  subject: { fontSize: 13, marginTop: 2 },
  cardActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyTitle: { fontWeight: '700', marginTop: 10 },
  emptyText: { textAlign: 'center', marginVertical: 8, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  emptyBtn: { marginTop: 10, borderRadius: 10 },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 16,
    elevation: 4,
  },
});