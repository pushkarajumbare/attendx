import React, { useRef, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Text, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

function TabIconPill({ focused, activeName, inactiveName, color, tabActiveBg }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1 : 0.92,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [focused, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.tabPill,
        focused && { backgroundColor: tabActiveBg },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <MaterialCommunityIcons
        name={focused ? activeName : inactiveName}
        size={22}
        color={color}
      />
    </Animated.View>
  );
}

export default function StudentLayout() {
  const router = useRouter();
  const { user, loading, unreadNotifications } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const uid = user?.uid;

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const tabHeight = 62 + bottomPad;

  if (loading || !uid) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size={loading ? 'large' : 'small'} color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '800',
          fontSize: 18,
        },
        headerTintColor: colors.primary,
        headerRight: () => (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/(student)/notifications')}
              accessibilityLabel="Notifications"
              style={[
                styles.headerIconBtn,
                { backgroundColor: colors.primarySoft, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name={unreadNotifications > 0 ? 'bell-ring-outline' : 'bell-outline'}
                size={19}
                color={colors.primary}
              />
              {unreadNotifications > 0 && (
                <View style={[styles.badgeDot, { backgroundColor: colors.secondary || colors.primary }]}>
                  <Text style={styles.badgeText}>
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleTheme()}
              accessibilityLabel="Toggle dark mode"
              style={[
                styles.headerIconBtn,
                { backgroundColor: colors.primarySoft, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name={isDark ? 'weather-sunny' : 'weather-night'}
                size={19}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        ),
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? '#94A3B8' : '#64748B',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 3,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 5,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIconPill
              focused={focused}
              activeName="view-dashboard"
              inactiveName="view-dashboard-outline"
              color={color}
              tabActiveBg={colors.tabActiveBg}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <TabIconPill
              focused={focused}
              activeName="calendar-check"
              inactiveName="calendar-check-outline"
              color={color}
              tabActiveBg={colors.tabActiveBg}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, focused }) => (
            <TabIconPill
              focused={focused}
              activeName="notebook"
              inactiveName="notebook-outline"
              color={color}
              tabActiveBg={colors.tabActiveBg}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <TabIconPill
              focused={focused}
              activeName="clipboard-text"
              inactiveName="clipboard-text-outline"
              color={color}
              tabActiveBg={colors.tabActiveBg}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIconPill
              focused={focused}
              activeName="account-circle"
              inactiveName="account-circle-outline"
              color={color}
              tabActiveBg={colors.tabActiveBg}
            />
          ),
        }}
      />

      {/* Hidden routes in tab bar */}
      <Tabs.Screen name="face-register" options={{ href: null, title: 'Biometric Enrollment' }} />
      <Tabs.Screen name="join-class" options={{ href: null, title: 'Join Classroom' }} />
      <Tabs.Screen name="question-bank" options={{ href: null, title: 'Question Bank' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabPill: {
    minWidth: 44,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 14,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
