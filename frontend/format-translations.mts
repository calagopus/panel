import fs from 'node:fs/promises';
import path from 'node:path';

const translationsDir = 'public/translations';
const referenceFile = path.join(translationsDir, 'en.json');

type TranslationValue = string | { [key: string]: TranslationValue };
type TranslationRecord = { [key: string]: TranslationValue };

const isObject = (value: TranslationValue | undefined): value is TranslationRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reorder `target`'s keys to match `reference`, recursing into nested objects. */
function orderToMatch(reference: TranslationValue | undefined, target: TranslationValue): TranslationValue {
  if (!isObject(target)) {
    return target;
  }

  const ordered: TranslationRecord = {};

  if (isObject(reference)) {
    for (const key in reference) {
      if (key in target) {
        ordered[key] = orderToMatch(reference[key], target[key]);
      }
    }
  }

  // Keep any keys that are not present in the reference, appended after the matched ones.
  for (const key in target) {
    if (!(key in ordered)) {
      ordered[key] = orderToMatch(isObject(reference) ? reference[key] : undefined, target[key]);
    }
  }

  return ordered;
}

const REMOVE = Symbol('remove');

/** Recursively strip empty objects, returning REMOVE when a value should be dropped. */
function pruneEmpty(value: TranslationValue): TranslationValue | typeof REMOVE {
  if (!isObject(value)) {
    return value;
  }

  for (const key in value) {
    const result = pruneEmpty(value[key]);
    if (result === REMOVE) {
      delete value[key];
    } else {
      value[key] = result;
    }
  }

  return Object.keys(value).length === 0 ? REMOVE : value;
}

const referenceContent: TranslationRecord = JSON.parse(await fs.readFile(referenceFile, 'utf-8'));
const files = (await fs.readdir(translationsDir)).filter((file) => file.endsWith('.json'));

for (const file of files) {
  const full = path.join(translationsDir, file);
  const isReference = full === referenceFile;
  const content: TranslationRecord = JSON.parse(await fs.readFile(full, 'utf-8'));

  const ordered = orderToMatch(isReference ? content : referenceContent, content);
  const pruned = pruneEmpty(ordered);
  const result = pruned === REMOVE ? {} : pruned;

  await fs.writeFile(full, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Formatted ${file}`);
}
