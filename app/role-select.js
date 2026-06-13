import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ROLES } from '../src/constants';

export default function RoleSelectScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>AttendX</Text>
        <Text style={styles.subtitle}>Choose your role to continue</Text>
      </View>

      <Card style={styles.card} onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.TEACHER } })}>
        <Card.Content style={styles.cardContent}>
          <Text variant="headlineSmall" style={styles.cardTitle}>Teacher</Text>
          <Text variant="bodyMedium" style={styles.cardDesc}>
            Create classrooms, manage attendance sessions, upload notes & assignments
          </Text>
          <Button
            mode="contained"
            style={styles.btn}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.TEACHER } })}
          >
            Continue as Teacher
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card} onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.STUDENT } })}>
        <Card.Content style={styles.cardContent}>
          <Text variant="headlineSmall" style={styles.cardTitle}>Student</Text>
          <Text variant="bodyMedium" style={styles.cardDesc}>
            Join classrooms, mark verified attendance, access notes & assignments
          </Text>
          <Button
            mode="contained"
            buttonColor={COLORS.secondary}
            style={styles.btn}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: ROLES.STUDENT } })}
          >
            Continue as Student
          </Button>
        </Card.Content>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontWeight: '700',
    color: COLORS.text,
  },
  cardDesc: {
    color: COLORS.textSecondary,
    marginVertical: 12,
  },
  btn: {
    marginTop: 8,
  },
});
