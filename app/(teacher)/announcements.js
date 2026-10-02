import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { Text, Card, Button, TextInput, Menu, IconButton } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import { getAnnouncements, createAnnouncement, deleteResource } from '../../src/services/contentService';
import { formatDate } from '../../src/utils/helpers';
import { THEME_COLORS, COLLECTIONS } from '../../src/constants';

export default function AnnouncementsScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!uid) return;

    try {
      const classes = await getTeacherClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      if (safeClasses.length > 0) {
        const cls = selectedClass || safeClasses[0];
        setSelectedClass(cls);

        const data = await getAnnouncements(cls.classroomId);
        setAnnouncements(data || []);
      } else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.log('Announcement load error:', error);
    }
  }, [uid, selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handlePost = async () => {
    if (!title.trim() || !message.trim() || !selectedClass) {
      Alert.alert('Validation Error', 'Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      await createAnnouncement(selectedClass.classroomId, uid, {
        title: title.trim(),
        message: message.trim(),
      });

      const updated = await getAnnouncements(selectedClass.classroomId);
      setAnnouncements(updated || []);

      setTitle('');
      setMessage('');
      Alert.alert('Success 🎉', 'Announcement posted to classroom members');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to post announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Announcement', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResource(COLLECTIONS.ANNOUNCEMENTS, item.announcementId || item.id);
            const updated = await getAnnouncements(selectedClass.classroomId);
            setAnnouncements(updated || []);
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (!uid) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setMenuVisible(true)}
            style={[styles.select, { borderColor: colors.border }]}
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
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="bullhorn-outline" size={22} color={colors.primary} />
            <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
              New Announcement
            </Text>
          </View>

          <TextInput
            label="Announcement Title *"
            placeholder="e.g. Tomorrow's Class Cancelled"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <TextInput
            label="Message *"
            placeholder="Type your broadcast message to students..."
            value={message}
            onChangeText={setMessage}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <Button
            mode="contained"
            icon="bullhorn"
            onPress={handlePost}
            loading={loading}
            disabled={loading}
            buttonColor={colors.primary}
            style={{ borderRadius: 10, marginTop: 4 }}
          >
            Post Announcement
          </Button>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 10, color: colors.text }}>
        Classroom Broadcasts ({announcements.length})
      </Text>

      {/* LIST */}
      {announcements.map((item) => (
        <Card
          key={item.announcementId || item.id}
          style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          mode="outlined"
        >
          <Card.Content>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                  {item.message}
                </Text>
                {item.createdAt && (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
                    Posted: {formatDate(item.createdAt)}
                  </Text>
                )}
              </View>
              <IconButton
                icon="delete-outline"
                iconColor={THEME_COLORS.danger}
                size={20}
                onPress={() => handleDelete(item)}
              />
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  select: { marginBottom: 14, borderRadius: 10 },
  card: { marginBottom: 18, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { marginBottom: 12 },
  itemCard: { marginBottom: 12, borderRadius: 14, borderWidth: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});