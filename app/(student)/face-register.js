import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { registerFaceSamples } from '../../src/services/faceService';
import { FaceCamera } from '../../src/components/FaceCamera';

export default function FaceRegisterScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const uid = profile?.uid;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // REAL BIO-METRIC CAPTURE HANDLER
  // ==========================================
  const handleFaceScanComplete = async (capturedSamples) => {
    try {
      if (!uid) {
        Alert.alert('Error', 'User account context missing. Cannot upload.');
        return;
      }

      setIsSubmitting(true);
      console.log(`Sending ${capturedSamples.length} real samples to faceService...`);

      // Transmit the verified landmark matrices down to Firebase
      const success = await registerFaceSamples(uid, capturedSamples);

      if (success) {
        // Sync profile state hooks instantly to reflect active registration status
        await refreshProfile?.();

        Alert.alert(
          'Registration Success',
          'Your multi-angle secure face template profile has been successfully generated.',
          [
            {
              text: 'Finish Setup',
              onPress: () => router.replace('/(student)/dashboard'),
            },
          ]
        );
      }
    } catch (error) {
      console.log('Real Registration Pipeline Crash:', error);
      Alert.alert(
        'Registration Failed',
        error?.message || 'Biometric upload pipeline timed out.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // USER CONTEXT SYNCHRONIZATION SCREENS
  // ==========================================
  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Syncing session profile...</Text>
      </View>
    );
  }

  if (isSubmitting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00FF00" />
        <Text style={styles.loadingText}>Encrypting biometrics & syncing nodes...</Text>
      </View>
    );
  }

  // ==========================================
  // RENDERING LIVE CAMERA SCAN OVERLAY
  // ==========================================
  return (
    <View style={styles.container}>
      <View style={styles.headerSpacer}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Biometric Alignment
        </Text>
      </View>

      {/* Connects directly to the automated multi-shot live engine */}
      <View style={styles.cameraFrame}>
        <FaceCamera onCapture={handleFaceScanComplete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Matches deep black for seamless camera views
  },
  headerSpacer: {
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderColor: '#222',
  },
  headerTitle: {
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cameraFrame: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 24,
  },
  loadingText: {
    color: '#AAA',
    marginTop: 15,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});