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
  name: string;
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

export interface MultiSelectGroupFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'multiselectgroup';
  data: { group: string; items: { value: string; label: string }[] }[];
  props?: Partial<Omit<MultiSelectProps, 'data' | 'value' | 'onChange'>>;
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

export interface TagsFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'tags';
  allowReordering?: boolean;
  placeholder?: string;
  allowDuplicates?: boolean;
}

export interface SizeFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'size';
  mode: 'b' | 'mb';
  min: number;
}

export interface LocalizedTextFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'localizedtext';
  translationsName: keyof T & string;
  languages: string[];
}

export interface LocalizedTextAreaFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'localizedtextarea';
  translationsName: keyof T & string;
  languages: string[];
  rows?: number;
}

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
  | TagsFieldDef<T>
  | SizeFieldDef<T>
  | LocalizedTextFieldDef<T>
  | LocalizedTextAreaFieldDef<T>
  | MultiSelectGroupFieldDef<T>
  | CustomFieldDef<T>;

export type InsertPosition =
  | { at: 'prepend' }
  | { at: 'append' }
  | { at: 'before'; name: string }
  | { at: 'after'; name: string };

export interface ExtensionField<T extends Record<string, unknown>> {
  field: FieldDef<T>;
  position: InsertPosition;
}

export interface FormExtension<T extends Record<string, unknown>> {
  fields?: ExtensionField<T>[];
  overrides?: {
    [fieldName: string]: Partial<Omit<BaseFieldDef<T>, 'name'>>;
  };
}
