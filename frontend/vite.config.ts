import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite';
import dynamicPublicDirectory from 'vite-multiple-assets';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { bootSpinner } from './vite-plugins/boot-spinner.ts';
import { chunkSizeWarnings } from './vite-plugins/chunk-size.ts';
import { countryFlags } from './vite-plugins/country-flags.ts';
import { deprecatedPaths } from './vite-plugins/deprecated-paths.ts';
import { extensionChunkGroups } from './vite-plugins/extension-chunks.ts';
import { extensionOverrides } from './vite-plugins/extension-overrides.ts';
import { extensionVariables } from './vite-plugins/extension-variables.ts';
import { fontAwesomeIcons } from './vite-plugins/fontawesome-icons.ts';
import { iconManifest } from './vite-plugins/icon-manifest.ts';
import { precompressAssets } from './vite-plugins/precompress.ts';
import { translationsPlugin } from './vite-plugins/translations.ts';

const usePrecompress = process.env.PRECOMPRESS === 'true';

const pakoInflateUmd = normalizePath(
  path.join(
    path.dirname(fileURLToPath(import.meta.resolve('pako/package.json'))),
    'dist/browser/pako_inflate.umd.min.js',
  ),
);
const svgCountryFlagsDir = normalizePath(
  path.join(path.dirname(fileURLToPath(import.meta.resolve('svg-country-flags/package.json'))), 'svg'),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    deprecatedPaths(),
    extensionOverrides(),
    react({
      compiler: {
        target: '19',
      },
    }),
    tailwindcss(),
    dynamicPublicDirectory(['public/**', 'extensions/*/public/**'], {
      dst(path) {
        if (path.baseFile.startsWith('extensions/')) {
          return path.dstFile.split('/').slice(2).join('/');
        }

        return path.dstFile;
      },
    }),
    translationsPlugin(),
    countryFlags(),
    fontAwesomeIcons(),
    iconManifest(),
    bootSpinner(),
    extensionVariables(),
    viteStaticCopy({
      targets: [
        {
          src: svgCountryFlagsDir,
          dest: 'flags',
          rename: {
            stripBase: 7,
          },
        },
      ],
    }),
    chunkSizeWarnings({
      limitKb: 1024,
      // monaco is loaded on demand and can't be split meaningfully further
      ignoreModules: /\/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?monaco-editor\//,
      ignoreAssets: /^assets\/(editor|css|html|json|ts)\.worker-/,
    }),
    usePrecompress && precompressAssets(),
  ],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/compiler-runtime',
      '@mantine/core',
      '@tanstack/react-query',
    ],
    exclude: ['monaco-editor'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    // enforced by chunkSizeWarnings()
    chunkSizeWarningLimit: Infinity,
    target: 'es2022',
    cssCodeSplit: true,
    reportCompressedSize: usePrecompress,
    rolldownOptions: {
      experimental: {
        lazyBarrel: true,
      },
      checks: {
        pluginTimings: false,
      },
      onLog(level, log, defaultHandler) {
        if (log.code === 'IMPORT_IS_UNDEFINED' && log.message?.includes('rrule/dist/esm/index.js')) {
          return;
        }

        defaultHandler(level, log);
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        codeSplitting: {
          groups: [
            ...extensionChunkGroups(),
            {
              name: 'react',
              test: /node_modules\/(react|react-dom|react-is|scheduler|use-sync-external-store)\//,
              priority: 20,
            },
            {
              name: 'tanstack',
              test: /node_modules\/@tanstack\/(query-core|react-query)\//,
              priority: 16,
            },
            {
              name: 'xterm',
              test: /node_modules\/@xterm\//,
              priority: 15,
            },
            {
              name: 'recharts',
              test: (id: string) =>
                /node_modules\/(recharts|@mantine\/charts|d3-[a-z-]+|victory-vendor|internmap|@reduxjs\/toolkit|redux|redux-thunk|react-redux|reselect|immer|decimal\.js-light|eventemitter3|es-toolkit)\//.test(
                  id,
                ) && !id.endsWith('.css'),
              priority: 15,
              includeDependenciesRecursively: false,
            },
            {
              name: 'mantine',
              test: /node_modules\/(@mantine\/(core|hooks|form)|@floating-ui|clsx|react-textarea-autosize)\//,
              priority: 12,
            },
            {
              name: 'highlight',
              test: /node_modules\/highlight\.js\//,
              priority: 11,
            },
            {
              name: 'markdown',
              test: /node_modules\/(react-markdown|remark-gfm|unified|mdast-util-|micromark|hast-util-|html-void-elements|zwitch|bail|trough|vfile|property-information|space-separated-tokens|comma-separated-tokens)\//,
              priority: 11,
            },
            {
              name: 'motion',
              test: /node_modules\/motion\//,
              priority: 11,
            },
            {
              name: 'zod',
              test: /node_modules\/zod\/(?!v4\/locales\/)/,
              priority: 11,
            },
            {
              name: 'pierre-diffs',
              test: /node_modules\/(@pierre\/(diffs|theme|theming)|hast-util-to-html|diff|lru_map)\//,
              priority: 12,
              includeDependenciesRecursively: false,
            },
            {
              name: 'shiki',
              test: /node_modules\/(@shikijs\/(core|engine-javascript|engine-oniguruma|primitive|transformers|types|vscode-textmate)|shiki)\//,
              priority: 12,
              includeDependenciesRecursively: false,
            },
            {
              name: 'vendor',
              test: /node_modules\/(axios|zustand|history|classnames|object-deep-merge|deepmerge-ts)\//,
              priority: 10,
            },
            {
              name: 'collab',
              test: /node_modules\/(yjs|y-protocols|y-monaco|lib0)\//,
              priority: 10,
            },
            {
              name: 'cron',
              test: /node_modules\/(cron-parser|cronstrue|luxon)\/(?!locales\/)/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/openapi.json': `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
        changeOrigin: true,
        xfwd: true,
        ws: true,
      },
      '/wings-proxy': {
        target: `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
        changeOrigin: true,
        xfwd: true,
        ws: true,
      },
      '/assets': `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
      '/avatars': `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
    },
    allowedHosts: true,
  },
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: 'monaco-editor/esm/vs/editor/editor.api.js',
        replacement: path.resolve(import.meta.dirname, 'src/lib/editor/monacoApiShim.ts'),
      },
      {
        find: /^pako\/dist\/browser\/pako_inflate\.umd\.min\.js/,
        replacement: pakoInflateUmd,
      },
    ],
  },
  publicDir: false,
});
