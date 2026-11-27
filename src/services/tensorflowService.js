/**
 * AttendX Biometric Engine — Offline TensorFlow.js + MediaPipe FaceMesh + ArcFace MobileNet
 *
 * Pipeline:
 * 1. Offline bundled BlazeFace Short + MediaPipe FaceMesh (468 landmarks) for detection & alignment.
 * 2. Exact 5-point similarity transform (eyes, nose, mouth corners) -> 112x112 canonical ArcFace crop.
 * 3. Quality gates on aligned 112x112 face chip (brightness, contrast, gradient sharpness, size, pose).
 * 4. Offline InsightFace MobileNet-Emore CNN forward pass -> L2-normalized 256-D identity embedding.
 * 5. Pure cosine similarity matching (zero landmark-geometry fake embeddings, zero score inflation).
 */

import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import jpeg from 'jpeg-js';
import * as base64js from 'base64-js';
import { loadOfflineBiometricHandlers } from './modelLoader';

if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  require('@tensorflow/tfjs-react-native');
}

export const MODEL_VERSION = 'insightface-mobilenet-emore-v1';
export const EMBEDDING_DIMENSION = 256;
export const ALIGNED_FACE_SIZE = 112;

// Canonical InsightFace / ArcFace 112x112 5-point reference coordinates:
// [viewerLeftEye, viewerRightEye, noseTip, viewerLeftMouth, viewerRightMouth]
const ARCFACE_DST_112 = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

// Singleton engine state
let detectorInstance = null;
let recognizerInstance = null;
let initPromise = null;
let warmedUp = false;

// Cached working device camera orientation (0, 90, 180, 270)
let cachedDeviceRotation = null;

/**
 * Initialize TensorFlow.js, offline MediaPipe FaceMesh detector, and InsightFace recognizer.
 * Thread-safe singleton; safe to call multiple times or preload on app startup.
 */
export async function initializeTensorFlow() {
  if (detectorInstance && recognizerInstance) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const t0 = Date.now();
      await tf.ready();

      const backend = tf.getBackend();
      if (!backend) {
        await tf.setBackend('cpu');
      }

      const { detectorIO, landmarkIO, recognizerIO } = await loadOfflineBiometricHandlers();

      const [detector, recognizer] = await Promise.all([
        faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: 'tfjs',
            refineLandmarks: false,
            maxFaces: 4,
            detectorModelUrl: detectorIO,
            landmarkModelUrl: landmarkIO,
          }
        ),
        tf.loadGraphModel(recognizerIO),
      ]);

      detectorInstance = detector;
      recognizerInstance = recognizer;

      // Pre-compile WebGL / CPU kernels once during init so live scan is instant
      if (!warmedUp) {
        const warmupOut = tf.tidy(() => {
          const dummy = tf.zeros([1, ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE, 3], 'float32');
          return recognizerInstance.execute(dummy);
        });
        await warmupOut.data();
        warmupOut.dispose();
        warmedUp = true;
      }

      console.log(
        `[TF-Biometric] Offline engine ready on '${tf.getBackend()}' in ${Date.now() - t0}ms`
      );
      return true;
    } catch (error) {
      console.error('[TF-Biometric] Engine initialization failed:', error);
      detectorInstance = null;
      recognizerInstance = null;
      throw new Error(`Biometric engine load failed: ${error?.message || String(error)}`);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Non-throwing background warm-up helper for screens before camera opens.
 */
export async function preloadBiometricEngine() {
  try {
    await initializeTensorFlow();
    return true;
  } catch (err) {
    console.warn('[TF-Biometric] Background preload skipped:', err?.message);
    return false;
  }
}

export function isBiometricEngineReady() {
  return Boolean(detectorInstance && recognizerInstance);
}

/**
 * Release native / WebGL model tensors if explicitly resetting engine.
 */
export function disposeTensorFlow() {
  try {
    if (detectorInstance?.dispose) detectorInstance.dispose();
  } catch (_) {}
  try {
    if (recognizerInstance?.dispose) recognizerInstance.dispose();
  } catch (_) {}
  detectorInstance = null;
  recognizerInstance = null;
  warmedUp = false;
  cachedDeviceRotation = null;
}

/**
 * Convert base64 JPEG string directly to 3D Tensor [H, W, 3] in RAM.
 * @param {string} base64Str
 * @returns {tf.Tensor3D}
 */
export function base64ToTensor(base64Str) {
  try {
    let cleanBase64 = base64Str;
    const commaIdx = cleanBase64.indexOf(',');
    if (commaIdx !== -1) {
      cleanBase64 = cleanBase64.slice(commaIdx + 1);
    }
    const rawData = base64js.toByteArray(cleanBase64);
    const decoded = jpeg.decode(rawData, { useTArray: true });
    const { width, height, data } = decoded;

    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, p = 0; i < width * height; i++, p += 4) {
      rgb[i * 3] = data[p];
      rgb[i * 3 + 1] = data[p + 1];
      rgb[i * 3 + 2] = data[p + 2];
    }

    return tf.tensor3d(rgb, [height, width, 3], 'int32');
  } catch (err) {
    console.error('[TF-Biometric] Frame decode error:', err?.message);
    throw new Error(`Frame decoding failed: ${err?.message || String(err)}`);
  }
}

