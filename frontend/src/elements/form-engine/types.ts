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
import type { ZodType } from 'zod';
import { LazyString } from '@/lib/lazy.ts';

export { resolveString } from '@/lib/lazy.ts';
export type { LazyString };

export type ZodFieldShape = Record<string, ZodType>;

export interface FieldOption {
  value: string;
  label: LazyString;
}

export type ColSpan = 'full' | 1;

interface BaseFieldDef<T extends Record<string, unknown>> {
  name: string;
  label: LazyString;
  description?: LazyString;
  tooltip?: ReactNode;
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
  options: FieldOption[];
  props?: Partial<SelectProps>;
}

export interface MultiSelectFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'multiselect';
  options: FieldOption[];
  props?: Partial<MultiSelectProps>;
}

export interface MultiSelectGroupFieldDef<T extends Record<string, unknown>> extends BaseFieldDef<T> {
  type: 'multiselectgroup';
  data: { group: LazyString; items: FieldOption[] }[];
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
  placeholder?: LazyString;
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

export interface DividerFieldDef<T extends Record<string, unknown>> {
  type: 'divider';
  name: string;
  label?: LazyString;
  switchName?: string;
  switchLabel?: LazyString;
  switchProps?: Partial<SwitchProps>;
  advanced?: boolean;
  when?: (values: T) => boolean;
}

export interface CustomFieldDef<T extends Record<string, unknown>> {
  type: 'custom';
  name: string;
  label?: LazyString;
  advanced?: boolean;
  colSpan?: ColSpan;
  when?: (values: T) => boolean;
  render: (form: UseFormReturnType<T>) => ReactNode;
}

export type FieldDef<T extends Record<string, unknown> = Record<string, unknown>> =
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
  | DividerFieldDef<T>
  | CustomFieldDef<T>;

export type FieldTransform<T extends Record<string, unknown> = Record<string, unknown>> = (
  fields: FieldDef<T>[],
) => FieldDef<T>[];

export interface RegisteredFormIds {
  'admin.roles.createOrUpdate': true;
  'admin.nests.createOrUpdate': true;
  'admin.nests.eggs.installationScript': true;
  'admin.nests.eggs.variables': true;
  'admin.oAuthProviders.createOrUpdate': true;
  'admin.databaseHosts.createOrUpdate': true;
  'admin.databaseHosts.credentialDetails': true;
  'admin.databaseAgentHosts.createOrUpdate': true;
  'admin.databaseAgentTemplates.createOrUpdate': true;
  'admin.nodes.createOrUpdate': true;
  'admin.nodes.locationModal': true;
  'admin.mounts.createOrUpdate': true;
  'admin.backupConfigurations.createOrUpdate': true;
  'admin.backupConfigurations.pbs': true;
  'admin.backupConfigurations.s3': true;
  'admin.backupConfigurations.restic': true;
  'admin.backupConfigurations.kopia': true;
  'admin.servers.create': true;
  'admin.servers.update': true;
  'admin.locations.createOrUpdate': true;
  'admin.eggRepositories.createOrUpdate': true;
  'admin.eggConfigurations.createOrUpdate': true;
  'admin.users.createOrUpdate': true;
  'admin.announcements.createOrUpdate': true;
  'admin.settings.server': true;
  'admin.settings.webauthn': true;
  'admin.settings.application': true;
  'admin.settings.user': true;
  'admin.settings.captcha.hcaptcha': true;
  'admin.settings.captcha.recaptcha': true;
  'admin.settings.captcha.turnstile': true;
  'admin.settings.captcha.friendlyCaptcha': true;
  'admin.settings.email.sendmail': true;
  'admin.settings.email.smtp': true;
  'admin.settings.email.file': true;
  'admin.settings.storage.filesystem': true;
  'admin.settings.storage.s3': true;
}

export type FormId = keyof RegisteredFormIds;
