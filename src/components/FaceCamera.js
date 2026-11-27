import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { FACE_ANGLES } from '../services/faceService';
import {
  computeAverageEmbedding,
  cosineSimilarity,
  initializeTensorFlow,
  isBiometricEngineReady,
  processFaceFrame,
} from '../services/tensorflowService';
import { THEME_COLORS } from '../constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GUIDE_RADIUS = Math.min(SCREEN_WIDTH * 0.38, SCREEN_HEIGHT * 0.34);

const INITIAL_SETTLE_DELAY_MS = 280;
const INTER_STAGE_DELAY_MS = 220;
const RETRY_DELAY_MS = 420;
const MAX_VERIFY_FAILURES_BEFORE_PAUSE = 8;
const MAX_REGISTER_FAILURES_BEFORE_PAUSE = 10;

const VERIFY_STAGES = [
  {
    id: 'front',
    poseStage: 'front',
    label: 'Identity',
    instruction: 'Look at the camera',
    hint: 'Hold steady for fast face verification',
  },
  {
    id: 'verify',
    poseStage: 'verify',
    label: 'Live Check',
    instruction: 'Confirming live presence...',
    hint: 'Keep your face inside the oval',
  },
];

function selectOptimalPictureSize(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return undefined;

  const parsed = sizes
    .map((raw) => {
      const [wStr, hStr] = String(raw).split('x');
      const w = Number(wStr);
      const h = Number(hStr);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return { raw, w, h, shortSide: Math.min(w, h), area: w * h };
    })
    .filter(Boolean);

  if (parsed.length === 0) return undefined;

  // Prefer lowest resolution with shortSide >= 480 (e.g. 640x480) for ~20x faster decoding
  const ideal = parsed
    .filter((item) => item.shortSide >= 480 && item.shortSide <= 1080)
    .sort((a, b) => a.area - b.area);

  if (ideal.length > 0) return ideal[0].raw;

  const fallback = parsed.filter((item) => item.shortSide >= 360).sort((a, b) => a.area - b.area);
  return fallback[0]?.raw;
}