/**
 * Rotate a 3D RGB Tensor [H, W, 3] by 0, 90, 180, or 270 degrees clockwise.
 */
function rotateTensor(tensor, angle) {
  return tf.tidy(() => {
    if (angle === 90) {
      return tf.reverse(tf.transpose(tensor, [1, 0, 2]), [1]);
    }
    if (angle === 180) {
      return tf.reverse(tensor, [0, 1]);
    }
    if (angle === 270) {
      return tf.reverse(tf.transpose(tensor, [1, 0, 2]), [0]);
    }
    return tensor.clone();
  });
}

/**
 * Fast full-frame sanity check before running face detection.
 * @param {tf.Tensor3D} imageTensor
 */
export function analyzeFrameQuality(imageTensor) {
  return tf.tidy(() => {
    const [h, w] = imageTensor.shape;
    if (!h || !w || h < 64 || w < 64) {
      return { valid: false, reason: 'Camera resolution too low. Please try again.' };
    }
    const meanBrightness = tf.mean(imageTensor).dataSync()[0];
    if (meanBrightness < 12) {
      return { valid: false, reason: 'Lighting too dark. Move to a brighter area.' };
    }
    if (meanBrightness > 250) {
      return { valid: false, reason: 'Overexposed glare. Adjust lighting.' };
    }
    return { valid: true, meanBrightness };
  });
}

/**
 * Detect single face and extract 468 landmarks cleanly across hardware orientations.
 * Always resets MediaPipe temporal tracker so previous frames never produce ghost multi-faces.
 * Caller MUST dispose returned `orientedTensor` if `shouldDisposeTensor` is true.
 */
export async function getFaceLandmarks(imageTensor) {
  if (!detectorInstance || !recognizerInstance) {
    await initializeTensorFlow();
  }

  const candidateAngles =
    cachedDeviceRotation !== null
      ? [cachedDeviceRotation, 0, 270, 90, 180].filter((v, i, a) => a.indexOf(v) === i)
      : [0, 270, 90, 180];

  for (const angle of candidateAngles) {
    let evalTensor = null;
    const isRotated = angle !== 0;

    try {
      evalTensor = isRotated ? rotateTensor(imageTensor, angle) : imageTensor;

      // Reset temporal ROI cache so rapid head movements or separate scans never create ghost faces
      if (typeof detectorInstance.reset === 'function') {
        detectorInstance.reset();
      }

      const faces = await detectorInstance.estimateFaces(evalTensor, {
        flipHorizontal: false,
        staticImageMode: true,
      });

      if (faces && faces.length > 1) {
        if (isRotated && evalTensor) evalTensor.dispose();
        return { error: 'Multiple faces detected (Ensure only you are in frame)' };
      }

      if (faces && faces.length === 1) {
        const face = faces[0];
        const score = typeof face.score === 'number' ? face.score : face.box?.score ?? 1.0;

        if (score >= 0.5) {
          if (cachedDeviceRotation !== angle) {
            cachedDeviceRotation = angle;
          }
          return {
            face,
            orientation: angle,
            orientedTensor: evalTensor,
            shouldDisposeTensor: isRotated,
          };
        }
      }

      if (isRotated && evalTensor) {
        evalTensor.dispose();
      }
    } catch (err) {
      console.warn(`[TF-Biometric] Detection error at ${angle}°:`, err?.message);
      if (isRotated && evalTensor) {
        try {
          evalTensor.dispose();
        } catch (_) {}
      }
    }
  }

  return { error: 'No face detected. Center your face clearly in frame.' };
}

