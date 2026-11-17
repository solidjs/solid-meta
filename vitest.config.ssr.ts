import { defineConfig } from 'vitest/config';
import solidPlugin from '@solidjs/vite-plugin';
import { resolve } from 'node:path';

// Server half of the SSR -> hydrate parity harness: compiles the shared
// scenarios with the ssr generate and renders them with the node builds of
// solid-js/@solidjs/web. Runs before vitest.config.hydrate.ts (see the
// test:unit script) so artifacts are always regenerated from current source.
export default defineConfig({
  plugins: [solidPlugin({ refresh: false, solid: { generate: 'ssr', hydratable: true } })],
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
    // server dev builds directly (dev, like Vite's dev SSR, so dev-only
    // server warnings such as SERVER_WRITE surface here).
    // Exact-match aliases: a bare 'solid-js' key would also rewrite the
    // 'solid-js/internal' subpath that @solidjs/web's server build imports.
    alias: [
      { find: /^@solidjs\/web$/, replacement: resolve(__dirname, 'node_modules/@solidjs/web/dist/server.dev.js') },
      { find: /^solid-js$/, replacement: resolve(__dirname, 'node_modules/solid-js/dist/server.dev.js') }
    ]
  }
});
