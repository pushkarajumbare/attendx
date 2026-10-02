import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View } from 'react-native';
import { Text, TextInput, Button, Card, Menu, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  createAttendanceSession,
  closeAttendanceSession,
  getActiveSession,
} from '../../src/services/attendanceService';
import { ATTENDANCE, THEME_COLORS } from '../../src/constants';

export default function AttendanceSessionScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [radius, setRadius] = useState(String(ATTENDANCE.DEFAULT_RADIUS_METERS));

  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!uid) return;

        try {
          const classes = await getTeacherClassrooms(uid);
          const safeClasses = classes || [];
          setClassrooms(safeClasses);

          if (safeClasses.length > 0) {
            const first = selectedClass || safeClasses[0];
            setSelectedClass(first);
            setSubject(first.subject || first.className || '');

            const session = await getActiveSession(first.classroomId);
            setActiveSession(session);
          }
        } catch (err) {
          console.log('Load session error:', err);
        }
      };

      load();
    }, [uid, selectedClass])
  );

  const buildDateTime = (timeStr) => {
    const parts = timeStr.split(':').map(Number);
    const h = parts[0] || 9;
    const m = parts[1] || 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const handleStart = async () => {
    if (!uid) return Alert.alert('Error', 'User profile not loaded');
    if (!selectedClass) return Alert.alert('Error', 'Please select a classroom');

    setLoading(true);
    try {
      const session = await createAttendanceSession(
        uid,
        selectedClass.classroomId,
        {
          subject: subject || selectedClass.subject || selectedClass.className,
          startTime: buildDateTime(startTime),
          endTime: buildDateTime(endTime),
          radiusMeters: parseInt(radius, 10) || ATTENDANCE.DEFAULT_RADIUS_METERS,
        }
      );

      setActiveSession(session);
      Alert.alert('Session Active 🚀', 'Attendance session is now live for students in this classroom.');
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
      Alert.alert('Session Closed', 'The attendance session has been closed.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* 1. SELECT CLASSROOM */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="google-classroom" size={22} color={colors.primary} />
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
                  const session = await getActiveSession(cls.classroomId);
                  setActiveSession(session);
                }}
              />
            ))}
          </Menu>
        </Card.Content>
      </Card>

      {/* 2. ACTIVE SESSION STATUS OR NEW SESSION FORM */}
      {activeSession ? (
        <Card style={[styles.card, { backgroundColor: isDark ? '#1C2E24' : '#E6F4EA', borderColor: THEME_COLORS.success }]} mode="outlined">
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
                Allowed GPS Geofence: {activeSession.radiusMeters || 50} meters radius
              </Text>
              <Chip icon="check-decagram" style={{ alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(16, 185, 129, 0.2)' }} textStyle={{ color: THEME_COLORS.success, fontWeight: '700' }}>
                LIVE & ACCESSIBLE
              </Chip>
            </View>

            <Button
              mode="contained"
              icon="stop-circle-outline"
              buttonColor={THEME_COLORS.danger}
              onPress={handleClose}
              style={{ marginTop: 16, borderRadius: 10 }}
            >
              End Session Now
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="calendar-clock" size={22} color={colors.primary} />
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
              style={{ borderRadius: 10, marginTop: 4 }}
              contentStyle={{ paddingVertical: 6 }}
            >
              Start Live Attendance Session
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
  card: { marginBottom: 16, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  selectBtn: { borderRadius: 10 },
  input: { marginBottom: 12 },
  sessionBox: { marginTop: 8 },
});