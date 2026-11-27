/**
 * AttendX On-Device Face Template Persistence & Verification
 *
 * Camera frames are processed locally by tensorflowService (InsightFace MobileNet-Emore
 * aligned with MediaPipe FaceMesh). Firestore stores ONLY numeric L2-normalized
 * identity vectors, never raw/base64 photos.
 */

import {
  doc,
  writeBatch,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import { ATTENDANCE, COLLECTIONS } from '../constants';
import {
  EMBEDDING_DIMENSION,
  MODEL_VERSION,
  computeAverageEmbedding,
  compareEmbeddings,
  cosineSimilarity,
  normalizeEmbedding,
} from './tensorflowService';

// Fast 3-capture enrollment flow: high-accuracy frontal/near-frontal samples with liveness
export const FACE_ANGLES = [
  {
    id: 'front',
    poseStage: 'front',
    label: 'Center',
    instruction: 'Look straight at the camera',
    hint: 'Keep your face inside the oval',
    icon: 'face-recognition',
  },
  {
    id: 'liveness',
    poseStage: 'verify',
    label: 'Natural',
    instruction: 'Hold steady & blink or turn slightly',
    hint: 'Natural motion confirms a live face',
    icon: 'eye-check-outline',
  },
  {
    id: 'confirm',
    poseStage: 'front',
    label: 'Confirm',
    instruction: 'Hold steady for final capture',
    hint: 'Finishing fast face enrollment',
    icon: 'check-decagram-outline',
  },
];

// In-memory per-student template cache (cleared on logout/switch; never deletes Firestore records)
const faceTemplateCache = new Map();

async function executeWithRetry(operation, retries = 3, delay = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) throw error;
      const backoff = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

function getCalibratedCosineThreshold() {
  const configured = Number(ATTENDANCE.FACE_COSINE_THRESHOLD);
  if (Number.isFinite(configured) && configured >= 0.38 && configured <= 0.75) {
    return configured;
  }
  return 0.45;
}

function sanitizeEmbedding(value) {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSION) {
    return [];
  }
  if (!value.every((entry) => Number.isFinite(Number(entry)))) {
    return [];
  }
  return normalizeEmbedding(value.map(Number));
}

function requireCurrentStudentId(studentId) {
  const authenticatedUid = auth.currentUser?.uid;
  if (!authenticatedUid) {
    throw new Error('Authentication required: User session not found.');
  }
  if (studentId !== authenticatedUid) {
    throw new Error('Student identity mismatch with authenticated session.');
  }
  return authenticatedUid;
}

/**
 * Clears ONLY in-memory biometric caches when switching users or signing out.
 * Never deletes persisted Firestore enrollment templates!
 */
export function clearFaceTemplateState(studentId) {
  if (studentId) {
    faceTemplateCache.delete(studentId);
  } else {
    faceTemplateCache.clear();
  }
}

/**
 * Preload current student's persisted face template into memory before camera scan.
 */
