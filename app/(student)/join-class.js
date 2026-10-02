import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { joinClassroom } from '../../src/services/classroomService';
import { THEME_COLORS } from '../../src/constants';

export default function JoinClassScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) {
      Alert.alert('Validation Error', 'Please enter a 6-character classroom code');
      return;
    }

    try {
      setLoading(true);
      const classroom = await joinClassroom(uid, code.trim());

      Alert.alert(
        'Successfully Enrolled! 🎉',
        `You have joined "${classroom.className}" (${classroom.subject || 'General'}).\n\nThis classroom is now permanently visible in your dashboard and notes.`,
        [
          {
            text: 'Go to Dashboard',
            onPress: () => router.replace('/(student)/dashboard'),
          },
        ]
      );
    } catch (error) {
      console.log('Join class error:', error);
      Alert.alert('Join Failed', error.message || 'Could not join classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="key-variant" size={38} color={colors.primary} />
          </View>
          <Text variant="titleLarge" style={[styles.title, { color: colors.text }]}>
            Join a Classroom
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the unique 6-character code provided by your teacher to enroll in their course and access notes & attendance.
          </Text>

          <TextInput
            label="Classroom Code *"
            placeholder="e.g. CS-9824"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={10}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
          />

          <Button
            mode="contained"
            icon="door-open"
            onPress={handleJoin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor={colors.primary}
            contentStyle={styles.buttonContent}
          >
            Enroll in Classroom
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, justifyContent: 'center' },
  card: { borderRadius: 18, borderWidth: 1, paddingVertical: 14 },
  cardContent: { alignItems: 'center' },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 13, marginBottom: 22, lineHeight: 20 },
  input: { width: '100%', marginBottom: 16, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  button: { width: '100%', borderRadius: 12 },
  buttonContent: { paddingVertical: 8 },
});