export function FaceCamera({ mode = 'register', onCapture, onCancel }) {
  const cameraRef = useRef(null);
  const isMountedRef = useRef(true);
  const autoCaptureTimerRef = useRef(null);
  const isCapturingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const failureCountRef = useRef(0);

  const stageIndexRef = useRef(0);
  const capturedSamplesRef = useRef([]);
  const verifyStageIndexRef = useRef(0);
  const verifyFirstFrameRef = useRef(null);
  const lastBase64SampleRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(() => isBiometricEngineReady());
  const [pictureSize, setPictureSize] = useState(undefined);

  const [stageIndex, setStageIndex] = useState(0);
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [stageStatus, setStageStatus] = useState('warming');
  const [verifyStageIdx, setVerifyStageIdx] = useState(0);
  const [verifyStatus, setVerifyStatus] = useState('warming');
  const [instruction, setInstruction] = useState('');
  const [guidance, setGuidance] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const flashColorRef = useRef('rgba(16, 185, 129, 0.35)');
  const onCaptureRef = useRef(onCapture);

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  const clearScheduledCapture = useCallback(() => {
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
  }, []);

  const triggerFlash = useCallback(
    (isSuccess = true) => {
      flashColorRef.current = isSuccess
        ? 'rgba(16, 185, 129, 0.32)'
        : 'rgba(239, 68, 68, 0.32)';
      flashAnim.setValue(0.85);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start();
    },
    [flashAnim]
  );

  // Initialize state, pulse animation, and ensure biometric engine is loaded once
  useEffect(() => {
    isMountedRef.current = true;
    isCompletedRef.current = false;
    isCapturingRef.current = false;
    failureCountRef.current = 0;
    stageIndexRef.current = 0;
    capturedSamplesRef.current = [];
    verifyStageIndexRef.current = 0;
    verifyFirstFrameRef.current = null;
    lastBase64SampleRef.current = null;

    setStageIndex(0);
    setCapturedSamples([]);
    setVerifyStageIdx(0);
    setErrorMsg('');

    if (mode === 'register') {
      setInstruction(FACE_ANGLES[0].instruction);
      setGuidance(FACE_ANGLES[0].hint);
      setStageStatus(isBiometricEngineReady() ? 'idle' : 'warming');
    } else {
      setInstruction(VERIFY_STAGES[0].instruction);
      setGuidance(VERIFY_STAGES[0].hint);
      setVerifyStatus(isBiometricEngineReady() ? 'preview' : 'warming');
    }

    let cancelled = false;
    if (!isBiometricEngineReady()) {
      initializeTensorFlow()
        .then(() => {
          if (!cancelled && isMountedRef.current) {
            setIsEngineReady(true);
            setStageStatus((prev) => (prev === 'warming' ? 'idle' : prev));
            setVerifyStatus((prev) => (prev === 'warming' ? 'preview' : prev));
          }
        })
        .catch((err) => {
          if (!cancelled && isMountedRef.current) {
            setErrorMsg(err?.message || 'Could not initialize on-device face engine.');
            setStageStatus('paused');
            setVerifyStatus('paused');
          }
        });
    } else {
      setIsEngineReady(true);
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1100, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: GUIDE_RADIUS * 2.1,
          duration: 1450,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 10,
          duration: 1450,
          useNativeDriver: true,
        }),
      ])
    );
    scanLoop.start();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      clearScheduledCapture();
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [mode, pulseAnim, scanLineAnim, clearScheduledCapture]);

  const handleCameraReady = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      if (cameraRef.current?.getAvailablePictureSizesAsync) {
        const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
        const chosen = selectOptimalPictureSize(sizes);
        if (chosen && isMountedRef.current) {
          setPictureSize(chosen);
        }
      }
    } catch (_) {
      // Fallback to default CameraView size cleanly if device query unavailable
    } finally {
      if (isMountedRef.current) {
        setIsCameraReady(true);
      }
    }
  }, []);

  const scheduleNextCapture = useCallback(
    (delayMs, captureFn) => {
      clearScheduledCapture();
      if (!isMountedRef.current || isCompletedRef.current) return;
      autoCaptureTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && !isCompletedRef.current) {
          captureFn();
        }
      }, delayMs);
    },
    [clearScheduledCapture]
  );

  const runCaptureStep = useCallback(async () => {
    if (
      !isMountedRef.current ||
      isCompletedRef.current ||
      isCapturingRef.current ||
      !isCameraReady ||
      !isEngineReady ||
      !cameraRef.current
    ) {
      return;
    }

    isCapturingRef.current = true;
    setErrorMsg('');

    let photoUri = null;
    try {
      const stageCfg =
        mode === 'register'
          ? FACE_ANGLES[stageIndexRef.current] || FACE_ANGLES[0]
          : VERIFY_STAGES[verifyStageIndexRef.current] || VERIFY_STAGES[0];

      if (mode === 'register') {
        setStageStatus('capturing');
      } else {
        setVerifyStatus('capturing');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.72,
        base64: true,
        skipProcessing: false,
      });
      photoUri = photo?.uri || null;

      if (!isMountedRef.current || isCompletedRef.current) return;

      if (!photo?.base64) {
        throw new Error('Empty frame from camera. Adjust lighting and retry.');
      }

      const frameRes = await processFaceFrame(photo.base64, {
        stageId: stageCfg.poseStage,
        requirePose: true,
      });

      if (!isMountedRef.current || isCompletedRef.current) return;

      if (!frameRes.success) {
        failureCountRef.current += 1;
        setErrorMsg(frameRes.error || 'Align your face inside the oval.');

        const maxFailures =
          mode === 'register' ? MAX_REGISTER_FAILURES_BEFORE_PAUSE : MAX_VERIFY_FAILURES_BEFORE_PAUSE;

        if (failureCountRef.current >= maxFailures) {
          triggerFlash(false);
          if (mode === 'register') setStageStatus('paused');
          else setVerifyStatus('paused');
          return;
        }

        if (mode === 'register') setStageStatus('error');
        else setVerifyStatus('preview');
        scheduleNextCapture(RETRY_DELAY_MS, runCaptureStep);
        return;
      }

      // Guard against frozen identical frame replay
      const currentDigest = `${photo.base64.length}:${photo.base64.slice(0, 64)}:${photo.base64.slice(-64)}`;
      if (lastBase64SampleRef.current === currentDigest) {
        failureCountRef.current += 1;
        setErrorMsg('Live frame unchanged. Blink or move slightly.');
        if (mode === 'register') setStageStatus('error');
        else setVerifyStatus('preview');
        scheduleNextCapture(RETRY_DELAY_MS, runCaptureStep);
        return;
      }
      lastBase64SampleRef.current = currentDigest;

      if (mode === 'register') {
        const existingSamples = capturedSamplesRef.current;
        if (existingSamples.length > 0) {
          const simWithAnchor = cosineSimilarity(
            existingSamples[0].embedding,
            frameRes.embedding
          );
          if (simWithAnchor < 0.42) {
            triggerFlash(false);
            stageIndexRef.current = 0;
            capturedSamplesRef.current = [];
            setStageIndex(0);
            setCapturedSamples([]);
            setErrorMsg('Face changed during capture. Restarting with only you in frame.');
            setInstruction(FACE_ANGLES[0].instruction);
            setGuidance(FACE_ANGLES[0].hint);
            setStageStatus('error');
            scheduleNextCapture(RETRY_DELAY_MS, runCaptureStep);
            return;
          }
        }

        failureCountRef.current = 0;
        triggerFlash(true);

        const nextSample = {
          angle: stageCfg.id,
          embedding: frameRes.embedding,
          metrics: frameRes.metrics,
        };
        const updatedSamples = [...existingSamples, nextSample];
        capturedSamplesRef.current = updatedSamples;
        setCapturedSamples(updatedSamples);

        const nextIdx = stageIndexRef.current + 1;
        if (nextIdx >= FACE_ANGLES.length) {
          isCompletedRef.current = true;
          setStageStatus('done');
          setInstruction('Face Registration Complete');
          setGuidance('Saving encrypted biometric vector...');
          if (typeof onCaptureRef.current === 'function') {
            onCaptureRef.current(updatedSamples);
          }
          return;
        }

        stageIndexRef.current = nextIdx;
        setStageIndex(nextIdx);
        setStageStatus('success');
        setInstruction(FACE_ANGLES[nextIdx].instruction);
        setGuidance(FACE_ANGLES[nextIdx].hint);
        scheduleNextCapture(INTER_STAGE_DELAY_MS, runCaptureStep);
      } else {
        // VERIFY MODE: 2 fast frames (~350-600ms apart) -> averaged high-SNR probe
        const verifyIdx = verifyStageIndexRef.current;

        if (verifyIdx === 0) {
          failureCountRef.current = 0;
          verifyFirstFrameRef.current = frameRes;
          verifyStageIndexRef.current = 1;
          setVerifyStageIdx(1);
          triggerFlash(true);
          setVerifyStatus('preview');
          setInstruction(VERIFY_STAGES[1].instruction);
          setGuidance(VERIFY_STAGES[1].hint);
          scheduleNextCapture(INTER_STAGE_DELAY_MS, runCaptureStep);
          return;
        }

        const firstFrame = verifyFirstFrameRef.current;
        if (!firstFrame) {
          verifyStageIndexRef.current = 0;
          setVerifyStageIdx(0);
          scheduleNextCapture(RETRY_DELAY_MS, runCaptureStep);
          return;
        }

        const intraScanConsistency = cosineSimilarity(
          firstFrame.embedding,
          frameRes.embedding
        );

        if (intraScanConsistency < 0.45) {
          failureCountRef.current += 1;
          verifyStageIndexRef.current = 0;
          verifyFirstFrameRef.current = null;
          setVerifyStageIdx(0);
          triggerFlash(false);
          setErrorMsg('Hold steady and keep only your face in view.');
          setInstruction(VERIFY_STAGES[0].instruction);
          setGuidance(VERIFY_STAGES[0].hint);
          setVerifyStatus('preview');
          scheduleNextCapture(RETRY_DELAY_MS, runCaptureStep);
          return;
        }

        failureCountRef.current = 0;
        const combinedEmbedding = computeAverageEmbedding([
          firstFrame.embedding,
          frameRes.embedding,
        ]);

        triggerFlash(true);
        isCompletedRef.current = true;
        setVerifyStatus('done');
        setInstruction('Face Captured');
        setGuidance('Verifying identity & location...');

        if (typeof onCaptureRef.current === 'function') {
          onCaptureRef.current({
            embedding: combinedEmbedding,
            livenessPassed: true,
            livenessChallenge: 'fast_dual_frame',
            livenessMetrics: {
              yawDelta: Number(
                Math.abs((frameRes.metrics?.yaw ?? 0) - (firstFrame.metrics?.yaw ?? 0)).toFixed(2)
              ),
              intraScanConsistency: Number(intraScanConsistency.toFixed(4)),
              brightness: frameRes.metrics?.brightness ?? null,
              sharpness: frameRes.metrics?.sharpness ?? null,
            },
            faceBox: frameRes.faceBox,
          });
        }
      }
    } catch (err) {
      if (!isMountedRef.current || isCompletedRef.current) return;
      failureCountRef.current += 1;
      setErrorMsg(err?.message || 'Camera capture interrupted. Retrying...');
      if (mode === 'register') setStageStatus('error');
      else setVerifyStatus('preview');

      if (failureCountRef.current < 6) {
        scheduleNextCapture(RETRY_DELAY_MS, runCaptureStep);
      } else {
        if (mode === 'register') setStageStatus('paused');
        else setVerifyStatus('paused');
      }
    } finally {
      isCapturingRef.current = false;
      if (photoUri) {
        FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
    }
  }, [isCameraReady, isEngineReady, mode, triggerFlash, scheduleNextCapture]);

  // Trigger initial fast auto-capture once both CameraView and TF.js engine are warmed up
  useEffect(() => {
    if (!isCameraReady || !isEngineReady || isCompletedRef.current) return;
    scheduleNextCapture(INITIAL_SETTLE_DELAY_MS, runCaptureStep);
  }, [isCameraReady, isEngineReady, scheduleNextCapture, runCaptureStep]);

  const handleManualRetry = useCallback(() => {
    clearScheduledCapture();
    isCompletedRef.current = false;
    isCapturingRef.current = false;
    failureCountRef.current = 0;
    lastBase64SampleRef.current = null;
    setErrorMsg('');

    if (mode === 'register') {
      stageIndexRef.current = 0;
      capturedSamplesRef.current = [];
      setStageIndex(0);
      setCapturedSamples([]);
      setStageStatus('idle');
      setInstruction(FACE_ANGLES[0].instruction);
      setGuidance(FACE_ANGLES[0].hint);
    } else {
      verifyStageIndexRef.current = 0;
      verifyFirstFrameRef.current = null;
      setVerifyStageIdx(0);
      setVerifyStatus('preview');
      setInstruction(VERIFY_STAGES[0].instruction);
      setGuidance(VERIFY_STAGES[0].hint);
    }

    scheduleNextCapture(200, runCaptureStep);
  }, [mode, clearScheduledCapture, scheduleNextCapture, runCaptureStep]);

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
        <MaterialCommunityIcons name="camera-off" size={64} color={THEME_COLORS.danger} />
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permDesc}>
          AttendX processes faces offline on your device. Camera access is needed to capture your face.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress =
    mode === 'register'
      ? Math.round((capturedSamples.length / FACE_ANGLES.length) * 100)
      : verifyStatus === 'done'
        ? 100
        : Math.round((verifyStageIdx / VERIFY_STAGES.length) * 100);

  const isBusyCapturing =
    (mode === 'register' && stageStatus === 'capturing') ||
    (mode === 'verify' && verifyStatus === 'capturing');

  const isPaused =
    (mode === 'register' && stageStatus === 'paused') ||
    (mode === 'verify' && verifyStatus === 'paused');

  let ringColor = THEME_COLORS.primary;
  if (stageStatus === 'done' || stageStatus === 'success' || verifyStatus === 'done') {
    ringColor = THEME_COLORS.success;
  } else if (stageStatus === 'error' || stageStatus === 'paused' || verifyStatus === 'paused' || errorMsg) {
    ringColor = THEME_COLORS.danger;
  } else if (isBusyCapturing) {
    ringColor = THEME_COLORS.warning;
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="front"
        mirror={false}
        animateShutter={false}
        pictureSize={pictureSize}
        onCameraReady={handleCameraReady}
      />

      <View style={styles.overlay} pointerEvents="none" />

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: flashColorRef.current, opacity: flashAnim },
        ]}
      />

      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {mode === 'register' ? 'FAST FACE ENROLLMENT' : 'FACE VERIFICATION'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {mode === 'register' ? (
          <View style={styles.stepper}>
            {FACE_ANGLES.map((step, idx) => {
              const done = idx < stageIndex || stageStatus === 'done';
              const active = idx === stageIndex && stageStatus !== 'done';
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
        ) : (
          <View style={styles.stepper}>
            {VERIFY_STAGES.map((step, idx) => {
              const done = idx < verifyStageIdx || verifyStatus === 'done';
              const active = idx === verifyStageIdx && verifyStatus !== 'done';
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
            {
              borderColor: ringColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={[styles.cross, styles.tl, { borderColor: ringColor }]} />
          <View style={[styles.cross, styles.tr, { borderColor: ringColor }]} />
          <View style={[styles.cross, styles.bl, { borderColor: ringColor }]} />
          <View style={[styles.cross, styles.br, { borderColor: ringColor }]} />
          {isEngineReady && !isPaused && (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  backgroundColor: ringColor,
                  transform: [{ translateY: scanLineAnim }],
                },
              ]}
            />
          )}
          {!isEngineReady && (
            <View style={styles.spinnerOverlay}>
              <ActivityIndicator size="large" color={THEME_COLORS.primary} />
            </View>
          )}
        </Animated.View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.hudCard}>
          <Text style={styles.instrText}>
            {!isEngineReady ? 'Preparing Offline Face Engine...' : instruction}
          </Text>
          <Text
            style={[
              styles.guidText,
              ringColor === THEME_COLORS.success && styles.guidTextSuccess,
              ringColor === THEME_COLORS.danger && styles.guidTextDanger,
            ]}
          >
            {errorMsg || guidance}
          </Text>

          {isPaused ? (
            <TouchableOpacity
              style={[styles.captureBtn, { backgroundColor: THEME_COLORS.primary }]}
              onPress={handleManualRetry}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#FFF" />
              <Text style={styles.captureBtnText}>Retry Face Scan</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.autoCapText}>
              {!isEngineReady
                ? 'Loading local model weights (offline)...'
                : isBusyCapturing
                  ? 'Analyzing on device...'
                  : mode === 'register'
                    ? `Auto-capturing sample ${Math.min(stageIndex + 1, FACE_ANGLES.length)} of ${FACE_ANGLES.length}...`
                    : 'Auto-scanning live face...'}
            </Text>
          )}
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
    backgroundColor: 'rgba(0,0,0,0.34)',
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cross: { position: 'absolute', width: 20, height: 20, borderColor: '#FFF' },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.72,
  },
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
    paddingBottom: 44,
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
  instrText: { color: '#FAFAF9', fontSize: 19, fontWeight: '700', textAlign: 'center' },
  guidText: { color: '#A8A29E', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  guidTextSuccess: { color: THEME_COLORS.success },
  guidTextDanger: { color: THEME_COLORS.danger },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 6,
    elevation: 4,
  },
  captureBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  autoCapText: { color: '#A8A29E', fontSize: 12, marginTop: 4 },
});
