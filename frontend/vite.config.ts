import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite';
import dynamicPublicDirectory from 'vite-multiple-assets';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { countryFlags } from './vite-plugins/country-flags.ts';
import { extensionOverrides } from './vite-plugins/extension-overrides.ts';
import { precompressAssets } from './vite-plugins/precompress.ts';
import { translationsPlugin } from './vite-plugins/translations.ts';

const usePrecompress = process.env.PRECOMPRESS === 'true';

const monacoVsDir = normalizePath(
  path.join(path.dirname(fileURLToPath(import.meta.resolve('monaco-editor/package.json'))), 'min/vs'),
);
const svgCountryFlagsDir = normalizePath(
  path.join(path.dirname(fileURLToPath(import.meta.resolve('svg-country-flags/package.json'))), 'svg'),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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
    viteStaticCopy({
      targets: [
        {
          src: monacoVsDir,
          dest: 'monaco',
          rename: {
            stripBase: 7,
          },
        },
        {
          src: svgCountryFlagsDir,
          dest: 'flags',
          rename: {
            stripBase: 7,
          },
        },
      ],
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
    chunkSizeWarningLimit: 1024,
    target: 'es2022',
    cssCodeSplit: true,
    rolldownOptions: {
      external: ['monaco-editor'],
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
            {
              name: 'react',
              test: /node_modules\/react/,
              priority: 20,
            },
            {
              name: 'tanstack',
              test: /node_modules\/@tanstack\//,
              priority: 16,
            },
            {
              name: 'xterm',
              test: /node_modules\/@xterm\//,
              priority: 15,
            },
            {
              name: 'recharts',
              test: /node_modules\/(recharts|@mantine\/charts)\//,
              priority: 15,
            },
            {
              name: 'mantine',
              test: /node_modules\/(@mantine|@floating-ui|clsx|react-textarea-autosize)\//,
              priority: 12,
            },
            {
              name: 'pierre-diffs',
              test: /node_modules\/(@pierre\/(diffs|theme|theming)|@shikijs\/(core|engine-javascript|engine-oniguruma|primitive|transformers|types|vscode-textmate)|shiki|hast-util-to-html|diff|lru_map)\//,
              priority: 12,
              includeDependenciesRecursively: false,
            },
            {
              name: 'common',
              test: (id: string) => !/node_modules\/@shikijs\/(langs|themes)\//.test(id),
              minShareCount: 5,
              minSize: 10240,
              priority: 5,
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
        replacement: path.resolve(import.meta.dirname, 'src/lib/monacoApiShim.ts'),
      },
    ],
  },
  publicDir: false,
});
