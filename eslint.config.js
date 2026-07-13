import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Tracked debt: ~150 dead imports across the codebase. Warn (not error)
      // so CI can gate on real errors while cleanup happens incrementally.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // DX-only concern; several files intentionally co-export helpers.
      'react-refresh/only-export-components': 'warn',
      // catch (_) {} fire-and-forget writes are deliberate in this codebase.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // React-Compiler-era guidance rules. The server-data → draft-state sync
      // pattern is used deliberately in ~15 components; refactor incrementally
      // rather than blocking CI on style guidance.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
])
