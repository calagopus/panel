import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { adminFullUserSchema, adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type UserFormValues = z.infer<typeof adminUserUpdateSchema>;

// `language` is filled in by the component from the app's configured language.
export const userEmptyFormValues: UserFormValues = {
  externalId: null,
  username: '',
  email: '',
  nameFirst: '',
  nameLast: '',
  password: null,
  admin: false,
  frozen: false,
  suspended: false,
  language: '',
  roleUuid: null,
};

export const userToFormValues = (user: z.infer<typeof adminFullUserSchema>): Partial<UserFormValues> => ({
  externalId: user.externalId,
  username: user.username,
  email: user.email,
  nameFirst: user.nameFirst,
  nameLast: user.nameLast,
  password: null,
  admin: user.admin,
  frozen: user.frozen,
  suspended: user.suspended,
  language: user.language,
  roleUuid: user.role?.uuid ?? null,
});

interface UserFormFieldsOptions {
  isRootAdmin: boolean;
  editingOtherUser: boolean;
  isUpdate: boolean;
  languages: string[];
  roles: ReturnType<typeof useSearchableResource<z.infer<typeof roleSchema>>>;
  canReadRoles: boolean;
}

export function useUserFormFields({
  isRootAdmin,
  editingOtherUser,
  isUpdate,
  languages,
  roles,
  canReadRoles,
}: UserFormFieldsOptions): FieldDef<UserFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'username', label: t('common.table.columns.username', {}), required: true },
    {
      type: 'text',
      name: 'email',
      label: t('common.form.email', {}),
      required: true,
      props: { type: 'email', disabled: !isRootAdmin && editingOtherUser },
    },
    { type: 'text', name: 'nameFirst', label: t('common.form.firstName', {}) },
    { type: 'text', name: 'nameLast', label: t('common.form.lastName', {}) },
    {
      type: 'select',
      name: 'language',
      label: t('common.form.language', {}),
      required: true,
      options: languages.map((language) => ({
        label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
        value: language,
      })),
      props: { searchable: true },
    },
    {
      type: 'select',
      name: 'roleUuid',
      label: t('pages.admin.users.tabs.general.page.form.role', {}),
      when: () => isRootAdmin,
      options: roles.items.map((role) => ({ label: role.name, value: role.uuid })),
      props: {
        placeholder: t('common.none', {}),
        searchable: true,
        searchValue: roles.search,
        onSearchChange: roles.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadRoles,
        loading: roles.loading,
      },
    },
    { type: 'text', name: 'externalId', label: t('common.form.externalId', {}) },
    {
      type: 'password',
      name: 'password',
      label: t('common.form.password', {}),
      props: { withAsterisk: !isUpdate, disabled: !isRootAdmin && editingOtherUser },
    },
    {
      type: 'switch',
      name: 'admin',
      label: t('pages.admin.users.tabs.general.page.form.admin', {}),
      when: () => isRootAdmin,
      description: t('pages.admin.users.tabs.general.page.form.adminDescription', {}),
    },
    {
      type: 'switch',
      name: 'frozen',
      label: t('pages.admin.users.tabs.general.page.form.frozen', {}),
      description: t('pages.admin.users.tabs.general.page.form.frozenDescription', {}),
    },
    {
      type: 'switch',
      name: 'suspended',
      label: t('pages.admin.users.tabs.general.page.form.suspended', {}),
      description: t('pages.admin.users.tabs.general.page.form.suspendedDescription', {}),
    },
  ];
}
