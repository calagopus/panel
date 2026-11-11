import { z } from 'zod';
import { getTranslations } from '@/providers/contexts/translationContext.ts';

type Translate = ReturnType<typeof getTranslations>['t'];

// schemas are module-level, so the message has to be resolved lazily in the active language
export const ruleMessage = (message: (t: Translate) => string) => ({ error: () => message(getTranslations().t) });

const usernameRule = ruleMessage((t) => t('common.form.rule.username', {}));

export const usernameSchema = z
  .string()
  .min(3, usernameRule)
  .max(48, usernameRule)
  .regex(/^[a-zA-Z0-9_]+$/, usernameRule);

const databaseInstanceIdentifierRule = ruleMessage((t) => t('common.form.rule.databaseInstanceIdentifier', {}));

export const databaseInstanceIdentifierSchema = z
  .string()
  .min(2, databaseInstanceIdentifierRule)
  .max(23, databaseInstanceIdentifierRule)
  .regex(/^[a-zA-Z0-9]+$/, databaseInstanceIdentifierRule);
