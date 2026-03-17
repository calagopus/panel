import fs from 'node:fs/promises';
import { DefinedTranslations, getTranslationMapping } from 'shared';

const { default: baseTranslations } = await import('./src/translations.ts');
const translationFiles = fs.glob('extensions/*/src/translations.ts');

for await (const path of translationFiles) {
  const identifier = path.split('/')[1];
  const translations = await import(`./${path}`);

  if (
    typeof translations === 'object' &&
    translations &&
    'default' in translations &&
    translations.default instanceof DefinedTranslations
  ) {
    translations.default.namespace = identifier.replaceAll('_', '.');
    baseTranslations.mergeFrom(translations.default);
  } else {
    console.error('Invalid frontend translations', identifier, translations);
  }
}

const difFile = process.argv[2];
if (!difFile) {
  console.error('No diff file specified, Syntax: pnpm translations:diff <diff-file>');
  process.exit(1);
}

const isVerbose = process.argv.includes('--verbose');

const extractVariables = (text) => {
  if (typeof text !== 'string') return new Set();
  const matches = text.match(/\{[^}]+\}/g) || [];
  return new Set(matches);
};

try {
  const translationContent = JSON.parse(await fs.readFile(difFile, 'utf-8'));
  const translationMapping = getTranslationMapping(translationContent);
  const baseMapping = getTranslationMapping(baseTranslations.subTranslations);

  for (const key in baseMapping) {
    if (!(key in translationMapping)) {
      console.log(`Missing translation key: ${key}`);

      if (isVerbose) {
        console.log('  Expected:', JSON.stringify(baseMapping[key], null, 2));
        console.log('  Found:     <missing>');
      }
    } else {
      const baseVars = extractVariables(baseMapping[key]);
      const transVars = extractVariables(translationMapping[key]);

      const missingVars = [...baseVars].filter((v) => !transVars.has(v));
      const extraVars = [...transVars].filter((v) => !baseVars.has(v));

      if (missingVars.length > 0) {
        console.log(`Missing variable(s) in key '${key}': ${missingVars.join(', ')}`);
        if (isVerbose) {
          console.log('  Base string: ', JSON.stringify(baseMapping[key]));
          console.log('  Diff string: ', JSON.stringify(translationMapping[key]));
        }
      }

      if (extraVars.length > 0) {
        console.log(`Extra variable(s) in key '${key}': ${extraVars.join(', ')}`);
        if (isVerbose) {
          console.log('  Base string: ', JSON.stringify(baseMapping[key]));
          console.log('  Diff string: ', JSON.stringify(translationMapping[key]));
        }
      }
    }
  }

  for (const key in translationMapping) {
    if (!(key in baseMapping)) {
      console.log(`Extra translation key: ${key}`);
    }
  }
} catch (error) {
  console.error('Error reading or parsing diff file:', error);
  process.exit(1);
}
