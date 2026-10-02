import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';

import { useAppTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function TeacherLayout() {
  const { profile, loading } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = profile?.uid;

  // 1. LOADING SCREEN
  if (loading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 2. AUTH GUARD
  if (!uid) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // 3. MAIN TABS
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="classrooms"
        options={{
          title: 'Classes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="google-classroom" size={size} color={color} />
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
        name="attendance-session"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="attendance-report"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
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

      {/* HIDDEN STACK SCREENS */}
      <Tabs.Screen name="create-classroom" options={{ href: null, title: 'Create Classroom' }} />
      <Tabs.Screen name="classroom-students" options={{ href: null, title: 'Enrolled Students' }} />
      <Tabs.Screen name="notes" options={{ href: null, title: 'Files & Notes' }} />
      <Tabs.Screen name="question-bank" options={{ href: null, title: 'Question Bank' }} />
      <Tabs.Screen name="announcements" options={{ href: null, title: 'Announcements' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
    </Tabs>
  );
}