import { z } from 'zod';

export const PASSWORD_GENERATOR_MIN_LENGTH = 8;
export const PASSWORD_GENERATOR_MAX_LENGTH = 128;

const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!#$%&*+-.:=?@^_~',
} as const;

const AMBIGUOUS_CHARACTERS = new Set('Il1O0o');

export type PasswordCharset = keyof typeof CHARSETS;

export const PASSWORD_CHARSETS = Object.keys(CHARSETS) as PasswordCharset[];

export const passwordGeneratorOptionsSchema = z.object({
  length: z.number().int().min(PASSWORD_GENERATOR_MIN_LENGTH).max(PASSWORD_GENERATOR_MAX_LENGTH),
  lowercase: z.boolean(),
  uppercase: z.boolean(),
  digits: z.boolean(),
  symbols: z.boolean(),
  excludeAmbiguous: z.boolean(),
});

export type PasswordGeneratorOptions = z.infer<typeof passwordGeneratorOptionsSchema>;

export const DEFAULT_PASSWORD_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 24,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

// rejection sampling, `value % max` alone would bias towards the low indices
function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

export interface PasswordGeneratorConstraints {
  minLength?: number;
  maxLength?: number;
  charsets?: PasswordCharset[];
}

export function passwordLengthBounds(constraints?: PasswordGeneratorConstraints): [number, number] | null {
  const max = Math.min(constraints?.maxLength ?? PASSWORD_GENERATOR_MAX_LENGTH, PASSWORD_GENERATOR_MAX_LENGTH);
  const min = Math.max(constraints?.minLength ?? Math.min(PASSWORD_GENERATOR_MIN_LENGTH, max), 1);

  return min <= max ? [min, max] : null;
}

export function isPasswordCharsetAllowed(
  charset: PasswordCharset,
  constraints?: PasswordGeneratorConstraints,
): boolean {
  return !constraints?.charsets || constraints.charsets.includes(charset);
}

export function resolvePasswordOptions(
  options: PasswordGeneratorOptions,
  constraints?: PasswordGeneratorConstraints,
): PasswordGeneratorOptions | null {
  const bounds = passwordLengthBounds(constraints);
  if (!bounds) return null;

  const resolved = { ...options, length: Math.min(Math.max(options.length, bounds[0]), bounds[1]) };
  for (const charset of PASSWORD_CHARSETS) {
    resolved[charset] = options[charset] && isPasswordCharsetAllowed(charset, constraints);
  }

  return resolved;
}

function enabledCharsets(options: PasswordGeneratorOptions): string[] {
  return PASSWORD_CHARSETS.filter((charset) => options[charset]).map((charset) =>
    options.excludeAmbiguous
      ? [...CHARSETS[charset]].filter((character) => !AMBIGUOUS_CHARACTERS.has(character)).join('')
      : CHARSETS[charset],
  );
}

export function canGeneratePassword(
  options: PasswordGeneratorOptions,
  constraints?: PasswordGeneratorConstraints,
): boolean {
  const resolved = resolvePasswordOptions(options, constraints);

  return !!resolved && PASSWORD_CHARSETS.some((charset) => resolved[charset]);
}

export function generatePassword(
  options: PasswordGeneratorOptions,
  constraints?: PasswordGeneratorConstraints,
): string {
  const resolved = resolvePasswordOptions(options, constraints);
  const charsets = resolved ? enabledCharsets(resolved) : [];
  if (!resolved || !charsets.length) {
    throw new Error('the options and constraints leave no possible password');
  }

  const alphabet = charsets.join('');

  const characters = charsets.map((charset) => charset[randomIndex(charset.length)]).slice(0, resolved.length);
  while (characters.length < resolved.length) {
    characters.push(alphabet[randomIndex(alphabet.length)]);
  }

  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }

  return characters.join('');
}
