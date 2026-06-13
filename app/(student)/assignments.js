import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View } from 'react-native';
import {
  Text,
  Card,
  Button,
  Menu,
  ActivityIndicator,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

import { getStudentClassrooms } from '../../src/services/classroomService';
import { getAssignments } from '../../src/services/contentService';
import { Linking } from 'react-native';

import { EmptyState } from '../../src/components/EmptyState';
import { formatDate } from '../../src/utils/helpers';
import { COLORS } from '../../src/constants';

export default function StudentAssignmentsScreen() {
  const { profile } = useAuth();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  // =========================
  // GLOBAL SAFETY GUARD
  // =========================
  const uid = profile?.uid;

  if (!uid) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // =========================
  // LOAD DATA SAFELY
  // =========================
  const loadData = async (currentUid = uid) => {
    try {
      const classes = await getStudentClassrooms(currentUid);
      setClassrooms(classes || []);

      const cls = selectedClass || classes?.[0];

      if (cls) {
        setSelectedClass(cls);
        const data = await getAssignments(cls.classroomId);
        setAssignments(data || []);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.log('Assignment loading error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(uid);
    }, [uid])
  );

  const handleOpen = async (url) => {
    if (!url) {
      Alert.alert('No link provided by teacher');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot open link');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* CLASSROOM SELECT */}
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
              setMenuVisible(false);

              const data = await getAssignments(cls.classroomId);
              setAssignments(data || []);
            }}
          />
        ))}
      </Menu>

      {/* EMPTY STATE */}
      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments"
          subtitle="Assignments from your teacher will appear here"
        />
      ) : (
        assignments.map((item) => (
          <Card key={item.assignmentId} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>
              <Text style={styles.desc}>{item.description}</Text>
              <Text style={styles.meta}>
                Deadline: {formatDate(item.deadline)}
              </Text>
              <Text style={styles.meta}>
                Max Marks: {item.maxMarks}
              </Text>
            </Card.Content>

            <Card.Actions>
              <Button onPress={() => handleOpen(item.fileUrl)} disabled={!item.fileUrl}>
                Open Link
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 16,
  },
  select: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  desc: {
    marginTop: 4,
  },
  meta: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});