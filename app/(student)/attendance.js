
import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';

import {
  Text,
  Button,
  Card,
  Menu,
  Divider,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';

import { useFocusEffect } from 'expo-router';

import { useAuth }
from '../../src/context/AuthContext';

import {
  getStudentClassrooms,
} from '../../src/services/classroomService';

import {
  getActiveSession,
  getClassroomSessions,
  markAttendance,
} from '../../src/services/attendanceService';

import {
  getSessionStatusLabel,
} from '../../src/utils/helpers';

import {
  COLORS,
} from '../../src/constants';

export default function StudentAttendanceScreen() {
  const { profile } =
    useAuth();

  const uid =
    profile?.uid;

  const [classrooms,
    setClassrooms] =
    useState([]);

  const [selectedClass,
    setSelectedClass] =
    useState(null);

  const [allSessions,
    setAllSessions] =
    useState([]);

  const [activeSession,
    setActiveSession] =
    useState(null);

  const [menuVisible,
    setMenuVisible] =
    useState(false);

  const [loading,
    setLoading] =
    useState(false);

  // =====================
  // LOAD CLASSROOMS
  // =====================
  const loadClassrooms =
    useCallback(async () => {
      if (!uid) return;

      try {
        const classes =
          await getStudentClassrooms(uid);

        setClassrooms(
          classes || []
        );

        if (
          classes?.length > 0
        ) {
          setSelectedClass(
            (prev) =>
              prev ||
              classes[0]
          );
        }
      } catch (error) {
        console.log(
          'Classroom load error:',
          error
        );
      }
    }, [uid]);

  // =====================
  // LOAD SESSION
  // =====================
  const loadSession =
    useCallback(async () => {
      if (
        !selectedClass?.classroomId
      ) return;

      try {
        const active =
          await getActiveSession(
            selectedClass.classroomId
          );

        setActiveSession(
          active || null
        );

        const sessions =
          await getClassroomSessions(
            selectedClass.classroomId
          );

        setAllSessions(
          sessions || []
        );
      } catch (error) {
        console.log(
          'Session load error:',
          error
        );
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

  const getStatusColor =
    (status) => {
      switch (status) {
        case 'active':
          return COLORS.success;

        case 'paused':
          return COLORS.warning;

        default:
          return COLORS.textSecondary;
      }
    };

  const getStatusBackground =
    (status) => {
      switch (status) {
        case 'active':
          return '#D1FAE5';

        case 'paused':
          return '#FEF3C7';

        default:
          return '#E5E7EB';
      }
    };

  if (!profile) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={
        styles.container
      }
      contentContainerStyle={
        styles.scroll
      }
    >
      <Card
        style={styles.card}
      >
        <Card.Content>
          <Text variant="titleMedium">
            Select Classroom
          </Text>

          <Menu
            visible={
              menuVisible
            }
            onDismiss={() =>
              setMenuVisible(
                false
              )
            }
            anchor={
              <Button
                mode="outlined"
                onPress={() =>
                  setMenuVisible(
                    true
                  )
                }
              >
                {selectedClass
                  ?.className ||
                  'Select classroom'}
              </Button>
            }
          >
            {classrooms.map(
              (cls) => (
                <Menu.Item
                  key={
                    cls.classroomId
                  }
                  title={`${cls.className} (${cls.classroomCode})`}
                  onPress={() => {
                    setSelectedClass(
                      cls
                    );

                    setMenuVisible(
                      false
                    );
                  }}
                />
              )
            )}
          </Menu>
        </Card.Content>
      </Card>

      <Card
        style={styles.card}
      >
        <Card.Content>
          <Text variant="titleMedium">
            Attendance Status
          </Text>

          <Divider
            style={
              styles.divider
            }
          />

          {activeSession ? (
            <>
              <Text>
                Subject:
                {' '}
                {
                  activeSession.subject
                }
              </Text>

              <Text>
                Radius:
                {' '}
                {
                  activeSession.radiusMeters
                }m
              </Text>

              <Chip
                style={{
                  backgroundColor:
                    getStatusBackground(
                      activeSession.status
                    ),
                }}
                textStyle={{
                  color:
                    getStatusColor(
                      activeSession.status
                    ),
                }}
              >
                {getSessionStatusLabel(
                  activeSession.status
                )}
              </Chip>
            </>
          ) : (
            <Text>
              No active attendance session
            </Text>
          )}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        disabled={
          !activeSession ||
          loading
        }
        loading={
          loading
        }
        onPress={() =>
          Alert.alert(
            'Face Camera Disabled',
            'FaceCamera.js is crashing. Fix it first.'
          )
        }
      >
        Start Face Scan
      </Button>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    scroll: {
      padding: 16,
    },

    card: {
      marginBottom: 12,
      borderRadius: 12,
    },

    divider: {
      marginVertical: 12,
    },

    loadingContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems:
        'center',
    },
  });

