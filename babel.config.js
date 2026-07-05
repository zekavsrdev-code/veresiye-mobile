module.exports = function (api) {
  api.cache(true);
  return {
    // jsxImportSource routes className props through NativeWind's JSX runtime.
    // babel-preset-expo (SDK 57) already injects the Reanimated/worklets plugin,
    // so it must NOT be added manually here (double-registration errors).
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
