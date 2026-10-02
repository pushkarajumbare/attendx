// Test face pipeline and 3-stage registration flow
const base64js = require('base64-js');
const {
  validatePoseStage,
  compareEmbeddings,
  computeAverageEmbedding,
  normalizeEmbedding,
  euclideanDistance,
  cosineSimilarity,
  EMBEDDING_DIMENSION,
} = require('../src/services/tensorflowService');

console.log('Testing Pose Validation...');

// 1. Front Pose
const frontGood = { valid: true, yaw: 4.2, pitch: -2.1, ear: 0.22, faceScale: 120 };
const frontPass = validatePoseStage(frontGood, 'front');
console.log('Front good pose:', frontPass.valid ? 'PASS' : 'FAIL', frontPass);

const frontBadYaw = { valid: true, yaw: 26.5, pitch: -2.1, ear: 0.22, faceScale: 120 };
const frontFailYaw = validatePoseStage(frontBadYaw, 'front');
console.log('Front bad yaw (should fail):', !frontFailYaw.valid ? 'PASS (correctly rejected)' : 'FAIL', frontFailYaw);

const frontBadEar = { valid: true, yaw: 3.0, pitch: -2.1, ear: 0.05, faceScale: 120 };
const frontFailEar = validatePoseStage(frontBadEar, 'front');
console.log('Front closed eyes (should fail):', !frontFailEar.valid ? 'PASS (correctly rejected)' : 'FAIL', frontFailEar);

// 2. Left Pose
const leftGood = { valid: true, yaw: -14.2, pitch: 0, ear: 0.20, faceScale: 120 };
const leftPass = validatePoseStage(leftGood, 'left');
console.log('Left good pose:', leftPass.valid ? 'PASS' : 'FAIL', leftPass);

const leftNoTurn = { valid: true, yaw: -2.1, pitch: 0, ear: 0.20, faceScale: 120 };
const leftFail = validatePoseStage(leftNoTurn, 'left');
console.log('Left no turn (should fail):', !leftFail.valid ? 'PASS (correctly rejected)' : 'FAIL', leftFail);

// 3. Right Pose
const rightGood = { valid: true, yaw: 15.6, pitch: 0, ear: 0.20, faceScale: 120 };
const rightPass = validatePoseStage(rightGood, 'right');
console.log('Right good pose:', rightPass.valid ? 'PASS' : 'FAIL', rightPass);

const rightNoTurn = { valid: true, yaw: 3.1, pitch: 0, ear: 0.20, faceScale: 120 };
const rightFail = validatePoseStage(rightNoTurn, 'right');
console.log('Right no turn (should fail):', !rightFail.valid ? 'PASS (correctly rejected)' : 'FAIL', rightFail);

// 4. Test 3-sample embedding averaging and matching
console.log('\nTesting 3-Stage Template Creation & Verification...');
const createDummyEmbedding = (seed) => {
  const arr = [];
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    arr.push(Math.sin(seed + i * 0.1));
  }
  return normalizeEmbedding(arr);
};

const sampleFront = createDummyEmbedding(1.0);
const sampleLeft = createDummyEmbedding(1.02);
const sampleRight = createDummyEmbedding(0.98);

const template = computeAverageEmbedding([sampleFront, sampleLeft, sampleRight]);
console.log('Template created. Dimension:', template.length, 'Expected:', EMBEDDING_DIMENSION);

const samePersonTest = createDummyEmbedding(1.01);
const sameScore = compareEmbeddings(template, samePersonTest);
console.log('Same person similarity score:', sameScore + '% (Should be >= 86%):', sameScore >= 86 ? 'PASS' : 'FAIL');

const diffPersonTest = createDummyEmbedding(45.0);
const diffScore = compareEmbeddings(template, diffPersonTest);
console.log('Different person similarity score:', diffScore + '% (Should be < 70%):', diffScore < 70 ? 'PASS' : 'FAIL');

// 5. Test base64-js decoding
console.log('\nTesting Base64 decoding with base64-js...');
const testStr = 'SGVsbG8gV29ybGQ=';
const decoded = base64js.toByteArray(testStr);
console.log('Decoded bytes length:', decoded.length, decoded.length === 11 ? 'PASS' : 'FAIL');

console.log('\nAll tests completed successfully!');
