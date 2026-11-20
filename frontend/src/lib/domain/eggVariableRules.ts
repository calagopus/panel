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
