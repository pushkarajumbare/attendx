/**
 * Offline TensorFlow.js Model Loader for AttendX
 *
 * Bundles BlazeFace Short-Range, MediaPipe FaceMesh, and InsightFace MobileNet-Emore
 * directly inside the React Native / Expo binary (no TFHub HTTP downloads needed).
 */

import * as tf from '@tensorflow/tfjs';
import * as base64js from 'base64-js';

let customHandlerFactory = null;

/**
 * Allows Node/unit tests to supply pre-loaded fs-backed tf.io.IOHandler instances
 * without requiring Expo native asset modules in Node.
 */
export function setCustomModelLoader(factoryFn) {
  customHandlerFactory = typeof factoryFn === 'function' ? factoryFn : null;
}

async function readBinaryAssetBuffer(weightModule) {
  const { Asset } = require('expo-asset');
  const FileSystem = require('expo-file-system');
  const { Platform } = require('react-native');

  const asset = Asset.fromModule(weightModule);
  if (!asset.localUri) {
    try {
      await asset.downloadAsync();
    } catch (_) {
      // Fall through to HTTP / Android res/raw fallback if Asset cache download fails
    }
  }

  const localUri = asset.localUri;
  if (localUri) {
    try {
      const b64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (b64) {
        const bytes = base64js.toByteArray(b64);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      }
    } catch (_) {
      // Fallback to HTTP dev server or Android res/raw below
    }
  }

  if (asset.uri && asset.uri.startsWith('http')) {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading bundled weights`);
    }
    return response.arrayBuffer();
  }

  if (Platform.OS === 'android') {
    const RNFS = require('react-native-fs');
    const resName = `${asset.uri}.${asset.type}`;
    const b64 = await RNFS.readFileRes(resName, 'base64');
    const bytes = base64js.toByteArray(b64);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  throw new Error('Unable to read bundled biometric model weights');
}

function buildMemoryIOHandler(modelJson, weightData) {
  return tf.io.fromMemory({
    modelTopology: modelJson.modelTopology,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    signature: modelJson.signature,
    userDefinedMetadata: modelJson.userDefinedMetadata,
    weightSpecs: modelJson.weightsManifest[0].weights,
    weightData,
  });
}

/**
 * Loads all three offline biometric models into memory-backed TF.js IOHandlers.
 * Static require paths ensure Metro bundles all .json/.bin files into APKs offline.
 */
export async function loadOfflineBiometricHandlers() {
  if (customHandlerFactory) {
    return customHandlerFactory();
  }

  const blazefaceJson = require('../../assets/models/blazeface_short.json');
  const blazefaceBin = require('../../assets/models/blazeface_short.bin');
  const facemeshJson = require('../../assets/models/facemesh.json');
  const facemeshBin = require('../../assets/models/facemesh.bin');
  const arcfaceJson = require('../../assets/models/insightface_mobilenet_emore.json');
  const arcfaceBin = require('../../assets/models/insightface_mobilenet_emore.bin');

  const [detBuf, meshBuf, recBuf] = await Promise.all([
    readBinaryAssetBuffer(blazefaceBin),
    readBinaryAssetBuffer(facemeshBin),
    readBinaryAssetBuffer(arcfaceBin),
  ]);

  return {
    detectorIO: buildMemoryIOHandler(blazefaceJson, detBuf),
    landmarkIO: buildMemoryIOHandler(facemeshJson, meshBuf),
    recognizerIO: buildMemoryIOHandler(arcfaceJson, recBuf),
  };
}
