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
    // test/server and test/hydration belong to the parity harness projects
    // (vitest.config.ssr.ts / vitest.config.hydrate.ts).
    include: ['test/*.spec.{ts,tsx}'],
    testTransformMode: {
      web: ['/\.[jt]sx?$/'],
    },
    setupFiles: ['./test/setup-vitest.js'],
    deps: {
      inline: [/solid-js/, /@solidjs\/meta/]
    }
  },
});