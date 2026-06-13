import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Card,
  Switch,
  List,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';

import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { COLORS } from '../../src/constants';

export default function StudentProfileScreen() {
  const router = useRouter();

  const { profile, logOut } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();

  // ==========================
  // MANDATORY GLOBAL GUARD
  // ==========================
  const uid = profile?.uid;

  if (!uid) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logOut();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Error', 'Logout failed');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
    >
      {/* PROFILE CARD */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.name}>
            {profile?.name || 'Student'}
          </Text>

          <Text style={styles.email}>
            {profile?.email || 'No email'}
          </Text>

          <Text style={styles.role}>Student Account</Text>
        </Card.Content>
      </Card>

      {/* SETTINGS CARD */}
      <Card style={styles.settingsCard}>
        <List.Section>
          <List.Item
            title="Dark Mode"
            description="Enable dark theme"
            left={(props) => (
              <List.Icon {...props} icon="theme-light-dark" />
            )}
            right={() => (
              <Switch value={isDark} onValueChange={toggleTheme} />
            )}
          />

          <Divider />

          <List.Item
            title="Notifications"
            description="Attendance reminders & alerts"
            left={(props) => (
              <List.Icon {...props} icon="bell" />
            )}
            onPress={() => router.push('/(student)/notifications')}
          />

          <Divider />

          <List.Item
            title="Face Registration"
            description={
              profile?.faceRegistered
                ? 'Registered'
                : 'Not Registered'
            }
            left={(props) => (
              <List.Icon {...props} icon="account-circle" />
            )}
            onPress={() => router.push('/(student)/face-register')}
          />
        </List.Section>
      </Card>

      {/* LOGOUT BUTTON */}
      <Button
        mode="outlined"
        textColor={COLORS.danger}
        style={styles.logout}
        onPress={handleLogout}
      >
        Log Out
      </Button>
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
    paddingBottom: 40,
  },

  card: {
    borderRadius: 16,
    marginBottom: 16,
  },

  settingsCard: {
    borderRadius: 16,
  },

  name: {
    fontWeight: '700',
  },

  email: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  role: {
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: '600',
  },

  logout: {
    marginTop: 24,
    borderColor: COLORS.danger,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});