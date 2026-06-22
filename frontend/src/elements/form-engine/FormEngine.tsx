import { UseFormReturnType } from '@mantine/form';
import { useMemo } from 'react';
import { FormField } from './FormField.tsx';
import { FieldDef, FormExtension, InsertPosition } from './types.ts';
import { useAdvancedMode } from './useAdvancedMode.ts';

export interface FormEngineProps<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  fields: FieldDef<T>[];
  extensions?: FormExtension<T>[];
  className?: string;
}

function applyExtensions<T extends Record<string, unknown>>(
  base: FieldDef<T>[],
  extensions: FormExtension<T>[],
): FieldDef<T>[] {
  let fields = [...base];

  for (const ext of extensions) {
    for (const { field, position } of ext.fields ?? []) {
      fields = insertField(fields, field, position);
    }

    if (ext.overrides) {
      fields = fields.map((f) => {
        const override = ext.overrides?.[f.name];
        return override ? ({ ...f, ...override } as FieldDef<T>) : f;
      });
    }
  }

  return fields;
}

function insertField<T extends Record<string, unknown>>(
  fields: FieldDef<T>[],
  field: FieldDef<T>,
  position: InsertPosition,
): FieldDef<T>[] {
  switch (position.at) {
    case 'prepend':
      return [field, ...fields];
    case 'append':
      return [...fields, field];
    case 'before': {
      const idx = fields.findIndex((f) => f.name === position.name);
      if (idx === -1) return [...fields, field];
      return [...fields.slice(0, idx), field, ...fields.slice(idx)];
    }
    case 'after': {
      const idx = fields.findIndex((f) => f.name === position.name);
      if (idx === -1) return [...fields, field];
      return [...fields.slice(0, idx + 1), field, ...fields.slice(idx + 1)];
    }
  }
}

export function FormEngine<T extends Record<string, unknown>>({
  form,
  fields,
  extensions = [],
  className,
}: FormEngineProps<T>) {
  const [advanced] = useAdvancedMode();
  const resolvedFields = useMemo(() => applyExtensions(fields, extensions), [fields, extensions]);

  const visibleFields = resolvedFields.filter((f) => !f.advanced || advanced);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4${className ? ` ${className}` : ''}`}>
      {visibleFields.map((field) => (
        <FormField key={field.name} form={form} field={field} />
      ))}
    </div>
  );
}
