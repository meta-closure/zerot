import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node', // または 'jsdom'
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
