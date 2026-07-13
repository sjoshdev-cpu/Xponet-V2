import { defineConfig } from 'vitest/config';
import path from 'path';

// Unit tests only. The Firestore rules suite needs the emulator and runs
// separately via vitest.rules.config.js (see package.json test:rules).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'node',
  },
});
