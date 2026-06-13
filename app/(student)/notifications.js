import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { EmptyState } from '../../src/components/EmptyState';
import { COLORS } from '../../src/constants';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={styles.title}>
          Notifications
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <EmptyState
              title="No Notifications Yet"
              subtitle="Assignment alerts, attendance reminders, and announcements will appear here via FCM"
            />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
  },
});