export async function prefetchFaceTemplate(studentId) {
  try {
    if (!studentId || auth.currentUser?.uid !== studentId) return null;
    const snap = await getDoc(doc(db, COLLECTIONS.FACE_DATA, studentId));
    if (snap.exists()) {
      const data = snap.data();
      faceTemplateCache.set(studentId, data);
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[FaceService] Template prefetch skipped:', err?.message);
    return null;
  }
}

/**
 * Register 3 live face samples into Firestore (compatible with sampleCount == 3 rule).
 * Enforces intra-registration identity consistency across the 3 frames.
 */
export async function registerFaceSamples(studentId, faceData) {
  try {
    const authenticatedStudentId = requireCurrentStudentId(studentId);

    if (!Array.isArray(faceData) || faceData.length !== FACE_ANGLES.length) {
      throw new Error('Capture all 3 face samples before saving.');
    }

    const embeddings = [];
    const sampleAngles = [];

    for (const requiredStage of FACE_ANGLES) {
      const sample = faceData.find((entry) => entry?.angle === requiredStage.id);
      const embedding = sanitizeEmbedding(sample?.embedding);

      if (embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Invalid face capture (${requiredStage.label}). Please try again.`);
      }

      embeddings.push(embedding);
      sampleAngles.push(requiredStage.id);
    }

    // Verify all 3 registration samples come from the same person (anti-swap / anti-noise)
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const pairSim = cosineSimilarity(embeddings[i], embeddings[j]);
        if (pairSim < 0.38) {
          throw new Error(
            'Face captures were inconsistent. Keep only your face centered and steady during registration.'
          );
        }
      }
    }

    const templateEmbedding = computeAverageEmbedding(embeddings);
    if (templateEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error('Could not build a stable face template. Try again in clearer lighting.');
    }

    const cosineThreshold = getCalibratedCosineThreshold();
    const thresholdPercent = Math.round(cosineThreshold * 100);

    const faceDataRef = doc(db, COLLECTIONS.FACE_DATA, authenticatedStudentId);
    const studentRef = doc(db, COLLECTIONS.STUDENTS, authenticatedStudentId);
    const userRef = doc(db, COLLECTIONS.USERS, authenticatedStudentId);

    const persistedPayload = {
      studentId: authenticatedStudentId,
      template: {
        embedding: templateEmbedding,
        samples: {
          front: embeddings[0],
          liveness: embeddings[1],
          confirm: embeddings[2],
        },
        dimension: EMBEDDING_DIMENSION,
        sampleCount: embeddings.length,
        sampleAngles,
        modelVersion: MODEL_VERSION,
        cosineThreshold,
        matchThreshold: thresholdPercent,
      },
      faceRegistered: true,
      modelVersion: MODEL_VERSION,
      registeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await executeWithRetry(async () => {
      const batch = writeBatch(db);
      batch.set(faceDataRef, persistedPayload);
      batch.set(
        studentRef,
        { faceRegistered: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
      batch.set(
        userRef,
        { faceRegistered: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await batch.commit();
    });

    faceTemplateCache.set(authenticatedStudentId, persistedPayload);
    return true;
  } catch (error) {
    console.error('[FaceService] registerFaceSamples error:', error);
    throw new Error(error?.message || 'Face template synchronization failed.');
  }
}

export async function registerFaceEmbedding(studentId, embedding) {
  const normalized = sanitizeEmbedding(embedding);
  if (normalized.length !== EMBEDDING_DIMENSION) {
    throw new Error('Invalid face embedding. Please use guided face registration.');
  }
  return registerFaceSamples(
    studentId,
    FACE_ANGLES.map((stage) => ({
      angle: stage.id,
      embedding: normalized,
    }))
  );
}

/**
 * Pure core verification logic (testable both standalone and via Firestore wrapper).
 * Compares live probe embedding against persisted student centroid + sample consistency.
 */
export function matchFaceAgainstTemplate(faceData, capturedFace, authenticatedStudentId) {
  if (!capturedFace?.livenessPassed) {
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: false,
      reason:
        capturedFace?.livenessReason ||
        'Liveness check failed. Look directly at the camera and try again.',
    };
  }

  const liveEmbedding = sanitizeEmbedding(capturedFace.embedding);
  if (liveEmbedding.length !== EMBEDDING_DIMENSION) {
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: true,
      reason: 'No valid live face embedding captured.',
    };
  }

  if (!faceData) {
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: true,
      reason: 'No registered face record found. Please register your face first.',
    };
  }

  if (authenticatedStudentId && faceData.studentId !== authenticatedStudentId) {
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: true,
      reason: 'Registered face template does not belong to the authenticated student.',
    };
  }

  const storedVersion = faceData?.modelVersion || faceData?.template?.modelVersion;
  if (storedVersion !== MODEL_VERSION) {
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: true,
      requiresReRegistration: true,
      reason:
        'Your registered face uses an older version. Please re-register your face once (takes ~5 seconds).',
    };
  }

  const templateEmbedding = sanitizeEmbedding(
    faceData?.template?.embedding || faceData?.embedding
  );
  if (templateEmbedding.length !== EMBEDDING_DIMENSION) {
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: true,
      requiresReRegistration: true,
      reason: 'Registered face template is incomplete. Please re-register your face.',
    };
  }

  const centroidCosine = cosineSimilarity(templateEmbedding, liveEmbedding);
  const storedSamplesObj = faceData?.template?.samples || {};
  const storedSamples = Object.values(storedSamplesObj)
    .map(sanitizeEmbedding)
    .filter((s) => s.length === EMBEDDING_DIMENSION);

  let bestSampleCosine = centroidCosine;
  if (storedSamples.length > 0) {
    bestSampleCosine = Math.max(
      ...storedSamples.map((sampleEmb) => cosineSimilarity(sampleEmb, liveEmbedding))
    );
  }

  const cosineThreshold = getCalibratedCosineThreshold();
  const minSampleConsistency = ATTENDANCE.FACE_MIN_SAMPLE_CONSISTENCY ?? 0.36;
  const ambiguousFloor = ATTENDANCE.FACE_AMBIGUOUS_FLOOR ?? 0.36;

  // Enforce centroid match + individual reference sample consistency (prevents lucky outlier)
  const verified =
    centroidCosine >= cosineThreshold && bestSampleCosine >= minSampleConsistency;

  const confidence = compareEmbeddings(templateEmbedding, liveEmbedding);
  const thresholdPercent = Math.round(cosineThreshold * 100);

  let reason;
  if (verified) {
    reason = 'Face identity matched';
  } else if (centroidCosine >= ambiguousFloor) {
    reason = 'Face not matched confidently. Please try again.';
  } else {
    reason = `Face mismatch (${confidence}% match, required ${thresholdPercent}%)`;
  }

  return {
    verified,
    confidence,
    livenessPassed: true,
    threshold: thresholdPercent,
    similarity: Number(centroidCosine.toFixed(4)),
    bestSampleSimilarity: Number(bestSampleCosine.toFixed(4)),
    reason,
  };
}

/**
 * Verify a captured live face probe against the authenticated student's registered template.
 */
export async function verifyFace(studentId, capturedFace) {
  try {
    const authenticatedStudentId = requireCurrentStudentId(studentId);

    let faceData = faceTemplateCache.get(authenticatedStudentId);
    if (!faceData || faceData?.modelVersion !== MODEL_VERSION) {
      const docSnap = await executeWithRetry(() =>
        getDoc(doc(db, COLLECTIONS.FACE_DATA, authenticatedStudentId))
      );
      if (!docSnap.exists()) {
        return matchFaceAgainstTemplate(null, capturedFace, authenticatedStudentId);
      }
      faceData = docSnap.data();
      faceTemplateCache.set(authenticatedStudentId, faceData);
    }

    return matchFaceAgainstTemplate(faceData, capturedFace, authenticatedStudentId);
  } catch (error) {
    console.error('[FaceService] verifyFace error:', error);
    return {
      verified: false,
      confidence: 0,
      similarity: 0,
      livenessPassed: false,
      reason: `Face verification error: ${error?.message || 'Database error'}`,
    };
  }
}
