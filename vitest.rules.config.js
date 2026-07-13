import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. Requires the emulator:
//   npm run test:rules
// (wraps vitest in `firebase emulators:exec --only firestore`)
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.js'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
