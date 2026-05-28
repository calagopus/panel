#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;
  if (Array.isArray(source)) return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      key in target &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key]) &&
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: applyJson.js <destination> <source>');
    process.exit(1);
  }

  const [destPath, sourcePath] = args;

  let destData;
  try {
    destData = JSON.parse(fs.readFileSync(destPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read/parse destination "${destPath}": ${err.message}`);
    process.exit(1);
  }

  let sourceData;
  try {
    sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read/parse source "${sourcePath}": ${err.message}`);
    process.exit(1);
  }

  const merged = deepMerge(destData, sourceData);

  try {
    fs.writeFileSync(destPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error(`Failed to write "${destPath}": ${err.message}`);
    process.exit(1);
  }

  console.log(`Merged ${path.basename(sourcePath)} into ${path.basename(destPath)}`);
}

main();
