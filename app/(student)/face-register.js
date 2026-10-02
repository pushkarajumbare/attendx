import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { FaceCamera } from '../../src/components/FaceCamera';
import { registerFaceSamples } from '../../src/services/faceService';
import { THEME_COLORS } from '../../src/constants';

export default function FaceRegisterScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const uid = user?.uid;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const handleFaceScanComplete = async (samples) => {
    try {
      if (!uid) {
        Alert.alert('Authentication Error', 'Student account session not found. Please log in again.');
        return;
      }

      if (!Array.isArray(samples) || samples.length !== 3) {
        Alert.alert('Capture Error', 'Capture front, left, and right face samples before saving.');
        return;
      }

      setIsSubmitting(true);
      setSyncStatus('Creating on-device face template...');
      await new Promise((resolve) => setTimeout(resolve, 300));

      setSyncStatus('Saving face template...');
      const success = await registerFaceSamples(uid, samples);

      if (success) {
        setSyncStatus('Updating profile...');
        if (typeof refreshProfile === 'function') {
          await refreshProfile();
        }

        Alert.alert(
          'Registration Succeeded',
          'Your face template has been enrolled. You can now use Face Verification for attendance.',
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/(student)/dashboard'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('[FaceRegister] Submission error:', error);
      setIsSubmitting(false);
      setSyncStatus('');
      Alert.alert(
        'Registration Failed',
        error?.message || 'Could not register your face. Please try again.',
        [{ text: 'Retry' }]
      );
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading student credentials...
        </Text>
      </View>
    );
  }

  if (isSubmitting) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0C0A09' : '#FAF8F5' }]}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
        <Text style={[styles.syncTitle, { color: colors.text }]}>{syncStatus}</Text>
        <Text style={[styles.syncSubtext, { color: colors.textSecondary }]}>
          Please wait while your face template is saved securely.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FaceCamera mode="register" onCapture={handleFaceScanComplete} onCancel={handleCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 16, fontSize: 15, fontWeight: '500', textAlign: 'center' },
  syncTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8, textAlign: 'center' },
  syncSubtext: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
});
