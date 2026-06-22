import { useMemo } from 'react';
import type { ZodFieldShape } from 'shared/src/registries/forms/index.ts';
import type { FormExtension } from './types.ts';

export function useFormExtensions<T extends Record<string, unknown>>(
  formId: string,
): {
  formExtension: FormExtension<T>;
  zodShape: ZodFieldShape;
  initialValues: Record<string, unknown>;
} {
  return useMemo(() => {
    const slots = window.extensionContext.extensionRegistry.forms.getSlots(formId);

    const formExtension: FormExtension<T> = {
      fields: slots.flatMap((s) => s.fields ?? []) as FormExtension<T>['fields'],
      overrides: slots.reduce<NonNullable<FormExtension<T>['overrides']>>(
        (acc, s) => ({ ...acc, ...(s.overrides ?? {}) }),
        {},
      ),
    };

    const zodShape = slots.reduce<ZodFieldShape>((acc, s) => ({ ...acc, ...(s.zodShape ?? {}) }), {});

    const initialValues = slots.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...(s.initialValues ?? {}) }),
      {},
    );

    return { formExtension, zodShape, initialValues };
  }, [formId]);
}
