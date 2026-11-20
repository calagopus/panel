import {
  PASSWORD_CHARSETS,
  type PasswordCharset,
  type PasswordGeneratorConstraints,
  passwordLengthBounds,
} from '@/lib/auth/passwordGenerator.ts';

interface RuleVariable {
  envVariable: string;
  rules: string[];
  value: string;
}

interface Exclusion {
  reference: string | null;
  excluded: boolean;
}

const normalizeBoolean = (value: string): string => (value === 'true' ? '1' : value === 'false' ? '0' : value);

const parseRule = (rule: string): [string, string[]] => {
  const separator = rule.indexOf(':');
  if (separator === -1) {
    return [rule, []];
  }

  return [rule.slice(0, separator), rule.slice(separator + 1).split(',')];
};

// mirrors rule-validator's dependent_value_matches
const dependentValueMatches = (values: Map<string, RuleVariable>, otherKey: string, expected: string[]): boolean => {
  const other = values.get(otherKey);
  if (!other) {
    return expected.includes('null');
  }

  if (other.rules.includes('boolean')) {
    return expected.some((value) => normalizeBoolean(value) === normalizeBoolean(other.value));
  }

  return expected.includes(other.value);
};

const getExclusion = (values: Map<string, RuleVariable>, rule: string): Exclusion | null => {
  const [name, args] = parseRule(rule);

  switch (name) {
    case 'exclude':
      return { reference: null, excluded: true };
    case 'exclude_if':
      return {
        reference: args[0],
        excluded: values.has(args[0]) && dependentValueMatches(values, args[0], args.slice(1)),
      };
    case 'exclude_unless':
      return { reference: args[0], excluded: !dependentValueMatches(values, args[0], args.slice(1)) };
    case 'exclude_with':
      return { reference: args[0], excluded: values.has(args[0]) };
    case 'exclude_without':
      return { reference: args[0], excluded: !values.get(args[0])?.value.trim() };
    default:
      return null;
  }
};

export const getExcludedVariables = (variables: RuleVariable[]): Set<string> => {
  const values = new Map(variables.map((variable) => [variable.envVariable, variable]));
  const exclusions = variables.map(
    (variable) =>
      [
        variable.envVariable,
        variable.rules.map((rule) => getExclusion(values, rule)).filter((exclusion) => exclusion !== null),
      ] as const,
  );

  const excluded = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;

    for (const [envVariable, variableExclusions] of exclusions) {
      if (excluded.has(envVariable)) {
        continue;
      }

      if (
        variableExclusions.some(
          (exclusion) => exclusion.excluded || (exclusion.reference !== null && excluded.has(exclusion.reference)),
        )
      ) {
        excluded.add(envVariable);
        changed = true;
      }
    }
  }

  return excluded;
};

const PASSWORD_NEUTRAL_RULES = new Set([
  'required',
  'nullable',
  'string',
  'str',
  'ascii',
  'different',
  'not_in',
  'required_if',
  'required_if_accepted',
  'required_if_declined',
  'exclude',
  'exclude_if',
  'exclude_unless',
  'exclude_with',
  'exclude_without',
]);

const SIZE_RULES = new Set(['min', 'max', 'size', 'between', 'digits', 'digits_between']);

const LETTERS: PasswordCharset[] = ['lowercase', 'uppercase'];
const LETTERS_AND_DIGITS: PasswordCharset[] = ['lowercase', 'uppercase', 'digits'];

export const getPasswordConstraints = (rules: string[]): PasswordGeneratorConstraints | null => {
  const constraints: PasswordGeneratorConstraints = {};
  let charsets = new Set<PasswordCharset>(PASSWORD_CHARSETS);
  const restrict = (allowed: PasswordCharset[]) => {
    charsets = new Set([...charsets].filter((charset) => allowed.includes(charset)));
  };
  const bound = (min: number | undefined, max: number | undefined) => {
    if (min !== undefined) constraints.minLength = Math.max(constraints.minLength ?? 0, min);
    if (max !== undefined) constraints.maxLength = Math.min(constraints.maxLength ?? Infinity, max);
  };

  for (const rule of rules) {
    const [name, args] = parseRule(rule);
    const numbers = args.map(Number);
    if (SIZE_RULES.has(name) && (!numbers.length || numbers.some((number) => !Number.isFinite(number)))) {
      return null;
    }

    switch (name) {
      case 'min':
        bound(numbers[0], undefined);
        break;
      case 'max':
        bound(undefined, numbers[0]);
        break;
      case 'size':
        bound(numbers[0], numbers[0]);
        break;
      case 'between':
        bound(numbers[0], numbers[1]);
        break;
      case 'alpha':
        restrict(LETTERS);
        break;
      case 'alpha_num':
      case 'alpha_dash':
        restrict(LETTERS_AND_DIGITS);
        break;
      case 'lowercase':
        restrict(['lowercase', 'digits', 'symbols']);
        break;
      case 'uppercase':
        restrict(['uppercase', 'digits', 'symbols']);
        break;
      case 'digits':
        restrict(['digits']);
        bound(numbers[0], numbers[0]);
        break;
      case 'digits_between':
        restrict(['digits']);
        bound(numbers[0], numbers[1]);
        break;
      default:
        if (!PASSWORD_NEUTRAL_RULES.has(name)) return null;
    }
  }

  constraints.charsets = [...charsets];

  return constraints.charsets.length && passwordLengthBounds(constraints) ? constraints : null;
};
