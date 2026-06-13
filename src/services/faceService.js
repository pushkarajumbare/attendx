import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { COLLECTIONS } from '../constants';

// ===============================
// FACE ANGLES REQUIRED (MASTER DEFINITION)
// ===============================
export const FACE_ANGLES = [
  {
    id: 'front',
    label: 'Front Face',
    instruction: 'Look Straight',
  },
  {
    id: 'left',
    label: 'Left Face',
    instruction: 'Turn Left',
  },
  {
    id: 'right',
    label: 'Right Face',
    instruction: 'Turn Right',
  },
  {
    id: 'up',
    label: 'Look Up',
    instruction: 'Move Face Up',
  },
  {
    id: 'blink',
    label: 'Blink Eyes',
    instruction: 'Blink Your Eyes',
  },
];

// ===============================
// EMBEDDING COMPARISON (VECTOR CALCULATIONS)
// ===============================
function euclideanDistance(a, b) {
  if (!a?.length || !b?.length) {
    return 999;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

function compareEmbeddings(embedding1, embedding2) {
  const distance = euclideanDistance(embedding1, embedding2);
  
  // Maps a standard Euclidean face vector distance threshold back to a 0-100 score scale cleanly
  const similarity = Math.max(0, 100 - distance * 100);
  return similarity;
}

// ===============================
// REGISTER FACE SAMPLES
// ===============================
export async function registerFaceSamples(studentId, faceData) {
  try {
    if (!studentId) {
      throw new Error('Student ID missing');
    }

    if (!faceData || !faceData.length) {
      throw new Error('Face data missing');
    }

    // Filter array profiles containing legitimate generated mathematical tensor weights
    const validSamples = faceData.filter((sample) => sample?.embedding);

    // Dynamic assertion: requires at least 4 out of the 5 requested state targets to be saved
    if (validSamples.length < 4) {
      throw new Error(`Not enough face samples captured. Required: >=4, Received: ${validSamples.length}`);
    }

    // 1. Commit multi-angle tracking map profiles to FACE_DATA storage
    await setDoc(
      doc(db, COLLECTIONS.FACE_DATA, studentId),
      {
        studentId,
        samples: validSamples,
        totalSamples: validSamples.length,
        faceRegistered: true,
        registeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    // 2. Sync confirmation flags directly into global access profiles across core collections
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, studentId),
      { faceRegistered: true },
      { merge: true }
    );

    await setDoc(
      doc(db, COLLECTIONS.USERS, studentId),
      { faceRegistered: true },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.log('Register Face Error:', error);
    throw error;
  }
}

// ===============================
// VERIFY FACE
// ===============================
export async function verifyFace(studentId, capturedFace) {
  try {
    if (!capturedFace?.embedding) {
      return {
        verified: false,
        confidence: 0,
        liveness: 0,
        reason: 'Face not detected',
      };
    }

    const faceDoc = await getDoc(doc(db, COLLECTIONS.FACE_DATA, studentId));

    if (!faceDoc.exists()) {
      return {
        verified: false,
        confidence: 0,
        liveness: 0,
        reason: 'Face not registered',
      };
    }

    const savedData = faceDoc.data();
    const savedSamples = savedData?.samples || [];

    if (!savedSamples.length) {
      return {
        verified: false,
        confidence: 0,
        liveness: 0,
        reason: 'No face data found in database profile',
      };
    }

    let bestScore = 0;

    // Cross-verify matching accuracy metrics against all registered head positions
    for (const sample of savedSamples) {
      const score = compareEmbeddings(sample.embedding, capturedFace.embedding);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    // Standard threshold configuration: 75% match quality criteria required to mark attendance
    const verified = bestScore >= 75;

    return {
      verified,
      confidence: Math.round(bestScore),
      liveness: capturedFace?.blinked ? 100 : 80,
      reason: verified ? 'Face verified' : 'Face mismatch',
    };
  } catch (error) {
    console.log('Verify Error:', error);
    return {
      verified: false,
      confidence: 0,
      liveness: 0,
      reason: 'Verification fallback pipeline failed',
    };
  }
}