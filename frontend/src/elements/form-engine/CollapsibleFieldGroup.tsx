import { UseFormReturnType } from '@mantine/form';
import { useEffect, useId, useState } from 'react';
import Collapse from '@/elements/layout/Collapse.tsx';
import { DividerHeader } from './DividerHeader.tsx';
import { FormField } from './FormField.tsx';
import { DividerFieldDef, FieldDef } from './types.ts';

interface Props<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  divider: DividerFieldDef<T>;
  fields: FieldDef<T>[];
  formValid: boolean;
}

function fieldPaths<T extends Record<string, unknown>>(field: FieldDef<T>): string[] {
  const paths = [field.name];
  if (field.type === 'localizedtext' || field.type === 'localizedtextarea') paths.push(field.translationsName);
  if (field.type === 'text' && field.icon) paths.push(field.icon.name);
  if (field.type === 'divider' && field.switchName) paths.push(field.switchName);
  return paths;
}

function pathOwnsError(path: string, errorKey: string): boolean {
  const errorParts = errorKey.split('.');
  return path.split('.').every((part, i) => part === errorParts[i]);
}

export function CollapsibleFieldGroup<T extends Record<string, unknown>>({
  form,
  divider,
  fields,
  formValid,
}: Props<T>) {
  const [collapsed, setCollapsed] = useState(divider.defaultCollapsed ?? false);
  const contentId = useId();

  const paths = [divider, ...fields].flatMap(fieldPaths);
  const errorKeys = Object.keys(form.errors);
  const invalid =
    paths.some((path) => errorKeys.some((key) => pathOwnsError(path, key))) ||
    (!formValid && paths.some((path) => form.isValid(path) === false));

  useEffect(() => {
    if (invalid) setCollapsed(false);
  }, [invalid]);

  const expanded = !collapsed;

  return (
    <div className='col-span-full'>
      <DividerHeader
        form={form}
        field={divider}
        collapse={{ expanded, onToggle: () => setCollapsed((c) => !c), controls: contentId, invalid }}
      />
      <Collapse id={contentId} expanded={expanded} keepMountedMode='display-none'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-4'>
          {fields.map((field) => (
            <FormField key={field.name} form={form} field={field} />
          ))}
        </div>
      </Collapse>
    </div>
  );
}
