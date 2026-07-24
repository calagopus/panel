import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Plugin } from 'vite';

const COMPRESSIBLE_EXTENSIONS = new Set(['.js', '.css', '.json', '.svg']);
const MIN_SIZE = 1024;

function gzip(source: Buffer): Buffer {
  return zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION });
}

export function precompressGzip(): Plugin {
  return {
    name: 'precompress-gzip',

    closeBundle() {
      const outDir = path.resolve(__dirname, '..', 'dist');
      if (!fs.existsSync(outDir)) return;

      let files = 0;
      let originalTotal = 0;
      let compressedTotal = 0;

      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walk(full);
            continue;
          }

          if (!entry.isFile() || entry.name.endsWith('.gz')) continue;
          if (!COMPRESSIBLE_EXTENSIONS.has(path.extname(entry.name))) continue;

          const source = fs.readFileSync(full);
          if (source.length < MIN_SIZE) continue;

          const compressed = gzip(source);
          if (compressed.length >= source.length) continue;

          fs.writeFileSync(`${full}.gz`, compressed);
          files++;
          originalTotal += source.length;
          compressedTotal += compressed.length;
        }
      };

      walk(outDir);

      if (files > 0) {
        console.log(`[precompress] Gzip-compressed ${files} files: ${originalTotal} bytes → ${compressedTotal} bytes`);
      }
    },
  };
}
