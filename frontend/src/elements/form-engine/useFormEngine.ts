import { UseFormInput, UseFormReturnType, useForm } from '@mantine/form';
import { deepmerge } from 'deepmerge-ts';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useMemo } from 'react';
import { deepMergeZods } from 'shared';
import { type ZodType, z } from 'zod';
import { FormId } from './types.ts';

const formIds = new WeakMap<object, FormId>();

export function getFormId(form: object): FormId | undefined {
  return formIds.get(form);
}

export type ExtendableSchema = ZodType;

export function resolveFormValidation<T, P = T>(formId: FormId, schema?: ExtendableSchema) {
  const slots = window.extensionContext.extensionRegistry.forms.getSlots(formId);

  // merge deeply so extensions extending the same object (e.g. featureLimits) don't drop each other's keys
  const initialValues = slots.reduce<Record<string, unknown>>(
    (acc, s) => deepmerge(acc, s.initialValues ?? {}) as Record<string, unknown>,
    {},
  );
  const slotSchemas = slots
    .filter((s) => s.zodShape && Object.keys(s.zodShape).length > 0)
    .map((s) => z.object(s.zodShape));
  const mergedSchema = schema && slotSchemas.length ? deepMergeZods(schema, ...slotSchemas) : schema;

  return {
    initialValues,
    ...schemaFormOptions<T, P>(mergedSchema),
  };
}

export function schemaFormOptions<T, P = T>(schema?: ExtendableSchema) {
  return {
    validate: schema ? zod4Resolver(schema) : undefined,
    transformValues: schema ? (values: T) => schema.parse(values) as P : undefined,
  };
}

export interface UseFormEngineOptions<T extends Record<string, unknown>, P = T>
  extends Omit<UseFormInput<T, P>, 'validate' | 'transformValues'> {
  schema?: ExtendableSchema;
  initialValues: T;
}

export function useFormEngine<T extends Record<string, unknown>, P = T>(
  formId: FormId,
  { schema, initialValues, ...formInput }: UseFormEngineOptions<T, P>,
): UseFormReturnType<T, P> {
  const resolved = useMemo(() => resolveFormValidation<T, P>(formId, schema), [formId, schema]);

  const form = useForm<T, P>({
    ...formInput,
    initialValues: deepmerge(initialValues, resolved.initialValues) as T,
    validate: resolved.validate,
    transformValues: resolved.transformValues,
  });
  formIds.set(form, formId);

  return form;
}

export function tagFormId<T extends object>(form: T, formId: FormId): T {
  formIds.set(form, formId);
  return form;
}
