import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function StudentLayout() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  // 1. Loading state
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 2. Auth guard
  if (!uid) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // 3. Main Tabs UI
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes & Files',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="notebook" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-text" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
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