"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var plugin_babel_1 = require("@rolldown/plugin-babel");
var vite_1 = require("@tailwindcss/vite");
var plugin_react_1 = require("@vitejs/plugin-react");
var vite_2 = require("vite");
var vite_multiple_assets_1 = require("vite-multiple-assets");
var vite_plugin_static_copy_1 = require("vite-plugin-static-copy");
var country_flags_ts_1 = require("./vite-plugins/country-flags.ts");
var extension_overrides_ts_1 = require("./vite-plugins/extension-overrides.ts");
var precompress_ts_1 = require("./vite-plugins/precompress.ts");
var translations_ts_1 = require("./vite-plugins/translations.ts");
var useFastReactCompiler = process.env.FAST_REACT_COMPILER === 'true';
var usePrecompress = process.env.PRECOMPRESS === 'true';
var monacoVsDir = (0, vite_2.normalizePath)(node_path_1.default.join(node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.resolve('monaco-editor/package.json'))), 'min/vs'));
var svgCountryFlagsDir = (0, vite_2.normalizePath)(node_path_1.default.join(node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.resolve('svg-country-flags/package.json'))), 'svg'));
// https://vite.dev/config/
exports.default = (0, vite_2.defineConfig)({
    plugins: [
        (0, extension_overrides_ts_1.extensionOverrides)(),
        (0, plugin_react_1.default)(),
        (0, plugin_babel_1.default)(useFastReactCompiler
            ? {
                overrides: [
                    {
                        include: ['./src/elements/**/*.{ts,tsx}', './src/pages/**/*.{ts,tsx}'],
                        plugins: ['babel-plugin-react-compiler'],
                    },
                ],
            }
            : {
                presets: [(0, plugin_react_1.reactCompilerPreset)()],
            }),
        (0, vite_1.default)(),
        (0, vite_multiple_assets_1.default)(['public/**', 'extensions/*/public/**'], {
            dst: function (path) {
                if (path.baseFile.startsWith('extensions/')) {
                    return path.dstFile.split('/').slice(2).join('/');
                }
                return path.dstFile;
            },
        }),
        (0, translations_ts_1.translationsPlugin)(),
        (0, country_flags_ts_1.countryFlags)(),
        (0, vite_plugin_static_copy_1.viteStaticCopy)({
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
        usePrecompress && (0, precompress_ts_1.precompressGzip)(),
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
                            // hast-util-to-html and its property-information/*-tokens deps are shared with
                            // the eager react-markdown/rehype chain (see TranslationProvider), so they're
                            // deliberately left out here: grouping them in would drag shiki into the eager
                            // bundle too, since a matched chunk loads eagerly if any member is eager-reachable.
                            //
                            // shiki/@shikijs are deliberately excluded too: those packages ship one file per
                            // language grammar and theme, each already loaded via its own dynamic import() so
                            // it stays a separate on-demand chunk. Grouping them here would force rolldown to
                            // merge every language/theme into this one chunk instead of splitting them.
                            name: 'pierre-diffs',
                            test: /node_modules\/(@pierre\/(diffs|theme|theming)|diff|lru_map)\//,
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
            '/openapi.json': "http://localhost:".concat((_a = process.env.BACKEND_PORT) !== null && _a !== void 0 ? _a : 8000),
            '/api': {
                target: "http://localhost:".concat((_b = process.env.BACKEND_PORT) !== null && _b !== void 0 ? _b : 8000),
                changeOrigin: true,
                ws: true,
            },
            '/assets': "http://localhost:".concat((_c = process.env.BACKEND_PORT) !== null && _c !== void 0 ? _c : 8000),
            '/avatars': "http://localhost:".concat((_d = process.env.BACKEND_PORT) !== null && _d !== void 0 ? _d : 8000),
        },
        allowedHosts: true,
    },
    resolve: {
        tsconfigPaths: true,
        alias: [
            {
                find: 'monaco-editor/esm/vs/editor/editor.api.js',
                replacement: node_path_1.default.resolve(import.meta.dirname, 'src/lib/monacoApiShim.ts'),
            },
        ],
    },
    publicDir: false,
});
