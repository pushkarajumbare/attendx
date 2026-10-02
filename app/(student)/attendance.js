import { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, ScrollView, RefreshControl } from 'react-native';
import { Text, Button, Card, Menu, Divider, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import { getActiveSession, getClassroomSessions, markAttendance } from '../../src/services/attendanceService';
import { getSessionStatusLabel, formatDateTime } from '../../src/utils/helpers';
import { THEME_COLORS, REJECTION_REASONS } from '../../src/constants';
import { FaceCamera } from '../../src/components/FaceCamera';

export default function StudentAttendanceScreen() {
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Camera Modal state toggle
  const [showCamera, setShowCamera] = useState(false);

  // =====================
  // LOAD CLASSROOMS
  // =====================
  const loadClassrooms = useCallback(async () => {
    if (!uid) return;
    try {
      const classes = await getStudentClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);
      if (safeClasses.length > 0) {
        setSelectedClass((prev) => {
          if (prev && safeClasses.some((c) => c.classroomId === prev.classroomId)) {
            return prev;
          }
          return safeClasses[0];
        });
      }
    } catch (error) {
      console.log('Classroom load error:', error);
    }
  }, [uid]);

  // =====================
  // LOAD SESSION
  // =====================
  const loadSession = useCallback(async () => {
    if (!selectedClass?.classroomId) {
      setActiveSession(null);
      return;
    }
    try {
      const active = await getActiveSession(selectedClass.classroomId);
      setActiveSession(active || null);
    } catch (error) {
      console.log('Session load error:', error);
    }
  }, [selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadClassrooms();
    }, [loadClassrooms])
  );

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadClassrooms(), loadSession()]);
    setRefreshing(false);
  }, [loadClassrooms, loadSession]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'reopened':
        return THEME_COLORS.success;
      case 'paused':
        return THEME_COLORS.warning;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusBackground = (status) => {
    switch (status) {
      case 'active':
      case 'reopened':
        return isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5';
      case 'paused':
        return isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7';
      default:
        return isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB';
    }
  };

  // Face scanner captures verify payload and marks attendance
  const handleFaceVerifyComplete = async (capturedResult) => {
    setShowCamera(false);
    setLoading(true);

    try {
      if (!uid) {
        Alert.alert('Session Error', 'Student context missing. Please log in again.');
        return;
      }

      if (!activeSession) {
        Alert.alert('Session Error', 'Active attendance session not found or closed.');
        return;
      }

      const result = await markAttendance({
        studentId: uid,
        teacherId: activeSession.teacherId,
        classroomId: selectedClass.classroomId,
        sessionId: activeSession.sessionId,
        capturedFace: capturedResult,
      });

      if (result.success) {
        Alert.alert(
          'Attendance Marked ✅',
          `Successfully checked in for ${activeSession.subject || selectedClass.className || 'Class'}.${
            result.record?.faceConfidence ? `\n\nBiometric Confidence: ${result.record.faceConfidence}%` : ''
          }`,
          [{ text: 'OK', onPress: () => loadSession() }]
        );
      } else {
        // Show specific, user-friendly error messages
        let title = 'Check-in Rejected';
        let message = result.reason || 'Attendance could not be marked.';

        if (result.faceResult && !result.faceResult.livenessPassed) {
          title = 'Liveness Check Failed';
          message = 'A real face was not detected. Please look directly at the camera and try again.';
        } else if (result.reason && result.reason.toLowerCase().includes('mismatch')) {
          title = 'Face Not Recognised';
          message = 'Your face did not match the registered biometric. Make sure you are registered and lighting is good.';
        } else if (result.reason && result.reason.toLowerCase().includes('location')) {
          title = 'Outside Classroom Range';
          message = 'You must be within the classroom geofence to mark attendance.';
        } else if (result.reason && result.reason.toLowerCase().includes('already')) {
          title = 'Already Marked';
          message = 'Your attendance has already been recorded for this session.';
        }

        Alert.alert(title, message);
      }
    } catch (err) {
      console.error('Mark attendance screen error:', err);
      Alert.alert(
        'Attendance Error',
        err.message || 'Failed to submit attendance. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading student profile...</Text>
      </View>
    );
  }

  // Render camera fullscreen if scanner is active
  if (showCamera) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <FaceCamera
          mode="verify"
          onCapture={handleFaceVerifyComplete}
          onCancel={() => setShowCamera(false)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* 1. SELECT CLASSROOM */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="google-classroom" size={20} color={colors.primary} />
            <Text variant="titleMedium" style={[styles.cardTitle, { color: colors.text }]}>
              Selected Classroom
            </Text>
          </View>

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setMenuVisible(true)}
                style={[styles.dropdownButton, { borderColor: colors.border }]}
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
                onPress={() => {
                  setSelectedClass(cls);
                  setMenuVisible(false);
                }}
              />
            ))}
          </Menu>
        </Card.Content>
      </Card>

      {/* 2. ATTENDANCE SESSION STATUS */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary} />
            <Text variant="titleMedium" style={[styles.cardTitle, { color: colors.text }]}>
              Session Status
            </Text>
          </View>
          <Divider style={[styles.divider, { backgroundColor: colors.border }]} />

          {activeSession ? (
            <View style={styles.sessionDetails}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Subject:</Text>
                <Text style={[styles.detailsValue, { color: colors.text }]}>{activeSession.subject || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Geofence Radius:</Text>
                <Text style={[styles.detailsValue, { color: colors.text }]}>{activeSession.radiusMeters || 50} meters</Text>
              </View>

              {activeSession.startTime && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Session Started:</Text>
                  <Text style={[styles.detailsValue, { color: colors.text }]}>{formatDateTime(activeSession.startTime)}</Text>
                </View>
              )}

              <View style={styles.chipRow}>
                <Chip
                  style={{ backgroundColor: getStatusBackground(activeSession.status) }}
                  textStyle={{ color: getStatusColor(activeSession.status), fontWeight: '700' }}
                  icon={() => (
                    <MaterialCommunityIcons
                      name={activeSession.status === 'active' ? 'record-circle-outline' : 'clock-outline'}
                      size={16}
                      color={getStatusColor(activeSession.status)}
                    />
                  )}
                >
                  {getSessionStatusLabel(activeSession.status).toUpperCase()}
                </Chip>
              </View>
            </View>
          ) : (
            <View style={styles.emptySessionBox}>
              <MaterialCommunityIcons name="clock-alert-outline" size={36} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No active attendance session currently open for this classroom.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 3. ACTION BUTTON */}
      <Button
        mode="contained"
        disabled={!activeSession || loading || !['active', 'reopened'].includes(activeSession?.status)}
        loading={loading}
        onPress={() => setShowCamera(true)}
        style={styles.scanButton}
        buttonColor={THEME_COLORS.primary}
        contentStyle={styles.scanButtonContent}
        icon="face-recognition"
      >
        Start Face Verification
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  dropdownButton: {
    marginTop: 8,
    borderRadius: 10,
  },
  divider: {
    marginVertical: 12,
  },
  sessionDetails: {
    marginTop: 4,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsLabel: {
    fontSize: 14,
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  emptySessionBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  scanButton: {
    marginTop: 8,
    borderRadius: 12,
    elevation: 3,
  },
  scanButtonContent: {
    paddingVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
});
