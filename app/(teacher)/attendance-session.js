import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Card, Menu } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  createAttendanceSession,
  closeAttendanceSession,
  getActiveSession,
} from '../../src/services/attendanceService';

import { ATTENDANCE, COLORS } from '../../src/constants';

export default function AttendanceSessionScreen() {
  const { profile } = useAuth();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:10');
  const [radius, setRadius] = useState(String(ATTENDANCE.DEFAULT_RADIUS_METERS));

  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ SAFE LOAD (fixes your uid crash)
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!profile?.uid) return;

        try {
          const classes = await getTeacherClassrooms(profile.uid);
          setClassrooms(classes || []);

          if (classes?.length > 0) {
            const first = classes[0];
            setSelectedClass(first);
            setSubject(first.subject || '');

            const session = await getActiveSession(first.classroomId);
            setActiveSession(session);
          }
        } catch (err) {
          console.log(err);
          Alert.alert('Error', 'Failed to load classrooms');
        }
      };

      load();
    }, [profile?.uid])
  );

  const buildDateTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const handleStart = async () => {
    if (!profile?.uid) return Alert.alert('Error', 'User not loaded');
    if (!selectedClass) return Alert.alert('Error', 'Select a classroom');

    setLoading(true);
    try {
      const session = await createAttendanceSession(
        profile.uid,
        selectedClass.classroomId,
        {
          subject: subject || selectedClass.subject,
          startTime: buildDateTime(startTime),
          endTime: buildDateTime(endTime),
          radiusMeters: parseInt(radius, 10) || ATTENDANCE.DEFAULT_RADIUS_METERS,
        }
      );

      setActiveSession(session);
      Alert.alert('Success', 'Attendance session started');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    try {
      if (!activeSession) return;
      await closeAttendanceSession(activeSession.sessionId);
      setActiveSession(null);
      Alert.alert('Closed', 'Session closed');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* CLASS SELECT */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Select Classroom</Text>

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setMenuVisible(true)}
                style={styles.select}
              >
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
                  setSubject(cls.subject || '');
                  setMenuVisible(false);

                  const session = await getActiveSession(cls.classroomId);
                  setActiveSession(session);
                }}
              />
            ))}
          </Menu>
        </Card.Content>
      </Card>

      {/* ACTIVE SESSION */}
      {activeSession ? (
        <Card style={[styles.card, styles.activeCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.activeText}>
              Session Active
            </Text>

            <Text>Subject: {activeSession.subject}</Text>
            <Text>Radius: {activeSession.radiusMeters}m</Text>

            <Button
              mode="contained"
              buttonColor={COLORS.danger}
              onPress={handleClose}
              style={styles.closeBtn}
            >
              Close Session
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">New Session</Text>

            <TextInput
              label="Subject"
              value={subject}
              onChangeText={setSubject}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Start Time"
              value={startTime}
              onChangeText={setStartTime}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="End Time"
              value={endTime}
              onChangeText={setEndTime}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Radius (meters)"
              value={radius}
              onChangeText={setRadius}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handleStart}
              loading={loading}
            >
              Start Attendance Session
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
  card: { marginBottom: 12, borderRadius: 12 },
  select: { marginTop: 12 },
  input: { marginBottom: 12 },
  activeCard: { backgroundColor: '#def7ec' },
  activeText: { color: COLORS.success, fontWeight: '700' },
  closeBtn: { marginTop: 12 },
});