import { UseFormReturnType } from '@mantine/form';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import DateTimePicker from '@/elements/input/DateTimePicker.tsx';
import LocalizedTextArea from '@/elements/input/LocalizedTextArea.tsx';
import LocalizedTextInput from '@/elements/input/LocalizedTextInput.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import MultiSelectGroup from '@/elements/input/MultiSelectGroup.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { FieldDef } from './types.ts';

interface Props<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  field: FieldDef<T>;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function FormField<T extends Record<string, unknown>>({ form, field }: Props<T>) {
  if (field.when && !field.when(form.values)) return null;

  const colSpanClass = field.colSpan === 'full' ? 'col-span-full' : undefined;
  const f = form as UseFormReturnType<Record<string, unknown>>;

  switch (field.type) {
    case 'text':
      return (
        <TextInput
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'password':
      return (
        <PasswordInput
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'textarea':
      return (
        <TextArea
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          rows={field.rows}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'number':
      return (
        <NumberInput
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'switch':
      return (
        <Switch
          className={colSpanClass}
          label={field.label}
          description={field.description}
          key={f.key(field.name)}
          {...f.getInputProps(field.name, { type: 'checkbox' })}
          {...field.props}
        />
      );

    case 'checkbox':
      return (
        <Checkbox
          className={colSpanClass}
          label={field.label}
          description={field.description}
          key={f.key(field.name)}
          {...f.getInputProps(field.name, { type: 'checkbox' })}
          {...field.props}
        />
      );

    case 'select':
      return (
        <Select
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          data={field.options}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'multiselect':
      return (
        <MultiSelect
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          data={field.options}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'date':
      return (
        <DateTimePicker
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'autocomplete':
      return (
        <Autocomplete
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          data={field.options ?? []}
          key={f.key(field.name)}
          {...f.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'tags': {
      const { value, onChange } = f.getInputProps(field.name);
      return (
        <div className={colSpanClass}>
          <TagsInput
            label={field.label}
            description={field.description}
            withAsterisk={field.required}
            allowReordering={field.allowReordering}
            placeholder={field.placeholder}
            allowDuplicates={field.allowDuplicates}
            value={value as string[]}
            onChange={onChange as (tags: string[]) => void}
            key={f.key(field.name)}
          />
        </div>
      );
    }

    case 'size': {
      const rawValue = getByPath(f.getValues(), field.name);
      return (
        <SizeInput
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          mode={field.mode}
          min={field.min}
          value={typeof rawValue === 'number' ? rawValue : 0}
          onChange={(value) => f.setFieldValue(field.name, value)}
        />
      );
    }

    case 'localizedtext':
      return (
        <LocalizedTextInput
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          value={f.values[field.name] as string | null}
          setValue={(value) => f.setFieldValue(field.name, value)}
          valueTranslations={f.values[field.translationsName] as Record<string, string>}
          setValueTranslations={(translations) =>
            (f.setFieldValue as (n: string, v: unknown) => void)(field.translationsName, translations)
          }
          languages={field.languages}
          error={f.errors[field.name] as string | undefined}
        />
      );

    case 'localizedtextarea':
      return (
        <LocalizedTextArea
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          value={f.values[field.name] as string | null}
          setValue={(value) => f.setFieldValue(field.name, value)}
          valueTranslations={f.values[field.translationsName] as Record<string, string>}
          setValueTranslations={(translations) =>
            (f.setFieldValue as (n: string, v: unknown) => void)(field.translationsName, translations)
          }
          languages={field.languages}
          rows={field.rows}
          error={f.errors[field.name] as string | undefined}
        />
      );

    case 'multiselectgroup':
      return (
        <MultiSelectGroup
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          data={field.data}
          key={f.key(field.name)}
          {...(f.getInputProps(field.name) as {
            value?: string[];
            defaultValue?: string[];
            onChange: (v: string[]) => void;
          })}
          {...field.props}
        />
      );

    case 'custom':
      return <div className={colSpanClass}>{field.render(form)}</div>;
  }
}
