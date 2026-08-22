import { readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import type { Plugin, ResolvedConfig } from 'vite';

const COMPRESSIBLE_EXTENSIONS = new Set(['.css', '.html', '.ico', '.js', '.json', '.svg', '.webmanifest', '.woff']);

const MIN_SIZE_BYTES = 1024;
const CONCURRENCY = Math.max(1, Math.min(os.cpus().length || 4, 16));

const gzipAsync = promisify(zlib.gzip);
const GZIP_OPTIONS: zlib.ZlibOptions = {
  level: zlib.constants.Z_BEST_COMPRESSION,
};

async function getCompressibleFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  const filePaths: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fileName = entry.name;
    if (fileName.endsWith('.gz')) continue;

    const ext = path.extname(fileName).toLowerCase();
    if (!COMPRESSIBLE_EXTENSIONS.has(ext)) continue;

    const parentDir = entry.parentPath ?? (entry as { path?: string }).path ?? dir;
    filePaths.push(path.join(parentDir, fileName));
  }

  return filePaths;
}

export function precompressAssets(): Plugin {
  let resolvedOutDir: string;

  return {
    name: 'precompress-assets',
    apply: 'build',
    enforce: 'post',

    configResolved(config: ResolvedConfig) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir);
    },

    async writeBundle() {
      const filePaths = await getCompressibleFiles(resolvedOutDir).catch(() => []);
      if (filePaths.length === 0) return;

      let compressedCount = 0;
      let totalOriginalBytes = 0;
      let totalCompressedBytes = 0;

      let cursor = 0;
      const workerCount = Math.min(CONCURRENCY, filePaths.length);

      const worker = async () => {
        while (cursor < filePaths.length) {
          const currentPath = filePaths[cursor++];
          if (!currentPath) break;

          const sourceBuffer = await readFile(currentPath).catch(() => null);
          if (!sourceBuffer || sourceBuffer.length < MIN_SIZE_BYTES) continue;

          const originalSize = sourceBuffer.length;
          const compressed = await gzipAsync(sourceBuffer, GZIP_OPTIONS).catch(() => null);

          if (!compressed || compressed.length >= originalSize) continue;

          const success = await writeFile(`${currentPath}.gz`, compressed)
            .then(() => true)
            .catch(() => false);

          if (success) {
            compressedCount++;
            totalOriginalBytes += originalSize;
            totalCompressedBytes += compressed.length;
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (compressedCount > 0) {
        console.log(
          `[precompress] Compressed ${compressedCount} files: ${totalOriginalBytes} bytes → ${totalCompressedBytes} bytes`,
        );
      }
    },
  };
}

export default precompressAssets;
