import { deepmerge } from 'deepmerge-ts';
import { useMemo } from 'react';
import { deepMergeZods } from 'shared';
import { FormContainerRegistry } from 'shared/src/registries/slices/form';
import { z } from 'zod';

type Props<BaseFormType extends z.ZodTypeAny, R> = {
  baseSchema: BaseFormType;
  defaultValues: z.infer<BaseFormType>;
  registry: R | R[];
};

export function useExtendibleForm<
  BaseFormType extends z.ZodTypeAny,
  // biome-ignore lint/suspicious/noExplicitAny: We want to allow any additional props without forcing the caller to specify them
  R extends FormContainerRegistry<BaseFormType, any>,
>({ baseSchema, defaultValues, registry }: Props<BaseFormType, R>) {
  const mergedSchema = useMemo(() => {
    return deepMergeZods(
      baseSchema.clone(),
      ...(Array.isArray(registry) ? registry : [registry]).map((r) => r.mergedSchema),
    ) as z.ZodType<z.infer<typeof baseSchema>>;
  }, []);

  const mergedDefaultValues = useMemo(() => {
    return deepmerge(
      defaultValues,
      ...(Array.isArray(registry) ? registry : [registry]).map((r) => r.mergedDefaultValues),
    ) as z.infer<typeof baseSchema>;
  }, []);

  return {
    formSchema: mergedSchema,
    formInitialValues: mergedDefaultValues,
  };
}
