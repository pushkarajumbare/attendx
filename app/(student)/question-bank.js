import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Card, Button, Menu, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { getStudentClassrooms } from '../../src/services/classroomService';
import { getQuestionBank, openOrDownloadFile } from '../../src/services/contentService';
import { EmptyState } from '../../src/components/EmptyState';
import { formatDate } from '../../src/utils/helpers';
import { THEME_COLORS } from '../../src/constants';

export default function StudentQuestionBankScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [items, setItems] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const classes = await getStudentClassrooms(uid);
      const safeClasses = classes || [];
      setClassrooms(safeClasses);

      const cls = selectedClass || safeClasses[0];
      if (cls) {
        setSelectedClass(cls);
        const data = await getQuestionBank(cls.classroomId);
        setItems(data || []);
      }
    } catch (error) {
      console.log('Question bank error:', error);
    }
  }, [uid, selectedClass]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleClassSelect = async (cls) => {
    setSelectedClass(cls);
    setMenuVisible(false);
    const data = await getQuestionBank(cls.classroomId);
    setItems(data || []);
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
            onPress={() => handleClassSelect(cls)}
          />
        ))}
      </Menu>

      {items.length === 0 ? (
        <EmptyState
          title="No Question Papers"
          subtitle="Practice question papers and PYQ solutions published by your teacher will appear here"
        />
      ) : (
        items.map((item) => (
          <Card
            key={item.qbId || item.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            mode="outlined"
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="help-box-outline" size={24} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.text }}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{item.description}</Text>
                  ) : null}
                </View>
              </View>

              {item.fileName ? (
                <Chip icon="attachment" style={styles.chip} textStyle={{ fontSize: 11 }}>
                  {item.fileName}
                </Chip>
              ) : null}

              {item.createdAt && (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
                  Uploaded: {formatDate(item.createdAt)}
                </Text>
              )}
            </Card.Content>

            <Card.Actions style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' }}>
              <Button
                mode="contained-tonal"
                icon="download"
                buttonColor={isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight}
                textColor={colors.primaryDark}
                onPress={() => openOrDownloadFile(item.fileUrl, item.fileName || 'question_bank.pdf')}
              >
                Download Question Paper
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
  select: { marginBottom: 16, borderRadius: 10 },
  card: { marginBottom: 14, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  chip: { alignSelf: 'flex-start', marginTop: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});