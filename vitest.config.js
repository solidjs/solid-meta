import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    solidPlugin(),
    babel({
      babelHelpers: 'bundled',
      presets: [
        '@babel/preset-env',
        '@babel/preset-typescript',
        ['babel-preset-solid', { generate: 'dom', hydratable: true }]
      ],
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    setupFiles: ['./test/setup-vitest.js'],
    deps: {
      inline: [/solid-js/, /@solidjs\/meta/]
    }
  },
});