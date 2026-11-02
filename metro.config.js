const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// `inlineRem: 16` makes NativeWind resolve 1rem to 16dp on device. The type
// scale is written in rem so the web honours text zoom; without this the
// NativeWind default (14) would silently shrink every label on a phone.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });