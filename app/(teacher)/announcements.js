import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { Text, Card, Button, TextInput, Menu } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getAnnouncements, createAnnouncement } from '../../src/services/contentService';
import { COLORS } from '../../src/constants';

export default function AnnouncementsScreen() {
  const { profile } = useAuth();

  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  // ✅ GLOBAL GUARD (prevents crash)
  if (!uid) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // =========================
  // LOAD DATA
  // =========================
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const classes = await getTeacherClassrooms(uid);

          setClassrooms(classes || []);

          if (classes?.length > 0) {
            const first = classes[0];
            setSelectedClass(first);

            const data = await getAnnouncements(first.classroomId);
            setAnnouncements(data || []);
          } else {
            setAnnouncements([]);
          }
        } catch (error) {
          console.log('Announcement load error:', error);
        }
      };

      load();
    }, [uid])
  );

  // =========================
  // POST ANNOUNCEMENT
  // =========================
  const handlePost = async () => {
    if (!title || !message || !selectedClass) {
      Alert.alert('Error', 'Fill all fields');
      return;
    }

    try {
      setLoading(true);

      await createAnnouncement(selectedClass.classroomId, uid, {
        title,
        message,
      });

      const updated = await getAnnouncements(selectedClass.classroomId);
      setAnnouncements(updated || []);

      setTitle('');
      setMessage('');

      Alert.alert(
        'Success',
        'Announcement posted successfully'
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
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
              try {
                setSelectedClass(cls);
                setMenuVisible(false);

                const data = await getAnnouncements(cls.classroomId);
                setAnnouncements(data || []);
              } catch (error) {
                console.log(error);
              }
            }}
          />
        ))}
      </Menu>

      {/* CREATE ANNOUNCEMENT */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">New Announcement</Text>

          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Message"
            value={message}
            onChangeText={setMessage}
            mode="outlined"
            multiline
            style={styles.input}
          />

          <Button
            mode="contained"
            icon="bullhorn"
            onPress={handlePost}
            loading={loading}
            disabled={loading}
          >
            Post Announcement
          </Button>
        </Card.Content>
      </Card>

      {/* LIST */}
      {announcements.map((item) => (
        <Card key={item.announcementId} style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">{item.title}</Text>
            <Text style={styles.meta}>{item.message}</Text>
          </Card.Content>
        </Card>
      ))}
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
  input: {
    marginBottom: 12,
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