import { getTranslations } from '@/providers/TranslationProvider.tsx';

const _CONVERSION_UNIT = 1024;

export const UNITS = Object.freeze(['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const);

export type Unit = (typeof UNITS)[number];

/**
 * Given a value in megabytes converts it back down into bytes.
 */
export function mbToBytes(megabytes: number): number {
  return Math.floor(megabytes * _CONVERSION_UNIT * _CONVERSION_UNIT);
}

export function mapUnitToLocale(unit: Unit): string {
  const unitToLocaleMapping: Record<Unit, string> = {
    B: getTranslations().t('common.unit.bytes.bytes', {}),
    KiB: getTranslations().t('common.unit.bytes.kibibytes', {}),
    MiB: getTranslations().t('common.unit.bytes.mebibytes', {}),
    GiB: getTranslations().t('common.unit.bytes.gibibytes', {}),
    TiB: getTranslations().t('common.unit.bytes.tebibytes', {}),
    PiB: getTranslations().t('common.unit.bytes.pebibytes', {}),
  };

  return unitToLocaleMapping[unit];
}

/**
 * Given an amount of bytes, converts them into a human-readable string format
 * using "1024" as the divisor.
 */
export function bytesToString(bytes: number, decimals = 2, shortBytes = false): string {
  const k = _CONVERSION_UNIT;

  if (!bytes || bytes < 1)
    return shortBytes ? `0 ${getTranslations().t('common.unit.bytes.bytes', {})}` : getTranslations().tItem('byte', 0);

  decimals = Math.floor(Math.max(0, decimals));
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const unitOverflow = i - UNITS.length + 1;

  let value = Number((bytes / k ** i).toFixed(decimals));
  let unit = UNITS[i];

  if (unitOverflow >= 1) {
    const maxIndex = UNITS.length - 1;
    value = Number((bytes / k ** maxIndex).toFixed(decimals));
    unit = UNITS[maxIndex];
  }

  return unit === 'B'
    ? shortBytes
      ? `${value} ${getTranslations().t('common.unit.bytes.bytes', {})}`
      : getTranslations().tItem('byte', value)
    : `${value} ${mapUnitToLocale(unit)}`;
}

export function closestUnit(bytes: number): (typeof UNITS)[number] {
  const k = _CONVERSION_UNIT;

  if (!bytes || bytes < 1) return UNITS[0];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return UNITS[i];
}

export function formatUnitBytes(unit: Unit, bytes: number): number {
  const k = _CONVERSION_UNIT;

  const unitIndex = UNITS.indexOf(unit);

  if (unitIndex === -1) {
    throw new Error(`Invalid unit: ${unit}`);
  }

  return bytes / Math.pow(k, unitIndex);
}

export function unitToBytes(unit: Unit, value: number): number {
  const k = _CONVERSION_UNIT;

  const unitIndex = UNITS.indexOf(unit);

  if (unitIndex === -1) {
    throw new Error(`Invalid unit: ${unit}`);
  }

  return value * Math.pow(k, unitIndex);
}

export function parseSize(size: string): number {
  if (!size || typeof size !== 'string') {
    return 0;
  }

  const input = size.trim().toLowerCase();

  // Match number + optional unit (allow incomplete unit typing like "2g")
  const regex = /^([\d.]+)\s*([kmgtpezy]?i?b?)?$/i;
  const match = input.match(regex);

  if (!match) {
    return 0;
  }

  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) {
    return 0;
  }

  // Default to bytes if no unit
  let unit = (match[2] || 'b').toLowerCase();

  // Normalize units: "g" -> "gb", "k" -> "kb", etc.
  if (/^[kmgtpezy]$/.test(unit)) {
    unit = `${unit}b`;
  }

  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1e3,
    mb: 1e6,
    gb: 1e9,
    tb: 1e12,
    pb: 1e15,
    eb: 1e18,

    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    pib: 1024 ** 5,
    eib: 1024 ** 6,
  };

  return multipliers[unit] ? value * multipliers[unit] : 0;
}
