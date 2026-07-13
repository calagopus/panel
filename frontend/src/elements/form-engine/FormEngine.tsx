import { UseFormReturnType } from '@mantine/form';
import { useMemo } from 'react';
import { FormField } from './FormField.tsx';
import { FieldDef, FormId } from './types.ts';
import { useAdvancedMode } from './useAdvancedMode.ts';
import { getFormId } from './useFormEngine.ts';

export interface FormEngineProps<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  fields: FieldDef<T>[];
  /** Only needed when `form` was not created through `useFormEngine`/`useModalForm` with a form id. */
  id?: FormId;
  className?: string;
}

export function FormEngine<T extends Record<string, unknown>>({ form, fields, id, className }: FormEngineProps<T>) {
  const [advanced] = useAdvancedMode();
  const formId = id ?? getFormId(form);

  const resolvedFields = useMemo(() => {
    if (!formId) return fields;

    return window.extensionContext.extensionRegistry.forms
      .getSlots(formId)
      .reduce((acc, slot) => (slot.transform ? (slot.transform(acc as FieldDef[]) as FieldDef<T>[]) : acc), fields);
  }, [fields, formId]);

  const visibleFields = resolvedFields.filter((f) => !f.advanced || advanced);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4${className ? ` ${className}` : ''}`}>
      {visibleFields.map((field) => (
        <FormField key={field.name} form={form} field={field} />
      ))}
    </div>
  );
}
