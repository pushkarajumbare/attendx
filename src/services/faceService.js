
/**
 * AttendX on-device face template persistence and verification.
 *
 * Camera frames are processed locally by tensorflowService. Firestore stores only
 * the normalized numeric template, never raw/base64 face photos.
 */

import {
  doc,
  writeBatch,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { ATTENDANCE, COLLECTIONS } from '../constants';
import {
  EMBEDDING_DIMENSION,
  MODEL_VERSION,
  computeAverageEmbedding,
  compareEmbeddings,
  normalizeEmbedding,
} from './tensorflowService';

export const FACE_ANGLES = [
  {
    id: 'front',
    label: 'Front',
    instruction: 'Look straight at the camera',
    hint: 'Keep your face level and eyes open',
    icon: 'face-recognition',
  },
  {
    id: 'left',
    label: 'Left',
    instruction: 'Turn your head slightly to the left',
    hint: 'Keep your face inside the guide',
    icon: 'arrow-left',
  },
  {
    id: 'right',
    label: 'Right',
    instruction: 'Turn your head slightly to the right',
    hint: 'Keep your face inside the guide',
    icon: 'arrow-right',
  },
];

async function executeWithRetry(operation, retries = 3, delay = 800) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) throw error;

      const backoff = delay * Math.pow(2, attempt - 1);

      console.log(
        `Firestore operation retry ${attempt}/${retries} after ${backoff}ms:`,
        error?.message
      );

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

function coerceThreshold(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return ATTENDANCE.FACE_MATCH_THRESHOLD;
  }

  return numeric <= 1 ? Math.round(numeric * 100) : numeric;
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

/**
 * Register exactly 3 face samples:
 * Front → Left → Right
 *
 * Firestore does NOT allow nested arrays, so the individual embeddings
 * are stored as named fields instead of:
 *
 * samples: [
 *   [...],
 *   [...],
 *   [...]
 * ]
 *
 * New structure:
 *
 * samples: {
 *   front: [...],
 *   left: [...],
 *   right: [...]
 * }
 */
