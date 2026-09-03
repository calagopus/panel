import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createRole from '@/api/admin/roles/createRole.ts';
import deleteRole from '@/api/admin/roles/deleteRole.ts';
import duplicateRole from '@/api/admin/roles/duplicateRole.ts';
import updateRole from '@/api/admin/roles/updateRole.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ResourceDuplicateModal from '@/elements/modals/ResourceDuplicateModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { roleEmptyFormValues, roleToFormValues, useRoleFormFields } from './roleFormValues.tsx';

type RoleFormValues = z.infer<typeof adminRoleUpdateSchema>;

export default function RoleCreateOrUpdate({ contextRole }: { contextRole?: z.infer<typeof roleSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);
  const setAvailablePermissions = useGlobalStore((state) => state.setAvailablePermissions);

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const form = useFormEngine<RoleFormValues>('admin.roles.createOrUpdate', {
    schema: adminRoleUpdateSchema.unwrap(),
    initialValues: roleEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<RoleFormValues, z.infer<typeof roleSchema>>({
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

  useHydrateForm(form, contextRole, roleToFormValues);

  useEffect(() => {
    getPermissions()
      .then(setAvailablePermissions)
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setPermissionsLoading(false));
  }, []);

  const fields = useRoleFormFields(availablePermissions);

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
        {t('common.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextRole && (
        <ResourceDuplicateModal
          resourceName={t('pages.admin.roles.resourceName', {})}
          sourceName={contextRole.name}
          duplicate={(name) => duplicateRole(contextRole.uuid, name)}
          redirectTo={(duplicated) => `/admin/roles/${duplicated.uuid}`}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      {form.getValues().adminPermissions.includes('users.impersonate') && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
          {t('pages.admin.roles.tabs.general.page.alert.impersonate', {}).md()}
        </Alert>
      )}

      {permissionsLoading ? (
        <Spinner.Centered />
      ) : (
        <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.roles.all()))}>
          <FormEngine form={form} fields={fields} />

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
              <AdminCan action='roles.create'>
                <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                  {t('common.button.duplicate', {})}
                </Button>
              </AdminCan>
            )}
            {contextRole && (
              <AdminCan action='roles.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            )}
          </Group>
        </form>
      )}
    </AdminContentContainer>
  );
}
