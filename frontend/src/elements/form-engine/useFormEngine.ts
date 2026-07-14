import { UseFormInput, UseFormReturnType, useForm } from '@mantine/form';
import { deepmerge } from 'deepmerge-ts';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useMemo } from 'react';
import { deepMergeZod } from 'shared';
import { type ZodType, z } from 'zod';
import { FormId, ZodFieldShape } from './types.ts';

const formIds = new WeakMap<object, FormId>();

export function getFormId(form: object): FormId | undefined {
  return formIds.get(form);
}

export type ExtendableSchema = ZodType;

export function resolveFormValidation(formId: FormId, schema?: ExtendableSchema) {
  const slots = window.extensionContext.extensionRegistry.forms.getSlots(formId);

  const zodShape = slots.reduce<ZodFieldShape>((acc, s) => ({ ...acc, ...(s.zodShape ?? {}) }), {});
  const initialValues = slots.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...(s.initialValues ?? {}) }), {});
  const mergedSchema = schema && Object.keys(zodShape).length ? deepMergeZod(schema, z.object(zodShape)) : schema;

  return {
    initialValues,
    validate: mergedSchema ? zod4Resolver(mergedSchema) : undefined,
  };
}

export interface UseFormEngineOptions<T extends Record<string, unknown>> extends Omit<UseFormInput<T>, 'validate'> {
  schema?: ExtendableSchema;
  initialValues: T;
}

export function useFormEngine<T extends Record<string, unknown>>(
  formId: FormId,
  { schema, initialValues, ...formInput }: UseFormEngineOptions<T>,
): UseFormReturnType<T> {
  const resolved = useMemo(() => resolveFormValidation(formId, schema), [formId, schema]);

  const form = useForm<T>({
    ...formInput,
    initialValues: deepmerge(initialValues, resolved.initialValues) as T,
    validate: resolved.validate,
  });
  formIds.set(form, formId);

  return form;
}

export function tagFormId<T extends object>(form: T, formId: FormId): T {
  formIds.set(form, formId);
  return form;
}
