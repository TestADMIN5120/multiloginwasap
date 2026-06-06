module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 / SDK 54: the worklets babel plugin moved to its own package.
    // Must be the LAST plugin in the list.
    plugins: ['react-native-worklets/plugin'],
  };
};

