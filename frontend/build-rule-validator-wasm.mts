import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

const OUT_DIR = 'src/wasm/rule-validator';
const HASH_FILE = `${OUT_DIR}/SOURCE_HASH`;
const SOURCES = ['../rule-validator', '../rule-validator-wasm'];

async function sourceHash(): Promise<string> {
  const paths: string[] = [];
  for (const root of SOURCES) {
    paths.push(`${root}/Cargo.toml`);
    for await (const path of fs.glob(`${root}/src/**/*.rs`)) {
      paths.push(path);
    }
  }
  paths.sort();

  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(await fs.readFile(path));
    hash.update('\0');
  }

  return hash.digest('hex');
}

const expected = await sourceHash();

if (process.argv.includes('--check')) {
  const current = await fs.readFile(HASH_FILE, 'utf8').catch(() => null);
  if (current?.trim() !== expected) {
    console.error('rule-validator wasm is out of date, run `pnpm build:rule-validator-wasm`');
    process.exit(1);
  }

  process.exit(0);
}

execFileSync(
  'wasm-pack',
  [
    'build',
    '--target',
    'web',
    '--release',
    '--no-pack',
    '--out-dir',
    `../frontend/${OUT_DIR}`,
    '--out-name',
    'rule_validator_wasm',
    '../rule-validator-wasm',
  ],
  { stdio: 'inherit' },
);

await fs.rm(`${OUT_DIR}/.gitignore`, { force: true });
await fs.writeFile(HASH_FILE, expected + '\n');
