import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Text, Button, Card, Switch, List, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { THEME_COLORS } from '../../src/constants';

export default function TeacherProfileScreen() {
  const router = useRouter();
  const { profile, logOut } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const uid = profile?.uid;

  const handleLogout = async () => {
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
            console.log('Logout error:', error);
          }
        },
      },
    ]);
  };

  if (!profile || !uid) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const nameInitials = (profile.name || 'Teacher')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* PROFILE CARD */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content style={styles.cardContent}>
          <Avatar.Text
            size={64}
            label={nameInitials}
            style={{ backgroundColor: colors.primary, marginBottom: 12 }}
            color="#FFFFFF"
          />
          <Text variant="titleLarge" style={{ fontWeight: '800', color: colors.text }}>
            {profile.name || 'Teacher'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>
            {profile.email || 'No email provided'}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: isDark ? colors.surfaceAccent : THEME_COLORS.primaryLight }]}>
            <MaterialCommunityIcons name="account-tie" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>TEACHER ACCOUNT</Text>
          </View>
        </Card.Content>
      </Card>

      {/* PREFERENCES SECTION */}
      <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
        <Card.Content style={{ paddingVertical: 4 }}>
          <List.Item
            title="Dark Theme Mode"
            titleStyle={{ color: colors.text, fontWeight: '600' }}
            description="Toggle app light & dark visual theme"
            descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
            left={(props) => <List.Icon {...props} icon="theme-light-dark" color={colors.primary} />}
            right={() => (
              <Switch value={isDark} onValueChange={toggleTheme} color={colors.primary} />
            )}
          />
        </Card.Content>
      </Card>

      {/* LOGOUT */}
      <Button
        mode="outlined"
        icon="logout"
        textColor={THEME_COLORS.danger}
        onPress={handleLogout}
        style={[styles.logoutBtn, { borderColor: THEME_COLORS.danger }]}
        contentStyle={{ paddingVertical: 6 }}
      >
        Log Out of AttendX
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 18, borderWidth: 1, marginBottom: 14 },
  cardContent: { alignItems: 'center', paddingVertical: 20 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  logoutBtn: { marginTop: 16, borderRadius: 12 },
});