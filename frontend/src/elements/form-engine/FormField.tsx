import { UseFormReturnType } from '@mantine/form';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import DateTimePicker from '@/elements/input/DateTimePicker.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { FieldDef } from './types.ts';

interface Props<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  field: FieldDef<T>;
}

export function FormField<T extends Record<string, unknown>>({ form, field }: Props<T>) {
  if (field.when && !field.when(form.values)) return null;

  const colSpanClass = field.colSpan === 'full' ? 'col-span-full' : undefined;

  switch (field.type) {
    case 'text':
      return (
        <TextInput
          className={colSpanClass}
          label={field.label}
          description={field.description}
          withAsterisk={field.required}
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'switch':
      return (
        <Switch
          className={colSpanClass}
          label={field.label}
          description={field.description}
          key={form.key(field.name)}
          {...form.getInputProps(field.name, { type: 'checkbox' })}
          {...field.props}
        />
      );

    case 'checkbox':
      return (
        <Checkbox
          className={colSpanClass}
          label={field.label}
          description={field.description}
          key={form.key(field.name)}
          {...form.getInputProps(field.name, { type: 'checkbox' })}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
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
          key={form.key(field.name)}
          {...form.getInputProps(field.name)}
          {...field.props}
        />
      );

    case 'custom':
      return <div className={colSpanClass}>{field.render(form)}</div>;
  }
}
