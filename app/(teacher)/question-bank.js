import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { Text, Card, Button, TextInput, Menu } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getTeacherClassrooms } from '../../src/services/classroomService';
import {
  getQuestionBank,
  uploadQuestionBank
} from '../../src/services/contentService';
import { COLORS } from '../../src/constants';

export default function TeacherQuestionBankScreen() {
  const { profile } = useAuth();

  const uid = profile?.uid;

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔥 SAFE GUARD (prevents crash)
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;

      const load = async () => {
        try {
          const classes = await getTeacherClassrooms(uid);

          setClassrooms(classes);

          if (classes.length > 0) {
            setSelectedClass(classes[0]);

            const data = await getQuestionBank(classes[0].classroomId);
            setItems(data);
          }
        } catch (error) {
          console.log(error);
        }
      };

      load();
    }, [uid])
  );

  const handleUpload = async () => {
    if (!uid || !selectedClass) {
      Alert.alert('Error', 'Select classroom first');
      return;
    }
    if (!linkUrl) {
      Alert.alert('Error', 'Please paste a link to the question paper');
      return;
    }

    setLoading(true);

    try {
      await uploadQuestionBank(selectedClass.classroomId, uid, linkUrl, title);

      const updated = await getQuestionBank(selectedClass.classroomId);
      setItems(updated);

      setTitle('');
      setLinkUrl('');
      Alert.alert('Success', 'Question paper added');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 LOADING STATE
  if (!uid) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      
      {/* CLASS SELECTOR */}
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

              const data = await getQuestionBank(cls.classroomId);
              setItems(data);
            }}
          />
        ))}
      </Menu>

      {/* UPLOAD CARD */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Upload Question Paper</Text>

          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
          />

          <TextInput label="Link URL" value={linkUrl} onChangeText={setLinkUrl} mode="outlined" style={styles.input} />

          <Button mode="contained" icon="link" loading={loading} onPress={handleUpload}>
            Add Question Paper Link
          </Button>
        </Card.Content>
      </Card>

      {/* LIST */}
      {items.map((item) => (
        <Card key={item.qbId} style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">{item.title}</Text>
            <Text style={styles.meta}>{item.fileName}</Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  select: { marginBottom: 16 },
  card: { marginBottom: 12, borderRadius: 12 },
  input: { marginVertical: 12 },
  meta: { color: COLORS.textSecondary },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});