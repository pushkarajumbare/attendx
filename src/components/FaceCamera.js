import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { FACE_ANGLES } from '../services/faceService';
import { processFaceFrame } from '../services/tensorflowService';
import { THEME_COLORS } from '../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GUIDE_RADIUS = SCREEN_WIDTH * 0.38;
const VERIFY_AUTO_CAPTURE_DELAY = 2500;
const STAGE_SUCCESS_HOLD = 900;

const VERIFY_STAGES = [
  {
    id: 'front',
    label: 'Identity',
    instruction: 'Look straight at the camera',
    hint: 'Hold still for identity matching',
  },
  {
    id: 'right',
    label: 'Liveness',
    instruction: 'Turn your head slightly to the right',
    hint: 'Keep your face inside the guide',
  },
];

export function FaceCamera({ mode = 'register', onCapture, onCancel }) {
  const cameraRef = useRef(null);
  const isMountedRef = useRef(true);
  const autoCaptureTimerRef = useRef(null);
  const isCapturingRef = useRef(false);
  const stageIndexRef = useRef(0);
  const capturedSamplesRef = useRef([]);
  const verifyStageIndexRef = useRef(0);
  const verifyIdentityRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [stageStatus, setStageStatus] = useState('idle');
  const [verifyStatus, setVerifyStatus] = useState('preview');
  const [instruction, setInstruction] = useState('');
  const [guidance, setGuidance] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const flashColorRef = useRef('rgba(16, 185, 129, 0.35)');

  useEffect(() => {
    isMountedRef.current = true;
    stageIndexRef.current = 0;
    capturedSamplesRef.current = [];
    verifyStageIndexRef.current = 0;
    verifyIdentityRef.current = null;
    setStageIndex(0);
    setCapturedSamples([]);
    setStageStatus('idle');
    setVerifyStatus('preview');
    setErrorMsg('');

    if (mode === 'register') {
      setInstruction(FACE_ANGLES[0].instruction);
      setGuidance(FACE_ANGLES[0].hint);
    } else {
      setInstruction(VERIFY_STAGES[0].instruction);
      setGuidance(VERIFY_STAGES[0].hint);
    }

    return () => {
      isMountedRef.current = false;
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [mode]);

  const triggerFlash = useCallback(
    (isSuccess) => {
      flashColorRef.current = isSuccess
        ? 'rgba(16, 185, 129, 0.45)'
        : 'rgba(239, 68, 68, 0.45)';
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      if (isSuccess) {
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 120, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 180, useNativeDriver: true }),
        ]).start();
      }
    },
    [flashAnim, pulseAnim]
  );

  const handleRegistrationCapture = useCallback(
    async (analysis) => {
      const currentIndex = stageIndexRef.current;
      const currentStage = FACE_ANGLES[currentIndex];
      const sample = {
        angle: currentStage.id,
        embedding: analysis.embedding,
        metrics: analysis.metrics,
      };
      const updatedSamples = [...capturedSamplesRef.current, sample];

      capturedSamplesRef.current = updatedSamples;
      setCapturedSamples(updatedSamples);
      setStageStatus('success');
      setInstruction(`${currentStage.label} saved`);
      setGuidance('Good capture. Hold steady...');
      setErrorMsg('');
      console.log('[FaceCamera] Capture success for stage:', currentStage?.id, 'index:', currentIndex);
      triggerFlash(true);

      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!isMountedRef.current) return;

      const nextIndex = currentIndex + 1;
      if (nextIndex >= FACE_ANGLES.length) {
        console.log('[FaceCamera] All registration stages complete. Invoking onCapture.');
        setInstruction('Registration complete');
        setGuidance('Saving your face template...');
        setTimeout(() => {
          if (isMountedRef.current && onCapture) {
            onCapture(updatedSamples);
          }
        }, 300);
        return;
      }

      console.log('[FaceCamera] Advancing to stage:', nextIndex, FACE_ANGLES[nextIndex]?.label);
      stageIndexRef.current = nextIndex;
      setStageIndex(nextIndex);
      setStageStatus('idle');
      setInstruction(FACE_ANGLES[nextIndex].instruction);
      setGuidance(FACE_ANGLES[nextIndex].hint);
    },
    [onCapture, triggerFlash]
  );

  const handleVerificationCapture = useCallback(
    async (analysis) => {
      const currentIndex = verifyStageIndexRef.current;
      const currentStage = VERIFY_STAGES[currentIndex];

      triggerFlash(true);
      setErrorMsg('');

      if (currentIndex === 0) {
        verifyIdentityRef.current = {
          embedding: analysis.embedding,
          metrics: analysis.metrics,
        };
        verifyStageIndexRef.current = 1;
        setVerifyStatus('preview');
        setInstruction(VERIFY_STAGES[1].instruction);
        setGuidance(VERIFY_STAGES[1].hint);
        return;
      }

      setVerifyStatus('done');
      setInstruction('Verifying identity...');
      setGuidance('Matching against your registered template');

      setTimeout(() => {
        if (isMountedRef.current && onCapture) {
          onCapture({
            embedding: verifyIdentityRef.current?.embedding || analysis.embedding,
            livenessPassed: true,
            livenessChallenge: currentStage.id,
            livenessMetrics: analysis.metrics,
          });
        }
      }, 350);
    },
    [onCapture, triggerFlash]
  );

  const doCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturingRef.current || !isMountedRef.current) return;
    isCapturingRef.current = true;
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }

    try {
      if (mode === 'register') {
        setStageStatus('capturing');
      } else {
        setVerifyStatus('capturing');
      }
      setInstruction('Capturing...');
      setGuidance('Hold still');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        base64: true,
        skipProcessing: Platform.OS === 'android',
      });

      if (!isMountedRef.current) return;
      if (!photo?.base64 || photo.base64.length < 100) {
        throw new Error('Camera returned an empty frame. Please try again.');
      }

      if (photo.uri) {
        FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
      }

      const currentStage =
        mode === 'register'
          ? FACE_ANGLES[stageIndexRef.current]
          : VERIFY_STAGES[verifyStageIndexRef.current];

      console.log(`[FaceCamera] Processing frame for stage: ${currentStage?.id} (mode: ${mode})`);

      const analysis = await processFaceFrame(photo.base64, {
        stageId: currentStage?.id || 'front',
        requirePose: true,
      });

      console.log('[FaceCamera] processFaceFrame result:', { success: analysis.success, error: analysis.error });

      if (!analysis.success) {
        throw new Error(analysis.error || 'Face check failed. Please try again.');
      }

      if (mode === 'register') {
        await handleRegistrationCapture(analysis);
      } else {
        await handleVerificationCapture(analysis);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = err?.message || 'Capture failed. Please try again.';
      console.warn('[FaceCamera] Capture caught error:', msg);
      setErrorMsg(msg);
      if (mode === 'register') {
        setStageStatus('error');
        const currentStage = FACE_ANGLES[stageIndexRef.current] || FACE_ANGLES[0];
        setInstruction(currentStage.instruction);
        setGuidance(currentStage.hint);
      } else {
        setVerifyStatus('preview');
        const currentStage = VERIFY_STAGES[verifyStageIndexRef.current] || VERIFY_STAGES[0];
        setInstruction(currentStage.instruction);
        setGuidance(currentStage.hint);
      }
      triggerFlash(false);
    } finally {
      isCapturingRef.current = false;
    }
  }, [mode, triggerFlash, handleRegistrationCapture, handleVerificationCapture]);

  useEffect(() => {
    if (mode !== 'verify' || !isCameraReady || verifyStatus !== 'preview') return;

    autoCaptureTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isCapturingRef.current) {
        doCapture();
      }
    }, VERIFY_AUTO_CAPTURE_DELAY);

    return () => {
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [isCameraReady, verifyStatus, mode, doCapture]);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    if (mode === 'register') {
      const currentStage = FACE_ANGLES[stageIndexRef.current] || FACE_ANGLES[0];
      setStageStatus('idle');
      setInstruction(currentStage.instruction);
      setGuidance(currentStage.hint);
      return;
    }

    const currentStage = VERIFY_STAGES[verifyStageIndexRef.current] || VERIFY_STAGES[0];
    setVerifyStatus('preview');
    setInstruction(currentStage.instruction);
    setGuidance(currentStage.hint);
  }, [mode]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera-off" size={56} color={THEME_COLORS.danger} />
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permDesc}>
          AttendX needs camera access for local face verification.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
        {onCancel && (
          <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const ringColor =
    stageStatus === 'success' || verifyStatus === 'done'
      ? THEME_COLORS.success
      : stageStatus === 'error'
      ? THEME_COLORS.danger
      : stageStatus === 'capturing' || verifyStatus === 'capturing'
      ? THEME_COLORS.warning
      : THEME_COLORS.primary;

  const isCapturing = stageStatus === 'capturing' || verifyStatus === 'capturing';
  const showCapture =
    mode === 'register'
      ? isCameraReady && (stageStatus === 'idle' || stageStatus === 'error')
      : isCameraReady && verifyStatus === 'preview';
  const progress =
    mode === 'register'
      ? Math.round((capturedSamples.length / FACE_ANGLES.length) * 100)
      : verifyStatus === 'done'
      ? 100
      : verifyStageIndexRef.current === 1
      ? 65
      : 25;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="front"
        animateShutter={false}
        onCameraReady={() => setIsCameraReady(true)}
      />

      <View style={styles.overlay} pointerEvents="none" />

      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: flashColorRef.current, opacity: flashAnim },
        ]}
        pointerEvents="none"
      />

      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {mode === 'register' ? 'FACE REGISTRATION' : 'FACE VERIFICATION'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {mode === 'register' && (
          <View style={styles.stepper}>
            {FACE_ANGLES.map((step, idx) => {
              const done = idx < stageIndex;
              const active = idx === stageIndex;
              return (
                <View key={step.id} style={styles.stepItem}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                    {done ? (
                      <MaterialCommunityIcons name="check" size={11} color="#FFF" />
                    ) : (
                      <Text style={[styles.dotNum, active && styles.dotNumActive]}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {mode === 'verify' && (
          <View style={styles.stepper}>
            {VERIFY_STAGES.map((step, idx) => {
              const done = idx < verifyStageIndexRef.current || verifyStatus === 'done';
              const active = idx === verifyStageIndexRef.current && verifyStatus !== 'done';
              return (
                <View key={step.id} style={styles.stepItem}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                    {done ? (
                      <MaterialCommunityIcons name="check" size={11} color="#FFF" />
                    ) : (
                      <Text style={[styles.dotNum, active && styles.dotNumActive]}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.guideWrapper} pointerEvents="none">
        <Animated.View
          style={[
            styles.ring,
            { borderColor: ringColor, transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={[styles.cross, styles.tl]} />
          <View style={[styles.cross, styles.tr]} />
          <View style={[styles.cross, styles.bl]} />
          <View style={[styles.cross, styles.br]} />
          {isCapturing && (
            <View style={styles.spinnerOverlay}>
              <ActivityIndicator size="large" color={THEME_COLORS.warning} />
            </View>
          )}
        </Animated.View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.hudCard}>
          <Text style={styles.instrText}>{instruction}</Text>
          <Text
            style={[
              styles.guidText,
              ringColor === THEME_COLORS.success && styles.guidTextSuccess,
              ringColor === THEME_COLORS.danger && styles.guidTextDanger,
            ]}
          >
            {errorMsg || guidance}
          </Text>

          {showCapture && (
            <TouchableOpacity
              style={[styles.captureBtn, { backgroundColor: THEME_COLORS.primary }]}
              onPress={doCapture}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="camera" size={22} color="#FFF" />
              <Text style={styles.captureBtnText}>
                {mode === 'register'
                  ? `Capture ${FACE_ANGLES[stageIndex]?.label}`
                  : `Capture ${VERIFY_STAGES[verifyStageIndexRef.current]?.label || 'Face'}`}
              </Text>
            </TouchableOpacity>
          )}

          {((stageStatus === 'error' && mode === 'register') || (errorMsg && mode === 'verify')) && (
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          )}

          {verifyStatus === 'preview' && mode === 'verify' && (
            <Text style={styles.autoCapText}>
              {verifyStageIndexRef.current === 0
                ? 'Auto-capturing identity...'
                : 'Auto-capturing liveness...'}
            </Text>
          )}

          {isCapturing && <Text style={styles.autoCapText}>Processing on device...</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0C0A09',
    padding: 28,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  permTitle: { color: '#FAFAF9', fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  permDesc: { color: '#A8A29E', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { backgroundColor: THEME_COLORS.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  cancelLink: { marginTop: 16, padding: 8 },
  cancelLinkText: { color: '#A8A29E', fontSize: 14, fontWeight: '600' },
  topSection: { position: 'absolute', top: 50, left: 16, right: 16, zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: {
    backgroundColor: 'rgba(249,115,22,0.20)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME_COLORS.primary,
  },
  badgeText: { color: THEME_COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: 'rgba(12,10,9,0.75)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stepItem: { alignItems: 'center', flex: 1 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dotActive: { backgroundColor: THEME_COLORS.primary, borderWidth: 2, borderColor: '#FFF' },
  dotDone: { backgroundColor: THEME_COLORS.success },
  dotNum: { color: '#A8A29E', fontSize: 10, fontWeight: '700' },
  dotNumActive: { color: '#FFF' },
  stepLabel: { color: '#78716C', fontSize: 9, fontWeight: '600' },
  stepLabelActive: { color: THEME_COLORS.primary, fontWeight: '700' },
  progressBg: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: THEME_COLORS.primary, borderRadius: 2 },
  guideWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  ring: {
    width: GUIDE_RADIUS * 2,
    height: GUIDE_RADIUS * 2.3,
    borderRadius: GUIDE_RADIUS,
    borderWidth: 3.5,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cross: { position: 'absolute', width: 18, height: 18, borderColor: '#FFF' },
  tl: { top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2 },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 48,
    zIndex: 10,
  },
  hudCard: {
    backgroundColor: 'rgba(12,10,9,0.88)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    gap: 8,
  },
  instrText: { color: '#FAFAF9', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  guidText: { color: '#A8A29E', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  guidTextSuccess: { color: THEME_COLORS.success },
  guidTextDanger: { color: THEME_COLORS.danger },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
    elevation: 4,
  },
  captureBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  retryBtn: { marginTop: 4, padding: 10 },
  retryBtnText: { color: THEME_COLORS.warning, fontSize: 14, fontWeight: '600' },
  autoCapText: { color: '#78716C', fontSize: 12, marginTop: 4 },
});
