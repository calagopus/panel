import path from 'node:path';
import { fileURLToPath } from 'node:url';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite';
import dynamicPublicDirectory from 'vite-multiple-assets';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { countryFlags } from './vite-plugins/country-flags.ts';
import { extensionOverrides } from './vite-plugins/extension-overrides.ts';
import { precompressGzip } from './vite-plugins/precompress.ts';
import { translationsPlugin } from './vite-plugins/translations.ts';

const useFastReactCompiler = process.env.FAST_REACT_COMPILER === 'true';
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
    react(),
    babel(
      useFastReactCompiler
        ? {
            overrides: [
              {
                include: ['./src/elements/**/*.{ts,tsx}', './src/pages/**/*.{ts,tsx}'],
                plugins: ['babel-plugin-react-compiler'],
              },
            ],
          }
        : {
            presets: [reactCompilerPreset()],
          },
    ),
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
    usePrecompress && precompressGzip(),
  ],
  optimizeDeps: {
    exclude: ['monaco-editor'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1024,
    target: 'es2020',
    cssCodeSplit: true,
    rolldownOptions: {
      external: ['monaco-editor'],
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
              name: 'common',
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
        replacement: path.resolve(__dirname, 'src/lib/monacoApiShim.ts'),
      },
    ],
  },
  publicDir: false,
});
