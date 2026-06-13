import { View, StyleSheet } from 'react-native';
import { Text, List } from 'react-native-paper';
import { COLORS } from '../../src/constants';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <List.Section>

        <List.Subheader>AttendX Settings</List.Subheader>

        <List.Item
          title="Default Attendance Radius"
          description="50 meters"
          left={(props) => (
            <List.Icon {...props} icon="map-marker-radius" />
          )}
        />

        <List.Item
          title="Notifications"
          description="Enabled"
          left={(props) => (
            <List.Icon {...props} icon="bell" />
          )}
        />

        <List.Item
          title="App Version"
          description="1.0.0"
          left={(props) => (
            <List.Icon {...props} icon="information" />
          )}
        />

      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});