export async function registerFaceSamples(studentId, faceData) {
  try {
    if (!studentId) {
      throw new Error('Face registration error: Student ID context missing.');
    }

    if (!Array.isArray(faceData) || faceData.length !== FACE_ANGLES.length) {
      throw new Error(
        'Capture front, left, and right face samples before saving.'
      );
    }

    const embeddings = [];
    const sampleAngles = [];

    for (const requiredStage of FACE_ANGLES) {
      const sample = faceData.find(
        (entry) => entry?.angle === requiredStage.id
      );

      const embedding = sanitizeEmbedding(sample?.embedding);

      if (embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `The ${requiredStage.label.toLowerCase()} capture was invalid. Please retake registration.`
        );
      }

      embeddings.push(embedding);
      sampleAngles.push(requiredStage.id);
    }

    // embeddings[0] = Front
    // embeddings[1] = Left
    // embeddings[2] = Right
    const templateEmbedding = computeAverageEmbedding(embeddings);

    if (templateEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        'Could not create a stable face template. Please try again in better lighting.'
      );
    }

    const threshold = coerceThreshold(
      ATTENDANCE.FACE_MATCH_THRESHOLD
    );

    const faceDataRef = doc(
      db,
      COLLECTIONS.FACE_DATA,
      studentId
    );

    const studentRef = doc(
      db,
      COLLECTIONS.STUDENTS,
      studentId
    );

    const userRef = doc(
      db,
      COLLECTIONS.USERS,
      studentId
    );

    await executeWithRetry(async () => {
      const batch = writeBatch(db);

      batch.set(faceDataRef, {
        studentId,

        template: {
          // Average of Front + Left + Right
          embedding: templateEmbedding,

          // IMPORTANT:
          // Firestore-safe object containing 3 flat arrays.
          // No nested array is written.
          samples: {
            front: embeddings[0],
            left: embeddings[1],
            right: embeddings[2],
          },

          dimension: EMBEDDING_DIMENSION,
          sampleCount: embeddings.length,
          sampleAngles,
          modelVersion: MODEL_VERSION,
          matchThreshold: threshold,
        },

        faceRegistered: true,
        modelVersion: MODEL_VERSION,
        registeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(
        studentRef,
        {
          faceRegistered: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        userRef,
        {
          faceRegistered: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
    });

    return true;
  } catch (error) {
    console.error(
      '[FaceService] registerFaceSamples error:',
      error
    );

    throw new Error(
      error?.message || 'Face template synchronization failed.'
    );
  }
}

/**
 * Legacy/helper registration function.
 *
 * It creates the required 3-stage structure using the same normalized
 * embedding for each stage.
 */
export async function registerFaceEmbedding(studentId, embedding) {
  const normalized = sanitizeEmbedding(embedding);

  if (normalized.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      'Invalid face embedding. Please use guided face registration.'
    );
  }

  return registerFaceSamples(
    studentId,
    FACE_ANGLES.map((stage) => ({
      angle: stage.id,
      embedding: normalized,
    }))
  );
}

export async function verifyFace(studentId, capturedFace) {
  try {
    if (!studentId) {
      return {
        verified: false,
        confidence: 0,
        livenessPassed: false,
        reason: 'Student ID missing from verification request',
      };
    }

    if (!capturedFace?.livenessPassed) {
      return {
        verified: false,
        confidence: 0,
        livenessPassed: false,
        reason:
          capturedFace?.livenessReason ||
          'Liveness challenge failed. Please position your face as prompted.',
      };
    }

    const liveEmbedding = sanitizeEmbedding(
      capturedFace.embedding
    );

    if (liveEmbedding.length !== EMBEDDING_DIMENSION) {
      return {
        verified: false,
        confidence: 0,
        livenessPassed: true,
        reason: 'No valid live face embedding was captured',
      };
    }

    const docSnap = await executeWithRetry(() =>
      getDoc(
        doc(
          db,
          COLLECTIONS.FACE_DATA,
          studentId
        )
      )
    );

    if (!docSnap.exists()) {
      return {
        verified: false,
        confidence: 0,
        livenessPassed: true,
        reason:
          'No registered face record found. Please register your face first.',
      };
    }

    const faceData = docSnap.data();

    const templateEmbedding = sanitizeEmbedding(
      faceData?.template?.embedding ||
        faceData?.embedding
    );

    if (templateEmbedding.length !== EMBEDDING_DIMENSION) {
      return {
        verified: false,
        confidence: 0,
        livenessPassed: true,
        reason:
          'Registered face template is invalid. Please re-register your face.',
      };
    }

    // First compare against the averaged face template.
    let confidence = compareEmbeddings(
      templateEmbedding,
      liveEmbedding
    );

    /**
     * Also compare against individual registered samples.
     *
     * New Firestore format:
     *
     * samples: {
     *   front: [...],
     *   left: [...],
     *   right: [...]
     * }
     *
     * Object.values() converts this into:
     *
     * [
     *   [...front...],
     *   [...left...],
     *   [...right...]
     * ]
     *
     * Each individual item is still a flat embedding.
     */
    const storedSamplesObject =
      faceData?.template?.samples || {};

    const storedSamples = Object.values(
      storedSamplesObject
    )
      .map(sanitizeEmbedding)
      .filter(
        (sample) =>
          sample.length === EMBEDDING_DIMENSION
      );

    for (const sampleEmb of storedSamples) {
      const score = compareEmbeddings(
        sampleEmb,
        liveEmbedding
      );

      if (score > confidence) {
        confidence = score;
      }
    }

    const threshold = coerceThreshold(
      faceData?.template?.matchThreshold
    );

    const verified = confidence >= threshold;

    return {
      verified,
      confidence,
      livenessPassed: true,
      threshold,
      similarity: Number(
        (confidence / 100).toFixed(4)
      ),
      reason: verified
        ? 'Face identity matched'
        : `Face mismatch (${confidence}% similarity, threshold ${threshold}%)`,
    };
  } catch (error) {
    console.error(
      '[FaceService] verifyFace error:',
      error
    );

    return {
      verified: false,
      confidence: 0,
      livenessPassed: false,
      reason:
        'Face verification error: ' +
        (error?.message || 'Database error'),
    };
  }
}
