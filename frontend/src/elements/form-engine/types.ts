import {
  AutocompleteProps,
  CheckboxProps,
  MultiSelectProps,
  NumberInputProps,
  PasswordInputProps,
  SelectProps,
  SwitchProps,
  TextareaProps,
  TextInputProps,
} from '@mantine/core';
import { DateTimePickerProps } from '@mantine/dates';
import { UseFormReturnType } from '@mantine/form';
import { ReactNode } from 'react';

export type ColSpan = 'full' | 1;

interface BaseFieldDef<T extends Record<string, unknown>> {
  name: keyof T & string;
  label: string;
  description?: string;
  required?: boolean;
  advanced?: boolean;
  colSpan?: ColSpan;
  when?: (values: T) => boolean;
}

export interface TextFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'text';
  props?: Partial<TextInputProps>;
}

export interface PasswordFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'password';
  props?: Partial<PasswordInputProps>;
}

export interface TextAreaFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'textarea';
  rows?: number;
  props?: Partial<TextareaProps>;
}

export interface NumberFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'number';
  props?: Partial<NumberInputProps>;
}

export interface SwitchFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'switch';
  props?: Partial<SwitchProps>;
}

export interface CheckboxFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'checkbox';
  props?: Partial<CheckboxProps>;
}

export interface SelectFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'select';
  options: { value: string; label: string }[];
  props?: Partial<SelectProps>;
}

export interface MultiSelectFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'multiselect';
  options: { value: string; label: string }[];
  props?: Partial<MultiSelectProps>;
}

export interface DateFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'date';
  props?: Partial<DateTimePickerProps>;
}

export interface AutocompleteFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'autocomplete';
  options?: string[];
  props?: Partial<AutocompleteProps>;
}

/**
 * Fully custom field. `render` receives the form instance and returns any ReactNode.
 * `name` is used as a React key only; it does not need to match a form field.
 */
export interface CustomFieldDef<T extends Record<string, unknown>> {
  type: 'custom';
  name: string;
  label?: string;
  advanced?: boolean;
  colSpan?: ColSpan;
  when?: (values: T) => boolean;
  render: (form: UseFormReturnType<T>) => ReactNode;
}

export type FieldDef<T extends Record<string, unknown>> =
  | TextFieldDef<T>
  | PasswordFieldDef<T>
  | TextAreaFieldDef<T>
  | NumberFieldDef<T>
  | SwitchFieldDef<T>
  | CheckboxFieldDef<T>
  | SelectFieldDef<T>
  | MultiSelectFieldDef<T>
  | DateFieldDef<T>
  | AutocompleteFieldDef<T>
  | CustomFieldDef<T>;

// ---------------------------------------------------------------------------
// Extension API
// ---------------------------------------------------------------------------

export type InsertPosition =
  | { at: 'prepend' }
  | { at: 'append' }
  | { at: 'before'; name: string }
  | { at: 'after'; name: string };

export interface ExtensionField<T extends Record<string, unknown>> {
  field: FieldDef<T>;
  position: InsertPosition;
}

/**
 * A FormExtension can inject additional fields at any position and/or override
 * properties on existing fields (by name).
 */
export interface FormExtension<T extends Record<string, unknown>> {
  fields?: ExtensionField<T>[];
  /** Override label/description/required/advanced/colSpan/when on any existing field. */
  overrides?: {
    [fieldName: string]: Partial<Omit<BaseFieldDef<T>, 'name'>>;
  };
}
