import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys.ts';

export type RuleArguments =
  | 'none'
  | 'flag'
  | 'number'
  | 'numberRange'
  | 'version'
  | 'field'
  | 'fields'
  | 'fieldValues'
  | 'values'
  | 'pattern'
  | 'formats';

export interface RuleDefinition {
  name: string;
  aliases: string[];
  implicit: boolean;
  arguments: RuleArguments;
  flag: string | null;
  optionalArguments: boolean;
}

export interface RuleVariable {
  envVariable: string;
  rules: string[];
  value: string;
}

export interface RuleValidationResult {
  excluded: Set<string>;
  errors: Record<string, string>;
}

export interface RuleValidator {
  catalog: RuleDefinition[];
  checkRule: (rule: string) => string | null;
  validate: (variables: RuleVariable[]) => RuleValidationResult | null;
}

// local shape of the generated wasm-bindgen module, which may not exist
interface RuleValidatorModule {
  default: () => Promise<unknown>;
  catalog: () => string;
  checkRule: (rule: string) => string | undefined;
  validate: (variables: string) => string;
}

const modules = import.meta.glob<RuleValidatorModule>('/src/wasm/rule-validator/rule_validator_wasm.js');

let loading: Promise<RuleValidator | null> | null = null;

export const loadRuleValidator = (): Promise<RuleValidator | null> => {
  loading ??= (async () => {
    const load = Object.values(modules)[0];
    if (!load) {
      return null;
    }

    const module = await load();
    await module.default();

    return {
      catalog: JSON.parse(module.catalog()) as RuleDefinition[],
      checkRule: (rule: string) => module.checkRule(rule) ?? null,
      validate: (variables: RuleVariable[]) => {
        const result = JSON.parse(module.validate(JSON.stringify(variables))) as
          | { excluded: string[]; errors: Record<string, string> }
          | { error: string };

        return 'error' in result ? null : { excluded: new Set(result.excluded), errors: result.errors };
      },
    };
  })().catch(() => null);

  return loading;
};

export const useRuleValidator = (): RuleValidator | null =>
  useQuery({
    queryKey: queryKeys.admin.ruleValidator.module(),
    queryFn: loadRuleValidator,
    staleTime: Infinity,
    gcTime: Infinity,
  }).data ?? null;