/**
 * Compute geometric pose, distance, eye openness (EAR), and 3D depth metrics.
 */
export function calculateLivenessMetrics(face, imageWidth = 480, imageHeight = 640) {
  const points = face?.keypoints;
  if (!points || points.length < 468) {
    return { valid: false, error: 'Incomplete facial landmarks detected' };
  }

  const noseTip = points[1] || { x: 0, y: 0, z: 0 };
  const leftEyeOuter = points[33] || { x: 0, y: 0, z: 0 };
  const rightEyeOuter = points[263] || { x: 0, y: 0, z: 0 };
  const leftEyeInner = points[133] || { x: 0, y: 0, z: 0 };
  const rightEyeInner = points[362] || { x: 0, y: 0, z: 0 };
  const leftMouth = points[61] || { x: 0, y: 0, z: 0 };
  const rightMouth = points[291] || { x: 0, y: 0, z: 0 };

  // Distance between outer eye corners
  const faceScale = Math.hypot(
    rightEyeOuter.x - leftEyeOuter.x,
    rightEyeOuter.y - leftEyeOuter.y
  );
  const eyeRatio = imageWidth > 0 ? faceScale / imageWidth : 0.3;

  if (faceScale < 28 || eyeRatio < 0.06) {
    return { valid: false, error: 'Move closer to the camera' };
  }
  if (eyeRatio > 0.82) {
    return { valid: false, error: 'Move slightly back from the camera' };
  }

  // Ensure key 5-point anchors are inside frame boundaries (avoid cropped/partial face)
  const keyCoords = [leftEyeOuter, rightEyeOuter, noseTip, leftMouth, rightMouth];
  for (const pt of keyCoords) {
    if (
      pt.x < imageWidth * 0.02 ||
      pt.x > imageWidth * 0.98 ||
      pt.y < imageHeight * 0.02 ||
      pt.y > imageHeight * 0.98
    ) {
      return { valid: false, error: 'Keep your full face inside the frame' };
    }
  }

  // Yaw calculation (Left / Right head turn)
  const distLeft = Math.hypot(noseTip.x - leftEyeInner.x, noseTip.y - leftEyeInner.y);
  const distRight = Math.hypot(noseTip.x - rightEyeInner.x, noseTip.y - rightEyeInner.y);
  const yaw = ((distLeft - distRight) / (distLeft + distRight || 1)) * 100;

  // Pitch proxy (normalized by eye distance so resolution-independent)
  const eyeMidY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const pitch = ((noseTip.y - eyeMidY) / (faceScale || 1)) * 100;

  // Head roll angle (degrees)
  const viewerLeftEye = leftEyeOuter.x <= rightEyeOuter.x ? leftEyeOuter : rightEyeOuter;
  const viewerRightEye = leftEyeOuter.x <= rightEyeOuter.x ? rightEyeOuter : leftEyeOuter;
  const roll =
    (Math.atan2(viewerRightEye.y - viewerLeftEye.y, viewerRightEye.x - viewerLeftEye.x) * 180) /
    Math.PI;

  // Eye Aspect Ratio (EAR) for blink / eye-openness signal
  const leftEyeHeight = Math.abs((points[159]?.y || 0) - (points[145]?.y || 0));
  const leftEyeWidth = Math.abs((points[133]?.x || 0) - (points[33]?.x || 1));
  const rightEyeHeight = Math.abs((points[386]?.y || 0) - (points[374]?.y || 0));
  const rightEyeWidth = Math.abs((points[263]?.x || 0) - (points[362]?.x || 1));
  const ear =
    (leftEyeHeight / (leftEyeWidth || 1) + rightEyeHeight / (rightEyeWidth || 1)) / 2;

  return {
    valid: true,
    yaw,
    pitch,
    roll,
    ear,
    faceScale,
    eyeRatio,
  };
}

