import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createRole from '@/api/admin/roles/createRole.ts';
import deleteRole from '@/api/admin/roles/deleteRole.ts';
import updateRole from '@/api/admin/roles/updateRole.ts';
import getPermissions from '@/api/getPermissions.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type RoleFormValues = z.infer<typeof adminRoleUpdateSchema>;

export default function RoleCreateOrUpdate({ contextRole }: { contextRole?: z.infer<typeof roleSchema> }) {
  const { t } = useTranslations();
  const { availablePermissions, setAvailablePermissions } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<RoleFormValues>({
    initialValues: {
      name: '',
      description: null,
      requireTwoFactor: false,
      adminPermissions: [],
      serverPermissions: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminRoleUpdateSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    RoleFormValues,
    z.infer<typeof roleSchema>
  >({
    form,
    createFn: () => createRole(adminRoleUpdateSchema.parse(form.getValues())),
    updateFn: contextRole
      ? () => updateRole(contextRole.uuid, adminRoleUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextRole ? () => deleteRole(contextRole.uuid) : undefined,
    doUpdate: !!contextRole,
    basePath: '/admin/roles',
    resourceName: t('pages.admin.roles.resourceName', {}),
  });

  useEffect(() => {
    if (contextRole) {
      form.setValues({
        name: contextRole.name,
        description: contextRole.description,
        adminPermissions: contextRole.adminPermissions,
        serverPermissions: contextRole.serverPermissions,
      });
    }
  }, [contextRole]);

  useEffect(() => {
    setLoading(true);
    getPermissions().then((res) => {
      setAvailablePermissions(res);
      setLoading(false);
    });
  }, []);

  const fields: FieldDef<RoleFormValues>[] = [
    {
      type: 'text',
      name: 'name',
      label: t('common.form.name', {}),
      required: true,
    },
    {
      type: 'textarea',
      name: 'description',
      label: t('common.form.description', {}),
      rows: 3,
    },
    {
      type: 'switch',
      name: 'requireTwoFactor',
      label: t('pages.admin.roles.tabs.general.page.form.requireTwoFactor', {}),
      description: t('pages.admin.roles.tabs.general.page.form.requireTwoFactorDescription', {}),
    },
    {
      type: 'custom',
      name: 'serverPermissions',
      colSpan: 'full',
      when: () => !!availablePermissions?.serverPermissions,
      render: (f) => (
        <PermissionSelector
          label={t('pages.admin.roles.tabs.general.page.form.serverPermissions', {})}
          permissionsMapType='serverPermissions'
          permissions={availablePermissions!.serverPermissions}
          selectedPermissions={f.getValues().serverPermissions}
          setSelectedPermissions={(permissions) => f.setFieldValue('serverPermissions', permissions)}
        />
      ),
    },
    {
      type: 'custom',
      name: 'adminPermissions',
      colSpan: 'full',
      when: () => !!availablePermissions?.adminPermissions,
      render: (f) => (
        <PermissionSelector
          label={t('pages.admin.roles.tabs.general.page.form.adminPermissions', {})}
          permissionsMapType='adminPermissions'
          permissions={availablePermissions!.adminPermissions}
          selectedPermissions={f.getValues().adminPermissions}
          setSelectedPermissions={(permissions) => f.setFieldValue('adminPermissions', permissions)}
        />
      ),
    },
  ];

  return (
    <AdminContentContainer
      title={t(
        contextRole
          ? 'pages.admin.roles.tabs.general.page.titleUpdate'
          : 'pages.admin.roles.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextRole}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.roles.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.roles.tabs.general.page.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {form.values.adminPermissions.includes('users.impersonate') && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
          {t('pages.admin.roles.tabs.general.page.alert.impersonate', {}).md()}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.roles.all()))}>
        <FormEngine form={form} fields={fields} showAdvancedToggle />

        <Group mt='md'>
          <AdminCan action={contextRole ? 'roles.update' : 'roles.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextRole && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextRole && (
            <AdminCan action='roles.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
