import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { apiPermissionsSchema } from '@/lib/schemas/generic.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type RoleFormValues = z.infer<typeof adminRoleUpdateSchema>;
type PermissionMapType = 'serverPermissions' | 'adminPermissions';

export const roleEmptyFormValues: RoleFormValues = {
  name: '',
  description: null,
  requireTwoFactor: false,
  adminPermissions: [],
  serverPermissions: [],
};

export const roleToFormValues = (role: z.infer<typeof roleSchema>): Partial<RoleFormValues> => ({
  name: role.name,
  description: role.description,
  requireTwoFactor: role.requireTwoFactor,
  adminPermissions: role.adminPermissions,
  serverPermissions: role.serverPermissions,
});

export function useRoleFormFields(
  availablePermissions: z.infer<typeof apiPermissionsSchema>,
): FieldDef<RoleFormValues>[] {
  const { t } = useTranslations();

  const permissionField = (name: PermissionMapType, label: string): FieldDef<RoleFormValues> => ({
    type: 'custom',
    name,
    colSpan: 'full',
    render: (f) => (
      <PermissionSelector
        label={label}
        permissionsMapType={name}
        permissions={availablePermissions[name]}
        selectedPermissions={f.getValues()[name]}
        setSelectedPermissions={(selected) => f.setFieldValue(name, selected)}
      />
    ),
  });

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    {
      type: 'switch',
      name: 'requireTwoFactor',
      label: t('pages.admin.roles.tabs.general.page.form.requireTwoFactor', {}),
      description: t('pages.admin.roles.tabs.general.page.form.requireTwoFactorDescription', {}),
    },
    permissionField('serverPermissions', t('pages.admin.roles.tabs.general.page.form.serverPermissions', {})),
    permissionField('adminPermissions', t('pages.admin.roles.tabs.general.page.form.adminPermissions', {})),
  ];
}
