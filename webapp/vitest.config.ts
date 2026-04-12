import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom', // Need happy-dom or jsdom for DOM-related tests. We will install happy-dom next.
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});