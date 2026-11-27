import { useState, useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Alert, View, RefreshControl } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Menu,
  Chip,
  Portal,
  Dialog,
  Searchbar,
  IconButton,
  Divider,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  bulkMarkSessionAttendance,
  closeAttendanceSession,
  createAttendanceSession,
  deleteAttendanceSession,
  getActiveSession,
  getClassroomSessions,
  getSessionAttendanceSheet,
  reopenAttendanceSession,
  setStudentSessionAttendance,
} from '../../src/services/attendanceService';
import { ATTENDANCE, ATTENDANCE_STATUS, THEME_COLORS } from '../../src/constants';
import { formatDate, formatTime, toValidDate } from '../../src/utils/helpers';
import { FadeInView } from '../../src/components/FadeInView';
import { IconBadge } from '../../src/components/IconBadge';

export default function AttendanceSessionScreen() {
  const { profile, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid || user?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);

  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [radius, setRadius] = useState(String(ATTENDANCE.DEFAULT_RADIUS_METERS));

  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const selectedClassRef = useRef(null);
  selectedClassRef.current = selectedClass;

  // Attendance Sheet / Manual Edit Modal
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetSession, setSheetSession] = useState(null);
  const [sheetRows, setSheetRows] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetBusyId, setSheetBusyId] = useState(null);
  const [sheetSearch, setSheetSearch] = useState('');

  const loadClassroomState = useCallback(async (cls) => {
    if (!cls?.classroomId) {
      setActiveSession(null);
      setSessions([]);
      return;
    }
    const [active, allSessions] = await Promise.all([
      getActiveSession(cls.classroomId),
      getClassroomSessions(cls.classroomId),
    ]);
    setActiveSession(active);
    setSessions(allSessions || []);
  }, []);

  const loadAll = useCallback(async () => {
    if (!uid) return;
    try {
      const classes = await getTeacherClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      if (safeClasses.length > 0) {
        const current =
          safeClasses.find((item) => item.classroomId === selectedClassRef.current?.classroomId) ||
          safeClasses[0];
        setSelectedClass(current);
        setSubject((prev) => prev || current.subject || current.className || '');
        await loadClassroomState(current);
      } else {
        setSelectedClass(null);
        setActiveSession(null);
        setSessions([]);
      }
    } catch (err) {
      console.log('Load session error:', err);
    }
  }, [uid, loadClassroomState]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      const refreshInterval = setInterval(async () => {
        const currentCls = selectedClassRef.current;
        if (!currentCls?.classroomId) return;
        try {
          await loadClassroomState(currentCls);
        } catch (_) {}
      }, 30000);
      return () => clearInterval(refreshInterval);
    }, [loadAll, loadClassroomState])
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const buildDateTime = (timeStr) => {
    const parts = timeStr.split(':').map(Number);
    const h = Number.isFinite(parts[0]) ? parts[0] : 9;
    const m = Number.isFinite(parts[1]) ? parts[1] : 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const handleStart = async () => {
    if (!uid) return Alert.alert('Error', 'User profile not loaded');
    if (!selectedClass) return Alert.alert('Error', 'Please select a classroom');

    setLoading(true);
    try {
      const session = await createAttendanceSession(uid, selectedClass.classroomId, {
        subject: subject || selectedClass.subject || selectedClass.className,
        startTime: buildDateTime(startTime),
        endTime: buildDateTime(endTime),
        radiusMeters: parseInt(radius, 10) || ATTENDANCE.DEFAULT_RADIUS_METERS,
      });

      setActiveSession(session);
      await loadClassroomState(selectedClass);
      Alert.alert(
        'Session Active',
        'Attendance session is now live and enrolled students have been notified.'
      );
    } catch (error) {
      Alert.alert('Session Start Failed', error.message || 'Could not start session');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    try {
      if (!activeSession) return;
      await closeAttendanceSession(activeSession.sessionId);
      setActiveSession(null);
      await loadClassroomState(selectedClass);
      Alert.alert('Session Closed', 'The attendance session has ended.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleReopen = async (session) => {
    try {
      await reopenAttendanceSession(session.sessionId);
      await loadClassroomState(selectedClass);
      Alert.alert('Session Reopened', 'Attendance session is active again.');
    } catch (err) {
      Alert.alert('Cannot Reopen', err.message || 'Expired sessions cannot be reopened.');
    }
  };

  const handleDeleteSession = (session) => {
    Alert.alert(
      'Delete Session',
      `Remove "${session.subject || 'Lecture'}" and its attendance records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAttendanceSession(session.sessionId, uid);
              if (activeSession?.sessionId === session.sessionId) {
                setActiveSession(null);
              }
              await loadClassroomState(selectedClass);
            } catch (err) {
              Alert.alert('Delete Failed', err.message || 'Could not remove session.');
            }
          },
        },
      ]
    );
  };

  const openAttendanceSheet = async (session) => {
    if (!session?.sessionId || !uid) return;
    setSheetSession(session);
    setSheetVisible(true);
    setSheetLoading(true);
    setSheetSearch('');
    try {
      const sheet = await getSessionAttendanceSheet(session.sessionId, uid);
      setSheetRows(sheet.rows || []);
    } catch (err) {
      Alert.alert('Load Error', err.message || 'Could not load session roster.');
      setSheetRows([]);
    } finally {
      setSheetLoading(false);
    }
  };

  const handleToggleStudentStatus = async (row) => {
    if (!sheetSession || !uid || sheetBusyId) return;
    const nextStatus = row.present ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PRESENT;
    setSheetBusyId(row.studentId);
    try {
      await setStudentSessionAttendance({
        teacherId: uid,
        classroomId: sheetSession.classroomId,
        sessionId: sheetSession.sessionId,
        studentId: row.studentId,
        status: nextStatus,
      });
      setSheetRows((prev) =>
        prev.map((item) =>
          item.studentId === row.studentId
            ? {
                ...item,
                present: nextStatus === ATTENDANCE_STATUS.PRESENT,
                status: nextStatus,
                markedBy: 'teacher',
                manualOverride: true,
              }
            : item
        )
      );
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update student attendance.');
    } finally {
      setSheetBusyId(null);
    }
  };

  const handleBulkMark = async (targetStatus) => {
    if (!sheetSession || !uid || sheetRows.length === 0) return;
    setSheetBusyId('__bulk__');
    try {
      await bulkMarkSessionAttendance({
        teacherId: uid,
        classroomId: sheetSession.classroomId,
        sessionId: sheetSession.sessionId,
        studentIds: sheetRows.map((r) => r.studentId),
        status: targetStatus,
      });
      const isPresent = targetStatus === ATTENDANCE_STATUS.PRESENT;
      setSheetRows((prev) =>
        prev.map((item) => ({
          ...item,
          present: isPresent,
          status: targetStatus,
          markedBy: 'teacher',
          manualOverride: true,
        }))
      );
    } catch (err) {
      Alert.alert('Bulk Update Failed', err.message || 'Could not update students.');
    } finally {
      setSheetBusyId(null);
    }
  };

  const sessionEnd = toValidDate(activeSession?.endTime);
  const remainingMs = sessionEnd ? Math.max(0, sessionEnd.getTime() - now) : 0;
  const remainingHours = Math.floor(remainingMs / 3600000);
  const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const remainingTime =
    remainingHours > 0
      ? `${remainingHours}:${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      : `${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

  const filteredSheetRows = sheetRows.filter((r) => {
    if (!sheetSearch.trim()) return true;
    const q = sheetSearch.toLowerCase();
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.rollNumber && r.rollNumber.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q))
    );
  });

  const sheetPresentCount = sheetRows.filter((r) => r.present).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={styles.scroll}
      >
        <FadeInView>
          {/* 1. SELECT CLASSROOM */}
          <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
            <Card.Content>
              <View style={styles.cardHeader}>
                <IconBadge name="google-classroom" size={20} boxSize={38} borderRadius={12} />
                <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                  Select Classroom
                </Text>
              </View>

              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setMenuVisible(true)}
                    style={[styles.selectBtn, { borderColor: colors.border }]}
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
                      setSubject(cls.subject || cls.className || '');
                      setMenuVisible(false);
                      await loadClassroomState(cls);
                    }}
                  />
                ))}
              </Menu>
            </Card.Content>
          </Card>

          {/* 2. ACTIVE SESSION OR START FORM */}
          {activeSession ? (
            <Card style={[styles.card, { backgroundColor: colors.successSurface, borderColor: THEME_COLORS.success }]} mode="outlined">
              <Card.Content>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="record-circle-outline" size={24} color={THEME_COLORS.success} />
                  <Text variant="titleMedium" style={{ color: THEME_COLORS.success, fontWeight: '800' }}>
                    Attendance Session Active
                  </Text>
                </View>

                <View style={styles.sessionBox}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                    Subject: {activeSession.subject || 'General'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Geofence: {activeSession.radiusMeters || 50} meters radius
                  </Text>
                  <Chip
                    icon="check-decagram"
                    style={{ alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                    textStyle={{ color: THEME_COLORS.success, fontWeight: '700' }}
                  >
                    {remainingMs > 0 ? `ACTIVE · ${remainingTime} REMAINING` : 'ENDED'}
                  </Chip>
                </View>

                <View style={styles.liveActionsRow}>
                  <Button
                    mode="contained"
                    icon="account-check-outline"
                    buttonColor={colors.primary}
                    textColor="#FFFFFF"
                    style={{ flex: 1, borderRadius: 10 }}
                    onPress={() => openAttendanceSheet(activeSession)}
                  >
                    Mark / Edit Roster
                  </Button>
                  <Button
                    mode="contained"
                    icon="stop-circle-outline"
                    buttonColor={THEME_COLORS.danger}
                    textColor="#FFFFFF"
                    style={{ borderRadius: 10 }}
                    onPress={handleClose}
                  >
                    End Now
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ) : (
            <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
              <Card.Content>
                <View style={styles.cardHeader}>
                  <IconBadge name="calendar-clock" size={20} boxSize={38} borderRadius={12} />
                  <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                    Launch Attendance Session
                  </Text>
                </View>

                <TextInput
                  label="Subject / Course *"
                  value={subject}
                  onChangeText={setSubject}
                  mode="outlined"
                  style={styles.input}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  textColor={colors.text}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    label="Start Time (HH:MM)"
                    value={startTime}
                    onChangeText={setStartTime}
                    mode="outlined"
                    style={[styles.input, { flex: 1 }]}
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary}
                    textColor={colors.text}
                  />
                  <TextInput
                    label="End Time (HH:MM)"
                    value={endTime}
                    onChangeText={setEndTime}
                    mode="outlined"
                    style={[styles.input, { flex: 1 }]}
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary}
                    textColor={colors.text}
                  />
                </View>

                <TextInput
                  label="Geofence Radius (meters)"
                  value={radius}
                  onChangeText={setRadius}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  textColor={colors.text}
                />

                <Button
                  mode="contained"
                  icon="play-circle-outline"
                  onPress={handleStart}
                  loading={loading}
                  disabled={loading}
                  buttonColor={colors.primary}
                  textColor="#FFFFFF"
                  style={{ borderRadius: 12, marginTop: 4 }}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Start Live Attendance Session
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* 3. PAST & RECENT LECTURE SESSIONS */}
          <Text variant="titleMedium" style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>
            Classroom Sessions & Manual Edits ({sessions.length})
          </Text>

          {sessions.length === 0 ? (
            <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
              <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={38} color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                  No sessions recorded yet for this classroom.
                </Text>
              </Card.Content>
            </Card>
          ) : (
            sessions.map((sess) => {
              const sStart = toValidDate(sess.startTime);
              const sEnd = toValidDate(sess.endTime);
              const canReopen = sess.status === 'ended' && sEnd && sEnd.getTime() > Date.now();
              const isLive = ['active', 'reopened'].includes(sess.status) && sEnd && sEnd.getTime() > Date.now();

              return (
                <Card
                  key={sess.sessionId}
                  style={[styles.sessionItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  mode="outlined"
                >
                  <Card.Content>
                    <View style={styles.sessionTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleSmall" style={{ fontWeight: '700', color: colors.text }}>
                          {sess.subject || selectedClass?.className || 'Lecture'}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {sStart ? `${formatDate(sStart)} · ${formatTime(sStart)} - ${formatTime(sEnd)}` : 'Time unavailable'}
                        </Text>
                      </View>
                      <Chip
                        compact
                        style={{
                          backgroundColor: isLive ? colors.successSurface : colors.surfaceVariant,
                        }}
                        textStyle={{
                          color: isLive ? THEME_COLORS.success : colors.textSecondary,
                          fontSize: 10.5,
                          fontWeight: '700',
                        }}
                      >
                        {isLive ? 'LIVE' : 'ENDED'}
                      </Chip>
                    </View>

                    <View style={styles.sessionActionsRow}>
                      <Button
                        mode="contained-tonal"
                        compact
                        icon="pencil-outline"
                        buttonColor={colors.primarySoft}
                        textColor={isDark ? THEME_COLORS.secondary : colors.primaryDark}
                        onPress={() => openAttendanceSheet(sess)}
                      >
                        Edit Attendance
                      </Button>
                      {canReopen && (
                        <Button
                          mode="outlined"
                          compact
                          icon="refresh"
                          textColor={THEME_COLORS.success}
                          style={{ borderColor: THEME_COLORS.success }}
                          onPress={() => handleReopen(sess)}
                        >
                          Reopen
                        </Button>
                      )}
                      <IconButton
                        icon="delete-outline"
                        size={19}
                        iconColor={THEME_COLORS.danger}
                        onPress={() => handleDeleteSession(sess)}
                      />
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </FadeInView>
      </ScrollView>

      {/* SESSION ROSTER / ATTENDANCE MARK & EDIT MODAL */}
      <Portal>
        <Dialog visible={sheetVisible} onDismiss={() => setSheetVisible(false)} style={{ maxHeight: '86%' }}>
          <Dialog.Title>
            {sheetSession?.subject || 'Session'} ({sheetPresentCount}/{sheetRows.length} Present)
          </Dialog.Title>
          <Dialog.Content style={{ paddingBottom: 6 }}>
            <Searchbar
              placeholder="Search name or roll no..."
              value={sheetSearch}
              onChangeText={setSheetSearch}
              style={{
                backgroundColor: colors.surfaceVariant,
                borderRadius: 12,
                height: 44,
                marginBottom: 8,
              }}
              inputStyle={{ fontSize: 13, minHeight: 0, color: colors.text }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                mode="contained-tonal"
                compact
                icon="check-all"
                buttonColor={colors.successSurface}
                textColor={THEME_COLORS.success}
                loading={sheetBusyId === '__bulk__'}
                disabled={Boolean(sheetBusyId) || sheetLoading || sheetRows.length === 0}
                onPress={() => handleBulkMark(ATTENDANCE_STATUS.PRESENT)}
                style={{ flex: 1 }}
              >
                All Present
              </Button>
              <Button
                mode="outlined"
                compact
                icon="close-circle"
                textColor={THEME_COLORS.danger}
                style={{ flex: 1, borderColor: THEME_COLORS.danger }}
                disabled={Boolean(sheetBusyId) || sheetLoading || sheetRows.length === 0}
                onPress={() => handleBulkMark(ATTENDANCE_STATUS.ABSENT)}
              >
                All Absent
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.ScrollArea style={{ maxHeight: 380 }}>
            <ScrollView>
              {sheetLoading ? (
                <Text style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>
                  Loading enrolled students...
                </Text>
              ) : filteredSheetRows.length === 0 ? (
                <Text style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>
                  No students match this filter.
                </Text>
              ) : (
                filteredSheetRows.map((row) => (
                  <View key={row.studentId}>
                    <View style={styles.sheetRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>
                          {row.rollNumber ? `${row.rollNumber} · ` : ''}
                          {row.name}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                          {row.present
                            ? row.markedBy === 'teacher'
                              ? 'Present (Marked by teacher)'
                              : `Present${row.faceConfidence ? ` · Face ${row.faceConfidence}%` : ''}`
                            : 'Absent'}
                        </Text>
                      </View>
                      <Button
                        mode={row.present ? 'contained' : 'outlined'}
                        compact
                        loading={sheetBusyId === row.studentId}
                        disabled={Boolean(sheetBusyId)}
                        buttonColor={row.present ? THEME_COLORS.success : undefined}
                        textColor={row.present ? '#FFFFFF' : colors.primary}
                        style={{
                          borderRadius: 10,
                          borderColor: row.present ? THEME_COLORS.success : colors.primary,
                        }}
                        onPress={() => handleToggleStudentStatus(row)}
                      >
                        {row.present ? 'Present' : 'Mark Present'}
                      </Button>
                    </View>
                    <Divider style={{ backgroundColor: colors.border }} />
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSheetVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 16, borderRadius: 18, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  selectBtn: { borderRadius: 12 },
  input: { marginBottom: 12 },
  sessionBox: { marginTop: 6 },
  liveActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sessionItemCard: { marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  sessionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
});
