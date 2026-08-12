import { defineConfig } from 'vitest/config';
import solidPlugin from '@solidjs/vite-plugin';

// Client half of the SSR -> hydrate parity harness: compiles the shared
// scenarios with the hydratable dom generate and replays the artifacts
// written by the server project (vitest.config.ssr.ts) into jsdom.
export default defineConfig({
  // hot: false — solid-refresh wraps top-level components in HMR wrappers
  // that add owners and break hydration id parity.
  plugins: [solidPlugin({ hot: false, solid: { hydratable: true } })],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/hydration/**/*.spec.{ts,tsx}'],
    testTransformMode: {
      web: ['/\.[jt]sx?$/'],
    },
    setupFiles: ['./test/setup-vitest.js'],
    deps: {
      inline: [/solid-js/, /@solidjs\/web/, /@solidjs\/meta/]
    }
  },
  resolve: {
    conditions: ['browser', 'development']
  }
});
