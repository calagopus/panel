import { z } from 'zod';
import { adminEggVariableSchema, adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';

type VariableFormValues = z.infer<typeof adminEggVariableUpdateSchema>;

export const eggVariableEmptyFormValues: VariableFormValues = {
  name: '',
  nameTranslations: {},
  description: null,
  descriptionTranslations: {},
  order: 0,
  envVariable: '',
  defaultValue: null,
  userViewable: true,
  userEditable: false,
  secret: false,
  rules: [],
};

export const eggVariableToFormValues = (variable: z.infer<typeof adminEggVariableSchema>): VariableFormValues => ({
  name: variable.name,
  nameTranslations: variable.nameTranslations,
  description: variable.description,
  descriptionTranslations: variable.descriptionTranslations,
  order: variable.order,
  envVariable: variable.envVariable,
  defaultValue: variable.defaultValue,
  userViewable: variable.userViewable,
  userEditable: variable.userEditable,
  secret: variable.isSecret,
  rules: variable.rules,
});
