import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Suites share one real database: run them one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // The test client (loopback) plays the role of the trusted proxy, so
    // suites can simulate different client IPs with X-Forwarded-For.
    env: { TRUST_PROXY: '127.0.0.1' },
  },
});
