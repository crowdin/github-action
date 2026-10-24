import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The git tests call process.chdir(), which is not available in worker threads.
    pool: 'forks',
    include: ['__tests__/**/*.test.ts'],
  },
});
