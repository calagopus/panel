import { UseFormReturnType } from '@mantine/form';
import { ReactNode, useEffect } from 'react';
import { type FieldDef, FormEngine, type FormId } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/layout/Stack.tsx';

export interface DiscriminatedVariant<T extends Record<string, unknown>> {
  formId: FormId;
  fields: FieldDef<T>[];
  defaults: Partial<T>;
  before?: ReactNode;
}

interface Props<T extends Record<string, unknown>, K extends string> {
  form: UseFormReturnType<T>;
  discriminant: keyof T & string;
  variants: Partial<Record<K, DiscriminatedVariant<T>>>;
}

export default function DiscriminatedSettingsForm<T extends Record<string, unknown>, K extends string>({
  form,
  discriminant,
  variants,
}: Props<T, K>) {
  const active = form.getValues()[discriminant] as K;
  const variant = variants[active];

  useEffect(() => {
    if (!variant) return;

    const values = form.getValues() as Record<string, unknown>;
    if (values[discriminant] !== active) return;

    const patch: Record<string, unknown> = {};
    for (const [key, fallback] of Object.entries(variant.defaults)) {
      if (values[key] === undefined) patch[key] = fallback;
    }
    if (Object.keys(patch).length > 0) {
      form.setValues({ ...values, ...patch } as Partial<T>);
    }
  }, [active]);

  if (!variant) return null;

  return (
    <Stack mt='md'>
      {variant.before}
      <FormEngine id={variant.formId} form={form} fields={variant.fields} />
    </Stack>
  );
}