/**
 * Validate whether face pose meets the capture stage requirements.
 */
export function validatePoseStage(metrics, stageId = 'front') {
  if (!metrics || !metrics.valid) {
    return { valid: false, error: metrics?.error || 'Face metrics unavailable' };
  }

  const { yaw = 0, roll = 0 } = metrics;

  if (Math.abs(roll) > 25) {
    return { valid: false, error: 'Hold your head upright and level' };
  }

  if (stageId === 'front' || stageId === 'center') {
    if (Math.abs(yaw) > 22) {
      return { valid: false, error: 'Look directly at the camera' };
    }
    return { valid: true };
  }

  if (stageId === 'left') {
    if (yaw > -10) {
      return { valid: false, error: 'Turn your head slightly to the left' };
    }
    if (yaw < -48) {
      return { valid: false, error: 'Do not turn too far left' };
    }
    return { valid: true };
  }

  if (stageId === 'right') {
    if (yaw < 10) {
      return { valid: false, error: 'Turn your head slightly to the right' };
    }
    if (yaw > 48) {
      return { valid: false, error: 'Do not turn too far right' };
    }
    return { valid: true };
  }

  // 'verify' or 'any': tolerate slight natural head angle while rejecting profile views
  if (Math.abs(yaw) > 26) {
    return { valid: false, error: 'Face the camera more directly' };
  }
  return { valid: true };
}

/**
 * Compute 2D similarity transform matrix mapping ArcFace target 5pts -> source image 5pts
 * for tf.image.transform (which performs inverse bilinear warping).
 */
function estimateSimilarityTransformDstToSrc(srcPts, dstPts) {
  const n = srcPts.length;
  let mx = 0;
  let my = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    mx += dstPts[i][0];
    my += dstPts[i][1];
    sx += srcPts[i][0];
    sy += srcPts[i][1];
  }
  mx /= n;
  my /= n;
  sx /= n;
  sy /= n;

  let denom = 0;
  let numCos = 0;
  let numSin = 0;
  for (let i = 0; i < n; i++) {
    const dx = dstPts[i][0] - mx;
    const dy = dstPts[i][1] - my;
    const ux = srcPts[i][0] - sx;
    const uy = srcPts[i][1] - sy;
    denom += dx * dx + dy * dy;
    numCos += dx * ux + dy * uy;
    numSin += dx * uy - dy * ux;
  }

  if (!denom) {
    return [1, 0, 0, 0, 1, 0, 0, 0];
  }

  const a0 = numCos / denom;
  const b0 = numSin / denom;
  const a1 = -b0;
  const b1 = a0;
  const a2 = sx - (a0 * mx + a1 * my);
  const b2 = sy - (b0 * mx + b1 * my);
  return [a0, a1, a2, b0, b1, b2, 0, 0];
}

function getFivePointsFromFaceMesh(face) {
  const kps = face.keypoints;
  const avg = (indices) => {
    let x = 0;
    let y = 0;
    for (const idx of indices) {
      x += kps[idx].x;
      y += kps[idx].y;
    }
    return [x / indices.length, y / indices.length];
  };

  const eyeA = avg([33, 133, 159, 145]);
  const eyeB = avg([362, 263, 386, 374]);
  const leftEye = eyeA[0] <= eyeB[0] ? eyeA : eyeB;
  const rightEye = eyeA[0] <= eyeB[0] ? eyeB : eyeA;
  const nose = [kps[1].x, kps[1].y];
  const mouthA = [kps[61].x, kps[61].y];
  const mouthB = [kps[291].x, kps[291].y];
  const leftMouth = mouthA[0] <= mouthB[0] ? mouthA : mouthB;
  const rightMouth = mouthA[0] <= mouthB[0] ? mouthB : mouthA;
  return [leftEye, rightEye, nose, leftMouth, rightMouth];
}

/**
 * Warp detected face onto canonical 112x112 ArcFace alignment template.
 * Returns Tensor4D [1, 112, 112, 3] in float32 [0..255]. Caller must dispose.
 */
