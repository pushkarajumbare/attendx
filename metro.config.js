// Metro configuration to bundle binary TensorFlow.js (.bin) weights offline
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('bin')) {
  config.resolver.assetExts.push('bin');
}

const existingBlockList = config.resolver.blockList;
const extraBlocked = /([\\/](scratch|android[\\/]\.gradle|android[\\/]build|android[\\/]app[\\/]build)[\\/].*)$/;
config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, extraBlocked]
  : existingBlockList instanceof RegExp
    ? new RegExp(`${existingBlockList.source}|${extraBlocked.source}`)
    : extraBlocked;

module.exports = config;
