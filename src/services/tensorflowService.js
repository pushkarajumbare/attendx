import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-cpu';

let initialized = false;
let detector = null;

// =========================
// INIT
// =========================
export async function initializeTensorFlow() {
  try {
    if (initialized) {
      return true;
    }

    await tf.ready();

    detector =
      await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'mediapipe',
          solutionPath:
            'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
          refineLandmarks: true,
          maxFaces: 1,
        }
      );

    initialized = true;

    console.log('TensorFlow Ready');
    return true;
  } catch (error) {
    console.log(
      'TensorFlow Init Error:',
      error
    );

    return false;
  }
}

// =========================
// GET LANDMARKS
// =========================
export async function getFaceLandmarks(imageElement) {
  try {
    if (!initialized) {
      await initializeTensorFlow();
    }

    if (!detector) {
      return null;
    }

    const faces =
      await detector.estimateFaces(
        imageElement
      );

    if (!faces?.length) {
      return null;
    }

    return faces[0];
  } catch (error) {
    console.log(
      'Landmark error:',
      error
    );

    return null;
  }
}

// =========================
// HEAD DIRECTION
// =========================
export function detectHeadDirection(face) {
  try {
    const points =
      face?.keypoints;

    if (!points) {
      return 'unknown';
    }

    const leftEye =
      points[33];

    const rightEye =
      points[263];

    const nose =
      points[1];

    const centerX =
      (leftEye.x +
        rightEye.x) /
      2;

    const diff =
      nose.x - centerX;

    if (diff < -15) {
      return 'left';
    }

    if (diff > 15) {
      return 'right';
    }

    return 'front';
  } catch {
    return 'unknown';
  }
}

// =========================
// LOOK UP
// =========================
export function detectLookUp(face) {
  try {
    const nose =
      face?.keypoints?.[1];

    const forehead =
      face?.keypoints?.[10];

    if (!nose || !forehead) {
      return false;
    }

    return (
      nose.y - forehead.y >
      90
    );
  } catch {
    return false;
  }
}

// =========================
// BLINK
// =========================
export function detectBlink(face) {
  try {
    const top =
      face?.keypoints?.[159];

    const bottom =
      face?.keypoints?.[145];

    if (!top || !bottom) {
      return false;
    }

    const eyeGap =
      Math.abs(
        top.y - bottom.y
      );

    return eyeGap < 4;
  } catch {
    return false;
  }
}

// =========================
// FACE EMBEDDING
// =========================
export function createFaceEmbedding(face) {
  if (!face?.keypoints) {
    return [];
  }

  return face.keypoints
    .slice(0, 100)
    .flatMap((point) => [
      Number(
        point.x.toFixed(2)
      ),
      Number(
        point.y.toFixed(2)
      ),
    ]);
}

// =========================
// COMPARE EMBEDDINGS
// =========================
export function compareEmbeddings(
  a,
  b
) {
  if (
    !a?.length ||
    !b?.length
  ) {
    return 0;
  }

  let diff = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    diff += Math.abs(
      a[i] - b[i]
    );
  }

  return Math.max(
    0,
    100 - diff / 10
  );
}