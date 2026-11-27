import { UseFormReturnType } from '@mantine/form';
import { useMemo, useRef } from 'react';
import { useKeyboardShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { CollapsibleFieldGroup } from './CollapsibleFieldGroup.tsx';
import { FormField } from './FormField.tsx';
import { DividerFieldDef, FieldDef, FormId } from './types.ts';
import { useAdvancedMode } from './useAdvancedMode.ts';
import { getFormId } from './useFormEngine.ts';

// Multiple FormEngine instances can share one <form>, submits it once regardless of how many are mounted.
const handledSaveEvents = new WeakSet<KeyboardEvent>();

type Segment<T extends Record<string, unknown>> =
  | { kind: 'field'; field: FieldDef<T> }
  | { kind: 'group'; divider: DividerFieldDef<T>; fields: FieldDef<T>[] };

function buildSegments<T extends Record<string, unknown>>(
  fields: FieldDef<T>[],
  values: T,
  advanced: boolean,
): Segment<T>[] {
  const isShown = (f: FieldDef<T>) => (!f.advanced || advanced) && (!f.when || f.when(values));
  const segments: Segment<T>[] = [];
  let group: Extract<Segment<T>, { kind: 'group' }> | null = null;

  for (const field of fields) {
    if (field.type === 'divider') {
      group = null;
      if (field.collapsible !== false && isShown(field)) {
        group = { kind: 'group', divider: field, fields: [] };
        segments.push(group);
        continue;
      }
    }

    if (field.advanced && !advanced) continue;

    if (group) group.fields.push(field);
    else segments.push({ kind: 'field', field });
  }

  // a section with nothing visible to collapse renders as a plain divider
  return segments.map((s) => (s.kind === 'group' && !s.fields.some(isShown) ? { kind: 'field', field: s.divider } : s));
}

function resolveSaveTarget(): HTMLFormElement | null | undefined {
  const focusedForm = document.activeElement?.closest('form');
  if (focusedForm) return focusedForm;

  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  const topmostDialog = dialogs[dialogs.length - 1];
  if (topmostDialog) return topmostDialog.querySelector('form');

  return undefined;
}

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
      const target = resolveSaveTarget();
      if (target !== undefined && target !== formEl) return;
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

  const segments = buildSegments(resolvedFields, form.values, advanced);
  const formValid = segments.some((s) => s.kind === 'group') ? form.isValid() !== false : true;

  return (
    <div ref={containerRef} className={`grid grid-cols-1 md:grid-cols-2 gap-4${className ? ` ${className}` : ''}`}>
      {segments.map((segment) =>
        segment.kind === 'group' ? (
          <CollapsibleFieldGroup
            key={segment.divider.name}
            form={form}
            divider={segment.divider}
            fields={segment.fields}
            formValid={formValid}
          />
        ) : (
          <FormField key={segment.field.name} form={form} field={segment.field} />
        ),
      )}
    </div>
  );
}
