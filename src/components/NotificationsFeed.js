import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import {
  clearAllUserNotifications,
  deleteUserNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import { formatDateTime } from '../utils/helpers';
import { THEME_COLORS } from '../constants';
import { EmptyState } from './EmptyState';
import { FadeInView } from './FadeInView';
import { IconBadge } from './IconBadge';

function getNotificationVisual(type, colors) {
  switch (type) {
    case 'attendance_start':
      return { icon: 'calendar-check', color: THEME_COLORS.success, bg: colors.successSurface };
    case 'attendance_ending':
      return { icon: 'clock-alert-outline', color: THEME_COLORS.warning, bg: colors.warningSurface };
    case 'attendance_end':
      return { icon: 'clock-check-outline', color: colors.primary, bg: colors.primarySoft };
    case 'assignment_uploaded':
      return { icon: 'clipboard-text-outline', color: colors.primary, bg: colors.primarySoft };
    case 'assignment_submitted':
    case 'assignment_confirmation':
      return { icon: 'check-decagram-outline', color: THEME_COLORS.success, bg: colors.successSurface };
    default:
      return { icon: 'bell-outline', color: colors.primary, bg: colors.primarySoft };
  }
}

export function NotificationsFeed({ role = 'student' }) {
  const router = useRouter();
  const { notifications, unreadNotifications } = useAuth();
  const { colors } = useAppTheme();

  const handlePressItem = async (item) => {
    if (!item.read) {
      markNotificationRead(item.notificationId);
    }

    const type = item.type;
    const classroomId = item.data?.classroomId || item.classroomId;

    if (role === 'student') {
      if (type === 'attendance_start' || type === 'attendance_ending' || type === 'attendance_end') {
        router.push(classroomId ? { pathname: '/(student)/attendance', params: { classroomId } } : '/(student)/attendance');
      } else if (type === 'assignment_uploaded' || type === 'assignment_confirmation') {
        router.push('/(student)/assignments');
      }
    } else {
      if (type === 'attendance_start' || type === 'attendance_ending' || type === 'attendance_end') {
        router.push('/(teacher)/attendance-session');
      } else if (type === 'assignment_submitted' || type === 'assignment_uploaded') {
        router.push('/(teacher)/assignments');
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeInView>
          <View style={styles.headerRow}>
            <IconBadge name="bell-ring-outline" size={22} boxSize={44} />
            <View style={{ flex: 1 }}>
              <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>
                Notifications
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {unreadNotifications > 0
                  ? `${unreadNotifications} unread update${unreadNotifications > 1 ? 's' : ''}`
                  : 'Attendance & task updates'}
              </Text>
            </View>
          </View>

          {notifications.length > 0 && (
            <View style={styles.actionsRow}>
              <Button
                mode="outlined"
                compact
                icon="check-all"
                textColor={colors.primary}
                style={{ borderColor: colors.primary, borderRadius: 10 }}
                disabled={unreadNotifications === 0}
                onPress={() => markAllNotificationsRead(notifications)}
              >
                Mark All Read
              </Button>
              <Button
                mode="text"
                compact
                icon="delete-sweep-outline"
                textColor={THEME_COLORS.danger}
                onPress={() => clearAllUserNotifications(notifications)}
              >
                Clear All
              </Button>
            </View>
          )}

          {notifications.length === 0 ? (
            <Card style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} mode="outlined">
              <Card.Content>
                <EmptyState
                  iconName="bell-check-outline"
                  title="You're All Caught Up"
                  subtitle="Attendance start/end alerts, task uploads, and submission updates will appear here."
                />
              </Card.Content>
            </Card>
          ) : (
            notifications.map((item) => {
              const vis = getNotificationVisual(item.type, colors);
              return (
                <TouchableOpacity
                  key={item.notificationId}
                  activeOpacity={0.85}
                  onPress={() => handlePressItem(item)}
                >
                  <Card
                    style={[
                      styles.notifCard,
                      {
                        backgroundColor: item.read ? colors.surface : colors.surfaceAccent,
                        borderColor: item.read ? colors.border : colors.primary,
                      },
                    ]}
                    mode="outlined"
                  >
                    <Card.Content style={styles.notifContent}>
                      <IconBadge
                        name={vis.icon}
                        size={20}
                        boxSize={40}
                        borderRadius={13}
                        color={vis.color}
                        backgroundColor={vis.bg}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={styles.notifTitleRow}>
                          <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={2}>
                            {item.title}
                          </Text>
                          {!item.read && (
                            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                          )}
                        </View>
                        {item.body ? (
                          <Text style={[styles.notifBody, { color: colors.textSecondary }]}>
                            {item.body}
                          </Text>
                        ) : null}
                        {item.createdAt ? (
                          <Text style={[styles.notifTime, { color: colors.textTertiary }]}>
                            {formatDateTime(item.createdAt)}
                          </Text>
                        ) : null}
                      </View>
                      <IconButton
                        icon="close"
                        size={16}
                        iconColor={colors.textSecondary}
                        onPress={() => deleteUserNotification(item.notificationId)}
                      />
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </FadeInView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { fontWeight: '800', letterSpacing: -0.3 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  card: { borderRadius: 18, borderWidth: 1 },
  notifCard: { borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  notifContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle: { flex: 1, fontWeight: '700', fontSize: 14 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  notifTime: { fontSize: 11, marginTop: 5 },
});
