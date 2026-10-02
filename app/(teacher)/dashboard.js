import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, Card, Chip, IconButton } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getAttendanceByClassroom } from '../../src/services/attendanceService';
import { StatCard } from '../../src/components/StatCard';
import { getTodayKey } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function TeacherDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();

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
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      let present = 0;
      const todayKey = getTodayKey();
      for (const cls of safeClasses) {
        try {
          const records = await getAttendanceByClassroom(cls.classroomId, todayKey);
          present += records?.length || 0;
        } catch (err) {
          console.log('Attendance fetch notice:', err?.message);
        }
      }
      setTodayPresent(present);
    } catch (err) {
      console.log('Dashboard error:', err);
      setError(err.message || 'Failed to load teacher dashboard');
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

  const handleCopyCode = async (code, className) => {
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(code);
      }
      Alert.alert('Code Copied! 📋', `Classroom code "${code}" for ${className} copied to clipboard.`);
    } catch (_) {
      Alert.alert('Classroom Code', code);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading dashboard...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={THEME_COLORS.danger} />
        <Text variant="titleMedium" style={[styles.errorText, { color: THEME_COLORS.danger }]}>
          Unable to Load Dashboard
        </Text>
        <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</Text>
        <Button mode="contained" onPress={loadData} style={styles.retryBtn} buttonColor={colors.primary}>
          Retry
        </Button>
      </View>
    );
  }

  // Not logged in
  if (!uid) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text variant="titleMedium" style={{ color: colors.text }}>Please log in to continue</Text>
      </View>
    );
  }

  const teacherFirstName = profile?.name ? profile.name.split(' ')[0] : 'Teacher';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      contentContainerStyle={styles.scroll}
    >
      {/* 1. WELCOME HEADER */}
      <View style={styles.welcomeRow}>
        <View style={styles.welcomeTextGroup}>
          <Text variant="headlineSmall" style={[styles.greeting, { color: colors.text }]}>
            Welcome, {teacherFirstName} 👋
          </Text>
          <Text style={[styles.welcomeSubtext, { color: colors.textSecondary }]}>
            Manage your classes, files & biometric sessions
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.profileBadge, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}
          onPress={() => router.push('/(teacher)/profile')}
        >
          <MaterialCommunityIcons name="account-tie" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 2. STATS ROW */}
      <View style={styles.statsRow}>
        <StatCard
          title="Total Classrooms"
          value={classrooms.length}
          icon="google-classroom"
          color={colors.primary}
        />
        <StatCard
          title="Present Today"
          value={todayPresent}
          icon="account-check"
          color={THEME_COLORS.success}
        />
      </View>

      {/* 3. PRIMARY ACTION BUTTONS */}
      <View style={styles.actionButtonsRow}>
        <Button
          mode="contained"
          icon="plus-circle"
          onPress={() => router.push('/(teacher)/create-classroom')}
          style={styles.mainActionButton}
          buttonColor={colors.primary}
          contentStyle={styles.actionButtonContent}
        >
          Create Classroom
        </Button>
        <Button
          mode="outlined"
          icon="calendar-clock"
          onPress={() => router.push('/(teacher)/attendance-session')}
          style={[styles.mainActionButton, { borderColor: colors.primary }]}
          textColor={colors.primary}
          contentStyle={styles.actionButtonContent}
        >
          Start Attendance
        </Button>
      </View>

      {/* 4. CLASSROOMS LIST */}
      <View style={styles.sectionHeaderRow}>
        <Text variant="titleLarge" style={[styles.sectionTitle, { color: colors.text }]}>
          Your Classrooms
        </Text>
        {classrooms.length > 0 && (
          <Chip
            style={{ backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }}
            textStyle={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}
          >
            {classrooms.length} Active
          </Chip>
        )}
      </View>

      {classrooms && classrooms.length > 0 ? (
        classrooms.map((cls) => (
          <Card
            key={cls.classroomId}
            style={[styles.classroomCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
          >
            <Card.Content>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleArea}>
                  <Text variant="titleMedium" style={[styles.classNameText, { color: colors.text }]}>
                    {cls.className}
                  </Text>
                  <Text style={[styles.subjectText, { color: colors.textSecondary }]}>
                    {cls.subject || 'General'}
                  </Text>
                </View>
                <Chip
                  icon="account-group"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }}
                  textStyle={{ color: colors.text, fontSize: 12, fontWeight: '600' }}
                >
                  {cls.studentIds?.length || 0} Students
                </Chip>
              </View>

              {/* Classroom Code Area with Copy Action */}
              <View style={[styles.codeContainer, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}>
                <View style={styles.codeTextGroup}>
                  <Text style={[styles.codeLabel, { color: colors.primaryDark }]}>CLASSROOM CODE</Text>
                  <Text style={[styles.codeValue, { color: colors.primary }]}>{cls.classroomCode}</Text>
                </View>
                <Button
                  mode="text"
                  icon="content-copy"
                  textColor={colors.primary}
                  compact
                  onPress={() => handleCopyCode(cls.classroomCode, cls.className)}
                >
                  Copy
                </Button>
              </View>
            </Card.Content>

            <Card.Actions style={styles.cardActions}>
              <Button
                mode="text"
                icon="account-multiple"
                textColor={colors.primary}
                compact
                onPress={() => router.push({ pathname: '/(teacher)/classroom-students', params: { classroomId: cls.classroomId, className: cls.className } })}
              >
                Students
              </Button>
              <Button
                mode="text"
                icon="file-document-outline"
                textColor={colors.primary}
                compact
                onPress={() => router.push('/(teacher)/notes')}
              >
                Files & Notes
              </Button>
              <Button
                mode="contained-tonal"
                icon="calendar-check"
                buttonColor={isDark ? colors.surfaceAccent : '#FED7AA'}
                textColor={colors.primaryDark}
                compact
                onPress={() => router.push('/(teacher)/attendance-session')}
              >
                Attendance
              </Button>
            </Card.Actions>
          </Card>
        ))
      ) : (
        <Card style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={styles.emptyContent}>
            <MaterialCommunityIcons name="google-classroom" size={48} color={colors.primary} style={{ opacity: 0.8 }} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.text }]}>No Classrooms Yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Create your first classroom to generate unique student join codes, upload files, and take biometric attendance.
            </Text>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => router.push('/(teacher)/create-classroom')}
              style={styles.emptyBtn}
              buttonColor={colors.primary}
            >
              Create Classroom
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontWeight: '700', marginTop: 12, fontSize: 16 },
  errorSubtext: { marginTop: 6, textAlign: 'center', fontSize: 13, marginBottom: 16 },
  retryBtn: { borderRadius: 10 },

  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTextGroup: { flex: 1 },
  greeting: { fontWeight: '800', letterSpacing: -0.5 },
  welcomeSubtext: { fontSize: 13, marginTop: 2 },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  mainActionButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  actionButtonContent: {
    paddingVertical: 6,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 18,
  },

  classroomCard: {
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleArea: { flex: 1, marginRight: 8 },
  classNameText: { fontWeight: '700', fontSize: 17 },
  subjectText: { fontSize: 13, marginTop: 2 },

  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  codeTextGroup: { flexDirection: 'column' },
  codeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  codeValue: { fontSize: 18, fontWeight: '800', letterSpacing: 1.5 },

  cardActions: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    flexWrap: 'wrap',
    gap: 4,
  },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
  },
  emptyContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: { textAlign: 'center', fontWeight: '700', marginTop: 12 },
  emptyText: { textAlign: 'center', marginVertical: 8, fontSize: 13, lineHeight: 19 },
  emptyBtn: { marginTop: 14, borderRadius: 10 },
});
