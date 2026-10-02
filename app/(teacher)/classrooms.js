import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import {
  getTeacherClassrooms,
  deleteClassroom,
} from '../../src/services/classroomService';
import { EmptyState } from '../../src/components/EmptyState';
import { THEME_COLORS } from '../../src/constants';

export default function TeacherClassroomsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadClassrooms = async (uid) => {
    if (!uid) return;

    try {
      setLoading(true);
      const data = await getTeacherClassrooms(uid);
      setClassrooms(data || []);
    } catch (error) {
      console.log('Classrooms load error:', error);
      Alert.alert('Error', 'Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!profile?.uid) return;
      loadClassrooms(profile.uid);
    }, [profile?.uid])
  );

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

  const handleDelete = (classroom) => {
    if (!profile?.uid) return;

    Alert.alert('Delete Classroom', `Are you sure you want to delete ${classroom.className}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClassroom(classroom.classroomId, profile.uid);
            loadClassrooms(profile.uid);
          } catch (error) {
            Alert.alert('Error', error.message || 'Failed to delete classroom');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      <Button
        mode="contained"
        icon="plus-circle"
        onPress={() => router.push('/(teacher)/create-classroom')}
        style={styles.createBtn}
        buttonColor={colors.primary}
        contentStyle={styles.btnContent}
      >
        Create New Classroom
      </Button>

      {classrooms.length === 0 && !loading ? (
        <EmptyState
          title="No Classrooms Found"
          subtitle="Create your first classroom to generate unique join codes for your students"
        />
      ) : (
        classrooms.map((cls) => (
          <Card
            key={cls.classroomId}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
          >
            <Card.Content>
              <View style={styles.cardTopRow}>
                <View style={styles.cardHeaderInfo}>
                  <Text variant="titleMedium" style={[styles.className, { color: colors.text }]}>
                    {cls.className}
                  </Text>
                  <Text style={[styles.subject, { color: colors.textSecondary }]}>
                    {cls.subject || 'General'}
                  </Text>
                </View>
                <IconButton
                  icon="delete-outline"
                  iconColor={THEME_COLORS.danger}
                  size={22}
                  onPress={() => handleDelete(cls)}
                />
              </View>

              {/* Code Chip with Copy */}
              <View style={[styles.codeBadgeRow, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="key" size={16} color={colors.primary} />
                  <Text style={[styles.codeText, { color: colors.primary }]}>
                    CODE: {cls.classroomCode}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleCopyCode(cls.classroomCode, cls.className)}>
                  <Text style={[styles.copyBtnText, { color: colors.primaryDark }]}>Copy</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metaRow}>
                <Chip
                  icon="account-group"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }}
                  textStyle={{ color: colors.textSecondary, fontSize: 12 }}
                >
                  {cls.studentIds?.length || 0} Students Enrolled
                </Chip>
              </View>
            </Card.Content>

            <Card.Actions style={styles.cardActions}>
              <Button
                mode="text"
                icon="account-multiple"
                textColor={colors.primary}
                onPress={() => router.push({ pathname: '/(teacher)/classroom-students', params: { classroomId: cls.classroomId, className: cls.className } })}
              >
                Students
              </Button>
              <Button
                mode="text"
                icon="file-upload-outline"
                textColor={colors.primary}
                onPress={() => router.push('/(teacher)/notes')}
              >
                Upload Files
              </Button>
              <Button
                mode="contained-tonal"
                icon="calendar-clock"
                buttonColor={isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight}
                textColor={colors.primaryDark}
                onPress={() => router.push('/(teacher)/attendance-session')}
              >
                Session
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  createBtn: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  btnContent: { paddingVertical: 6 },
  card: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderInfo: { flex: 1 },
  className: { fontWeight: '700', fontSize: 17 },
  subject: { fontSize: 13, marginTop: 2 },
  codeBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  codeText: { fontWeight: '800', letterSpacing: 1.2, fontSize: 14 },
  copyBtnText: { fontWeight: '700', fontSize: 13 },
  metaRow: { flexDirection: 'row', marginTop: 2 },
  cardActions: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    flexWrap: 'wrap',
  },
});