import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'node:path';

// Server half of the SSR -> hydrate parity harness: compiles the shared
// scenarios with the ssr generate and renders them with the node builds of
// solid-js/@solidjs/web. Runs before vitest.config.hydrate.ts (see the
// test:unit script) so artifacts are always regenerated from current source.
export default defineConfig({
  plugins: [solidPlugin({ hot: false, solid: { generate: 'ssr', hydratable: true } })],
  test: {
    environment: 'node',
    globals: true,
    include: ['test/server/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test/setup-vitest.js'],
    deps: {
      inline: [/solid-js/, /@solidjs\/web/, /@solidjs\/meta/]
    }
  },
  resolve: {
    conditions: ['node'],
    // vitest's ssr resolver keeps the `development` condition active, which
    // outranks `node` here and hands back the browser dev build — pin the
    // server builds directly.
    alias: {
      '@solidjs/web': resolve(__dirname, 'node_modules/@solidjs/web/dist/server.js'),
      'solid-js': resolve(__dirname, 'node_modules/solid-js/dist/server.js')
    }
  }
});
