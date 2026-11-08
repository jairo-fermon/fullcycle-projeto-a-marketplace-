import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'], testTimeout: 20000, hookTimeout: 30000,
  fileParallelism: false,
  coverage: { provider: 'v8', reportsDirectory: 'coverage/report', include: ['src/**/*.ts'],
    reporter: ['text', 'json-summary', 'lcov', 'html'], thresholds: { lines: 80, branches: 75 } }
} });
