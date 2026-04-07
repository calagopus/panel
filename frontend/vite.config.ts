import fs from 'node:fs';
import path from 'node:path';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import type { LanguageData } from 'shared';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import dynamicPublicDirectory from 'vite-multiple-assets';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const useFastReactCompiler = process.env.FAST_REACT_COMPILER === 'true';

function mergeLanguageTranslations(translationsDir: string, language: string): Record<string, LanguageData> | null {
  const namespaces: Record<string, LanguageData> = {};
  let found = false;

  const topLevelFile = path.join(translationsDir, `${language}.json`);
  if (fs.existsSync(topLevelFile)) {
    namespaces[''] = JSON.parse(fs.readFileSync(topLevelFile, 'utf-8'));
    found = true;
  }

  const langDir = path.join(translationsDir, language);
  if (fs.existsSync(langDir) && fs.statSync(langDir).isDirectory()) {
    for (const file of fs.readdirSync(langDir)) {
      if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(langDir, file), 'utf-8');
        namespaces[file.replace('.json', '')] = JSON.parse(content);
        found = true;
      }
    }
  }

  return found ? namespaces : null;
}

function discoverLanguages(translationsDir: string): string[] {
  if (!fs.existsSync(translationsDir)) return [];

  const languages = new Set<string>();

  for (const entry of fs.readdirSync(translationsDir)) {
    const fullPath = path.join(translationsDir, entry);

    if (entry.endsWith('.json')) {
      languages.add(entry.replace('.json', ''));
    } else if (fs.statSync(fullPath).isDirectory()) {
      languages.add(entry);
    }
  }

  return [...languages];
}

function discoverTranslationDirs(): string[] {
  const dirs: string[] = [];

  const mainDir = path.resolve(__dirname, 'public/translations');
  if (fs.existsSync(mainDir)) dirs.push(mainDir);

  const extensionsDir = path.resolve(__dirname, 'extensions');
  if (fs.existsSync(extensionsDir)) {
    for (const ext of fs.readdirSync(extensionsDir)) {
      const extTransDir = path.join(extensionsDir, ext, 'public/translations');
      if (fs.existsSync(extTransDir) && fs.statSync(extTransDir).isDirectory()) {
        dirs.push(extTransDir);
      }
    }
  }

  return dirs;
}

function discoverAllLanguages(translationDirs: string[]): string[] {
  const languages = new Set<string>();
  for (const dir of translationDirs) {
    for (const lang of discoverLanguages(dir)) {
      languages.add(lang);
    }
  }
  return [...languages];
}

function mergeAllTranslations(translationDirs: string[], language: string): Record<string, LanguageData> | null {
  const merged: Record<string, LanguageData> = {};
  let found = false;

  for (const dir of translationDirs) {
    const result = mergeLanguageTranslations(dir, language);
    if (!result) continue;
    found = true;

    for (const [namespace, data] of Object.entries(result)) {
      if (merged[namespace]) {
        merged[namespace] = { ...merged[namespace], ...data };
      } else {
        merged[namespace] = data;
      }
    }
  }

  return found ? merged : null;
}

const translationsPlugin = (): Plugin => {
  return {
    name: 'translations',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/translations\/([^/]+)\.json$/);
        if (!match) return next();

        const language = match[1];

        try {
          const dirs = discoverTranslationDirs();
          const merged = mergeAllTranslations(dirs, language);
          if (!merged) return next();

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(merged));
        } catch (err) {
          console.error(`[translations] Dev serve error for "${language}":`, err);
          next();
        }
      });
    },

    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist/translations');
      const dirs = discoverTranslationDirs();
      const languages = discoverAllLanguages(dirs);

      if (languages.length === 0) return;

      let totalSource = 0;
      let totalMinified = 0;

      for (const language of languages) {
        try {
          const merged = mergeAllTranslations(dirs, language);
          if (!merged) continue;

          const minified = JSON.stringify(merged);

          for (const dir of dirs) {
            const topLevel = path.join(dir, `${language}.json`);
            if (fs.existsSync(topLevel)) {
              totalSource += fs.readFileSync(topLevel, 'utf-8').length;
            }
            const langDir = path.join(dir, language);
            if (fs.existsSync(langDir) && fs.statSync(langDir).isDirectory()) {
              for (const file of fs.readdirSync(langDir)) {
                if (file.endsWith('.json')) {
                  totalSource += fs.readFileSync(path.join(langDir, file), 'utf-8').length;
                }
              }
            }
          }

          fs.writeFileSync(path.join(outDir, `${language}.json`), minified);
          totalMinified += minified.length;
        } catch (err) {
          console.error(`[translations] Build error for "${language}":`, err);
        }
      }

      console.log(
        `[translations] Merged ${languages.length} languages from ${dirs.length} source(s) into dist/translations/`,
      );
      console.log(`[translations] Source: ${totalSource} bytes → Minified: ${totalMinified} bytes`);
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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
    viteStaticCopy({
      targets: [
        {
          src: path.join(new URL('./', import.meta.resolve('monaco-editor/package.json')).pathname, 'min/vs'),
          dest: 'monaco',
        },
      ],
    }),
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
        advancedChunks: {
          groups: [
            {
              name: 'react',
              test: /node_modules\/react/,
              priority: 20,
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
      '/api': `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
      '/assets': `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
      '/avatars': `http://localhost:${process.env.BACKEND_PORT ?? 8000}`,
    },
    allowedHosts: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  publicDir: false,
});