export function alignFaceTensor112(imageTensor, face) {
  return tf.tidy(() => {
    const src5 = getFivePointsFromFaceMesh(face);
    const matrixValues = estimateSimilarityTransformDstToSrc(src5, ARCFACE_DST_112);
    const img4d = tf.expandDims(tf.cast(imageTensor, 'float32'), 0);
    return tf.image.transform(
      img4d,
      tf.tensor2d([matrixValues]),
      'bilinear',
      'nearest',
      0,
      [ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE]
    );
  });
}

/**
 * Quality check directly on the aligned 112x112 face chip (blur, exposure, contrast).
 */
export async function analyzeAlignedFaceQuality(alignedCrop112) {
  const statsTensor = tf.tidy(() => {
    const gray = tf.mean(tf.squeeze(alignedCrop112, 0), 2);
    const meanLum = tf.mean(gray);
    const { variance } = tf.moments(gray);
    const gx = tf.abs(
      tf.sub(tf.slice(gray, [0, 1], [ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE - 1]), tf.slice(gray, [0, 0], [ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE - 1]))
    );
    const gy = tf.abs(
      tf.sub(tf.slice(gray, [1, 0], [ALIGNED_FACE_SIZE - 1, ALIGNED_FACE_SIZE]), tf.slice(gray, [0, 0], [ALIGNED_FACE_SIZE - 1, ALIGNED_FACE_SIZE]))
    );
    const sharpMean = tf.add(tf.mean(gx), tf.mean(gy));
    return tf.stack([meanLum, tf.sqrt(variance), sharpMean]);
  });

  const [brightness, contrast, sharpness] = await statsTensor.data();
  statsTensor.dispose();

  if (brightness < 32) {
    return { valid: false, reason: 'Face lighting too dark. Move to a brighter area.' };
  }
  if (brightness > 238) {
    return { valid: false, reason: 'Face overexposed. Avoid harsh backlight or glare.' };
  }
  if (contrast < 16) {
    return { valid: false, reason: 'Face image lacks contrast. Adjust camera lighting.' };
  }
  if (sharpness < 7.2) {
    return { valid: false, reason: 'Face is blurred. Hold phone steady.' };
  }

  return { valid: true, brightness, contrast, sharpness };
}

/**
 * Generate L2-normalized 256-D identity embedding from an aligned 112x112 face tensor.
 * Uses (-1..1) normalization matching InsightFace MobileNet-Emore training.
 */
export async function createEmbeddingFromAlignedCrop(alignedCrop112) {
  if (!recognizerInstance) {
    await initializeTensorFlow();
  }

  const outTensor = tf.tidy(() => {
    const normalized = tf.sub(tf.div(alignedCrop112, 127.5), 1.0);
    const result = recognizerInstance.execute(normalized);
    return Array.isArray(result) ? result[0] : result;
  });

  const rawData = Array.from(await outTensor.data());
  outTensor.dispose();
  return normalizeEmbedding(rawData);
}

/**
 * Extract aligned face embedding directly from oriented image tensor + MediaPipe face object.
 */
export async function createFaceEmbedding(imageTensor, face) {
  const alignedCrop = alignFaceTensor112(imageTensor, face);
  try {
    return await createEmbeddingFromAlignedCrop(alignedCrop);
  } finally {
    alignedCrop.dispose();
  }
}

/**
 * Compute normalized centroid embedding from multiple sample embeddings.
 * @param {number[][]} embeddingsList
 * @returns {number[]}
 */
export function computeAverageEmbedding(embeddingsList) {
  if (!Array.isArray(embeddingsList) || embeddingsList.length === 0) return [];
  const dim = embeddingsList[0]?.length || 0;
  if (!dim) return [];
  const avg = new Array(dim).fill(0);

  for (const emb of embeddingsList) {
    if (!Array.isArray(emb) || emb.length !== dim) continue;
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }

  return normalizeEmbedding(avg);
}

/**
 * L2-normalize an embedding vector so cosine similarity lies in [-1, 1].
 * @param {number[]} embedding
 * @returns {number[]}
 */
