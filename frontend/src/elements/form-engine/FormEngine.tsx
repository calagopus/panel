import { UseFormReturnType } from '@mantine/form';
import { useMemo, useState } from 'react';
import Switch from '@/elements/input/Switch.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { FormField } from './FormField.tsx';
import { FieldDef, FormExtension, InsertPosition } from './types.ts';

export interface FormEngineProps<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  fields: FieldDef<T>[];
  showAdvancedToggle?: boolean;
  defaultAdvanced?: boolean;
  advanced?: boolean;
  onAdvancedChange?: (value: boolean) => void;
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
  showAdvancedToggle = false,
  defaultAdvanced = false,
  advanced: controlledAdvanced,
  onAdvancedChange,
  extensions = [],
  className,
}: FormEngineProps<T>) {
  const { t } = useTranslations();
  const [internalAdvanced, setInternalAdvanced] = useState(defaultAdvanced);

  const isAdvanced = controlledAdvanced !== undefined ? controlledAdvanced : internalAdvanced;

  const handleAdvancedChange = (value: boolean) => {
    if (controlledAdvanced === undefined) setInternalAdvanced(value);
    onAdvancedChange?.(value);
  };

  const resolvedFields = useMemo(() => applyExtensions(fields, extensions), [fields, extensions]);

  const hasAdvancedFields = resolvedFields.some((f) => f.advanced);

  const visibleFields = resolvedFields.filter((f) => !f.advanced || isAdvanced);

  return (
    <div>
      {showAdvancedToggle && hasAdvancedFields && (
        <div className='flex justify-end mb-3'>
          <Switch
            label={t('elements.formEngine.advancedMode', {})}
            checked={isAdvanced}
            onChange={(e) => handleAdvancedChange(e.currentTarget.checked)}
          />
        </div>
      )}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4${className ? ` ${className}` : ''}`}>
        {visibleFields.map((field) => (
          <FormField key={field.name} form={form} field={field} />
        ))}
      </div>
    </div>
  );
}
