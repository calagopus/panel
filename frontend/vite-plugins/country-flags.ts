import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:country-flags';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

function listCountryFlagCodes(): string[] {
  const svgDir = path.join(path.dirname(fileURLToPath(import.meta.resolve('svg-country-flags/package.json'))), 'svg');

  return fs
    .readdirSync(svgDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.slice(0, -'.svg'.length))
    .filter((code) => code.length === 2)
    .sort();
}

export function countryFlags(): Plugin {
  return {
    name: 'country-flags',

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id === RESOLVED_ID) {
        return `export const countryFlagCodes = ${JSON.stringify(listCountryFlagCodes())};`;
      }
    },
  };
}
