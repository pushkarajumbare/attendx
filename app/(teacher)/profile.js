import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button, Card, Switch, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { COLORS } from '../../src/constants';

export default function TeacherProfileScreen() {
  const router = useRouter();
  const { profile, logOut } = useAuth();
  const { isDark, toggleTheme } = useAppTheme();

  const uid = profile?.uid;

  // Safe logout handler
  const handleLogout = async () => {
    try {
      await logOut();
      // Navigation happens automatically when user state changes in AuthContext
      router.replace('/role-select');
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  // 🔥 SAFE GUARD (prevents crashes)
  if (!profile || !uid) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* PROFILE CARD */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall">
            {profile?.name || 'Teacher'}
          </Text>
          <Text style={styles.email}>
            {profile?.email || 'No email'}
          </Text>
          <Text style={styles.role}>Teacher Account</Text>
        </Card.Content>
      </Card>

      {/* SETTINGS */}
      <List.Section>
        <List.Item
          title="Dark Mode"
          right={() => (
            <Switch value={isDark} onValueChange={toggleTheme} />
          )}
        />

        <List.Item
          title="Settings"
          left={(props) => <List.Icon {...props} icon="cog" />}
          onPress={() => router.push('/(teacher)/settings')}
        />
      </List.Section>

      {/* LOGOUT */}
      <Button
        mode="outlined"
        textColor={COLORS.danger}
        onPress={handleLogout}
        style={styles.logout}
      >
        Log Out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  card: {
    borderRadius: 16,
    marginBottom: 16,
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
});