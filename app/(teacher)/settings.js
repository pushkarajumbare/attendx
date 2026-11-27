import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Card, Divider, Switch } from 'react-native-paper';
import { useAppTheme } from '../../src/context/ThemeContext';
import { FadeInView } from '../../src/components/FadeInView';
import { IconBadge } from '../../src/components/IconBadge';
import { ATTENDANCE } from '../../src/constants';

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useAppTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      <FadeInView>
        <View style={styles.headerRow}>
          <IconBadge name="cog-outline" size={24} boxSize={46} />
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>
              Preferences
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Theme, attendance geofence & system details
            </Text>
          </View>
        </View>

        <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
          <Card.Content style={{ paddingVertical: 6 }}>
            <List.Item
              title="Dark Appearance"
              titleStyle={{ color: colors.text, fontWeight: '700' }}
              description="Warm obsidian orange palette"
              descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
              left={(props) => <List.Icon {...props} icon="theme-light-dark" color={colors.primary} />}
              right={() => <Switch value={isDark} onValueChange={toggleTheme} color={colors.primary} />}
            />

            <Divider style={{ backgroundColor: colors.border }} />

            <List.Item
              title="Default Attendance Radius"
              titleStyle={{ color: colors.text, fontWeight: '600' }}
              description={`${ATTENDANCE.DEFAULT_RADIUS_METERS} meters geofence`}
              descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
              left={(props) => <List.Icon {...props} icon="map-marker-radius" color={colors.primary} />}
            />

            <Divider style={{ backgroundColor: colors.border }} />

            <List.Item
              title="Biometric Pipeline"
              titleStyle={{ color: colors.text, fontWeight: '600' }}
              description="Offline InsightFace + MediaPipe (256-D)"
              descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
              left={(props) => <List.Icon {...props} icon="face-recognition" color={colors.primary} />}
            />

            <Divider style={{ backgroundColor: colors.border }} />

            <List.Item
              title="App Version"
              titleStyle={{ color: colors.text, fontWeight: '600' }}
              description="AttendX v1.0.0"
              descriptionStyle={{ color: colors.textSecondary, fontSize: 12 }}
              left={(props) => <List.Icon {...props} icon="information-outline" color={colors.primary} />}
            />
          </Card.Content>
        </Card>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: { fontWeight: '800', letterSpacing: -0.3 },
  card: { borderRadius: 18, borderWidth: 1 },
});
