import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    // hot: false — solid-refresh's HMR wrapper trips STRICT_READ_UNTRACKED
    // warnings under vitest and HMR is meaningless in tests.
    solidPlugin({ hot: false })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    testTransformMode: {
      web: ['/\.[jt]sx?$/'],
    },
    setupFiles: ['./test/setup-vitest.js'],
    deps: {
      inline: [/solid-js/, /@solidjs\/meta/]
    }
  },
});