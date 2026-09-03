import { UseFormReturnType } from '@mantine/form';
import { useMemo, useRef } from 'react';
import { useKeyboardShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { FormField } from './FormField.tsx';
import { FieldDef, FormId } from './types.ts';
import { useAdvancedMode } from './useAdvancedMode.ts';
import { getFormId } from './useFormEngine.ts';

// Multiple FormEngine instances can share one <form>, submits it once regardless of how many are mounted.
const handledSaveEvents = new WeakSet<KeyboardEvent>();

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
  const containerRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcut(
    's',
    (event) => {
      if (handledSaveEvents.has(event)) return;
      const formEl = containerRef.current?.closest('form');
      if (!formEl) return;
      handledSaveEvents.add(event);
      formEl.requestSubmit();
    },
    { id: 'general.save' },
  );

  const resolvedFields = useMemo(() => {
    if (!formId) return fields;

    return window.extensionContext.extensionRegistry.forms
      .getSlots(formId)
      .reduce((acc, slot) => (slot.transform ? (slot.transform(acc as FieldDef[]) as FieldDef<T>[]) : acc), fields);
  }, [fields, formId]);

  const visibleFields = resolvedFields.filter((f) => !f.advanced || advanced);

  return (
    <div ref={containerRef} className={`grid grid-cols-1 md:grid-cols-2 gap-4${className ? ` ${className}` : ''}`}>
      {visibleFields.map((field) => (
        <FormField key={field.name} form={form} field={field} />
      ))}
    </div>
  );
}