export function normalizeEmbedding(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0) return [];
  let sumSq = 0;
  for (let i = 0; i < embedding.length; i++) {
    sumSq += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sumSq);
  if (!norm) return [];
  return embedding.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Process one camera frame into a validated L2-normalized 256-D face identity embedding.
 *
 * @param {string} base64Frame
 * @param {{ stageId?: string, requirePose?: boolean }} options
 */
export async function processFaceFrame(base64Frame, options = {}) {
  const { stageId = 'front', requirePose = true } = options;
  let imageTensor = null;
  let landmarkResult = null;
  let alignedCrop = null;

  try {
    if (!base64Frame || typeof base64Frame !== 'string' || base64Frame.length < 100) {
      return { success: false, error: 'Camera frame is empty. Please try again.' };
    }

    await initializeTensorFlow();
    imageTensor = base64ToTensor(base64Frame);

    const frameQuality = analyzeFrameQuality(imageTensor);
    if (!frameQuality.valid) {
      return { success: false, error: frameQuality.reason || 'Frame quality too low.' };
    }

    landmarkResult = await getFaceLandmarks(imageTensor);
    if (landmarkResult.error) {
      return { success: false, error: landmarkResult.error };
    }

    const workTensor = landmarkResult.orientedTensor;
    const imgH = workTensor.shape[0];
    const imgW = workTensor.shape[1];

    const metrics = calculateLivenessMetrics(landmarkResult.face, imgW, imgH);
    if (!metrics.valid) {
      return { success: false, error: metrics.error || 'Face check failed.' };
    }

    if (requirePose) {
      const pose = validatePoseStage(metrics, stageId);
      if (!pose.valid) {
        return { success: false, error: pose.error || 'Align your face in the frame.' };
      }
    }

    alignedCrop = alignFaceTensor112(workTensor, landmarkResult.face);
    const chipQuality = await analyzeAlignedFaceQuality(alignedCrop);
    if (!chipQuality.valid) {
      return { success: false, error: chipQuality.reason };
    }

    const embedding = await createEmbeddingFromAlignedCrop(alignedCrop);
    if (embedding.length !== EMBEDDING_DIMENSION) {
      return { success: false, error: 'Face embedding generation failed. Please try again.' };
    }

    const box = landmarkResult.face.box || {};
    return {
      success: true,
      embedding,
      metrics: {
        ...metrics,
        brightness: Number(chipQuality.brightness.toFixed(1)),
        sharpness: Number(chipQuality.sharpness.toFixed(2)),
      },
      orientation: landmarkResult.orientation,
      livenessPassed: true,
      modelVersion: MODEL_VERSION,
      faceBox: {
        x: (box.xMin ?? 0) / imgW,
        y: (box.yMin ?? 0) / imgH,
        width: (box.width ?? 0) / imgW,
        height: (box.height ?? 0) / imgH,
      },
      multipleFaces: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Local face processing failed.',
    };
  } finally {
    if (alignedCrop) {
      try {
        alignedCrop.dispose();
      } catch (_) {}
    }
    if (landmarkResult?.shouldDisposeTensor && landmarkResult.orientedTensor) {
      try {
        landmarkResult.orientedTensor.dispose();
      } catch (_) {}
    }
    if (imageTensor) {
      try {
        imageTensor.dispose();
      } catch (_) {}
    }
  }
}

/**
 * Euclidean distance between two embeddings. Lower indicates closer match.
 */
export function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return Infinity;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Cosine similarity between two vectors. Range [-1, 1], higher indicates closer match.
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return 0;
  return dot / denom;
}

/**
 * Compare two L2-normalized identity embeddings on an honest [0..100] cosine scale.
 * Returns 0 on mismatched lengths/models (no fake score inflation!).
 */
export function compareEmbeddings(embedding1, embedding2) {
  if (
    !Array.isArray(embedding1) ||
    !Array.isArray(embedding2) ||
    embedding1.length !== EMBEDDING_DIMENSION ||
    embedding2.length !== EMBEDDING_DIMENSION
  ) {
    return 0;
  }

  const cosSim = cosineSimilarity(embedding1, embedding2);
  if (!Number.isFinite(cosSim) || cosSim <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(cosSim * 100));
}
