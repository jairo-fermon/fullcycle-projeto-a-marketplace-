import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'tmp/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs', 'scripts/k6-*.js'], languageOptions: { globals: {
    console: 'readonly', process: 'readonly', fetch: 'readonly', URL: 'readonly',
    setTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', AbortSignal: 'readonly', __ENV: 'readonly'
  } } },
  { files: ['**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'error' } }
);
