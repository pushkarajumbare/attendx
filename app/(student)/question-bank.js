import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Linking, Alert, View } from 'react-native';
import { Text, Card, Button, Menu, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import { getQuestionBank } from '../../src/services/contentService';
import { EmptyState } from '../../src/components/EmptyState';
import { COLORS } from '../../src/constants';

export default function StudentQuestionBankScreen() {
  const { profile } = useAuth();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [items, setItems] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  // =========================
  // MANDATORY GLOBAL GUARD
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
  // DATA LOADING
  // =========================
  const loadData = async () => {
    try {
      const classes = await getStudentClassrooms(uid);

      setClassrooms(classes || []);

      const cls = selectedClass || classes?.[0];

      if (cls) {
        setSelectedClass(cls);

        const data = await getQuestionBank(cls.classroomId);
        setItems(data || []);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.log('Question bank error:', error);
      Alert.alert('Error', 'Failed to load question papers');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [uid, selectedClass])
  );

  // =========================
  // HANDLERS
  // =========================
  const handleClassSelect = async (cls) => {
    try {
      setSelectedClass(cls);
      setMenuVisible(false);

      const data = await getQuestionBank(cls.classroomId);
      setItems(data || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const handleOpenFile = async (url) => {
    try {
      if (!url) {
        Alert.alert('Error', 'Invalid file link');
        return;
      }

      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open file');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open file');
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* CLASS SELECT */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setMenuVisible(true)}
            style={styles.select}
          >
            {selectedClass
              ? selectedClass.className
              : 'Select Classroom'}
          </Button>
        }
      >
        {classrooms.map((cls) => (
          <Menu.Item
            key={cls.classroomId}
            title={cls.className}
            onPress={() => handleClassSelect(cls)}
          />
        ))}
      </Menu>

      {/* CONTENT */}
      {items.length === 0 ? (
        <EmptyState
          title="No question papers"
          subtitle="Practice papers will appear here"
        />
      ) : (
        items.map((item) => (
          <Card key={item.qbId} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>

              <Text style={styles.meta}>{item.fileName}</Text>
            </Card.Content>

            <Card.Actions>
              <Button onPress={() => handleOpenFile(item.fileUrl)}>
                Download
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

// =========================
// STYLES
// =========================
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