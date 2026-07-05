/** @type {import('tailwindcss').Config} */
// Mirrors frontend/tailwind.config.ts: default Tailwind palette, no custom theme.
// Color semantics (documented in CLAUDE.md): blue=primary/active, emerald=success,
// rose=destructive-only, amber=warning, gray=neutral. NativeWind's preset maps
// Tailwind utilities to React Native styles.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
