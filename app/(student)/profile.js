import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Card,
  Switch,
  List,
  Divider,
  Avatar,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { THEME_COLORS } from '../../src/constants';

export default function StudentProfileScreen() {
  const router = useRouter();
  const { user, profile, logOut } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const uid = user?.uid;

  if (!uid) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of AttendX?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logOut();
            router.replace('/role-select');
          } catch (error) {
            Alert.alert('Error', 'Logout failed');
          }
        },
      },
    ]);
  };

  const nameInitials = (profile?.name || 'Student')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isRegistered = profile?.faceRegistered === true;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* PROFILE CARD */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Avatar.Text
            size={64}
            label={nameInitials}
            style={{ backgroundColor: colors.primary, marginBottom: 12 }}
            color="#FFFFFF"
          />
          <Text variant="titleLarge" style={{ fontWeight: '800', color: colors.text }}>
            {profile?.name || 'Student'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            {profile?.email || 'No email provided'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Chip
              icon="school-outline"
              style={{ backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }}
              textStyle={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}
            >
              STUDENT
            </Chip>

            <Chip
              icon={isRegistered ? 'check-decagram' : 'alert-circle-outline'}
              style={{ backgroundColor: isRegistered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}
              textStyle={{ color: isRegistered ? THEME_COLORS.success : THEME_COLORS.warning, fontWeight: '700', fontSize: 11 }}
            >
              {isRegistered ? 'FACE ENROLLED' : 'NOT ENROLLED'}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* SETTINGS CARD */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content style={{ paddingVertical: 4 }}>
          <List.Item
            title="Dark Theme Mode"
            titleStyle={{ color: colors.text, fontWeight: '600' }}
            description="Toggle app light & dark visual theme"
            descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
            left={(props) => <List.Icon {...props} icon="theme-light-dark" color={colors.primary} />}
            right={() => <Switch value={isDark} onValueChange={toggleTheme} color={colors.primary} />}
          />

          <Divider style={{ backgroundColor: colors.border }} />

          <List.Item
            title="Biometric Face Enrollment"
            titleStyle={{ color: colors.text, fontWeight: '600' }}
            description={isRegistered ? 'Update your 5-stage face template' : 'Enroll face biometrics to take attendance'}
            descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
            left={(props) => <List.Icon {...props} icon="face-recognition" color={colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
            onPress={() => router.push('/(student)/face-register')}
          />
        </Card.Content>
      </Card>

      {/* LOGOUT BUTTON */}
      <Button
        mode="outlined"
        icon="logout"
        textColor={THEME_COLORS.danger}
        style={[styles.logout, { borderColor: THEME_COLORS.danger }]}
        contentStyle={{ paddingVertical: 6 }}
        onPress={handleLogout}
      >
        Log Out of AttendX
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 18, borderWidth: 1, marginBottom: 14 },
  logout: { marginTop: 16, borderRadius: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});