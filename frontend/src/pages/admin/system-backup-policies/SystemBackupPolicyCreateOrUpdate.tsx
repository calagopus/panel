import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createSystemBackupPolicy from '@/api/admin/system-backup-policies/createSystemBackupPolicy.ts';
import deleteSystemBackupPolicy from '@/api/admin/system-backup-policies/deleteSystemBackupPolicy.ts';
import triggerSystemBackupPolicy from '@/api/admin/system-backup-policies/triggerSystemBackupPolicy.ts';
import updateSystemBackupPolicy from '@/api/admin/system-backup-policies/updateSystemBackupPolicy.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import {
  adminSystemBackupPolicySchema,
  adminSystemBackupPolicyUpdateSchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  type SystemBackupPolicyFormValues,
  systemBackupPolicyEmptyFormValues,
  systemBackupPolicyToFormValues,
  useSystemBackupPolicyFormFields,
} from './systemBackupPolicyFormValues.tsx';

export default function SystemBackupPolicyCreateOrUpdate({
  contextSystemBackupPolicy,
}: {
  contextSystemBackupPolicy?: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();

  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');
  const [openModal, setOpenModal] = useState<'delete' | 'trigger' | null>(null);
  const [deleteBackups, setDeleteBackups] = useState(false);

  const doTrigger = async () => {
    if (!contextSystemBackupPolicy) {
      return;
    }

    await triggerSystemBackupPolicy(contextSystemBackupPolicy.uuid)
      .then(() => {
        addToast(t('pages.admin.systemBackupPolicies.tabs.general.page.toast.triggered', {}), 'success');

        setOpenModal(null);
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.systemBackupPolicies.detail(contextSystemBackupPolicy.uuid),
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const form = useFormEngine<SystemBackupPolicyFormValues>('admin.systemBackupPolicies.createOrUpdate', {
    schema: adminSystemBackupPolicyUpdateSchema.unwrap(),
    initialValues: systemBackupPolicyEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    SystemBackupPolicyFormValues,
    z.infer<typeof adminSystemBackupPolicySchema>
  >({
    form,
    createFn: () => createSystemBackupPolicy(adminSystemBackupPolicyUpdateSchema.parse(form.getValues())),
    updateFn: contextSystemBackupPolicy
      ? () =>
          updateSystemBackupPolicy(
            contextSystemBackupPolicy.uuid,
            adminSystemBackupPolicyUpdateSchema.parse(form.getValues()),
          )
      : undefined,
    deleteFn: contextSystemBackupPolicy
      ? () => deleteSystemBackupPolicy(contextSystemBackupPolicy.uuid, { deleteBackups })
      : undefined,
    doUpdate: !!contextSystemBackupPolicy,
    basePath: '/admin/system-backup-policies',
    resourceName: t('pages.admin.systemBackupPolicies.resourceName', {}),
  });

  useHydrateForm(form, contextSystemBackupPolicy, systemBackupPolicyToFormValues);

  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextSystemBackupPolicy?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  const fields = useSystemBackupPolicyFormFields({ backupConfigurations, canReadBackupConfigurations });

  return (
    <AdminContentContainer
      title={
        contextSystemBackupPolicy
          ? t('pages.admin.systemBackupPolicies.tabs.general.page.titleUpdate', {})
          : t('pages.admin.systemBackupPolicies.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextSystemBackupPolicy}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => {
          setOpenModal(null);
          setDeleteBackups(false);
        }}
        title={t('pages.admin.systemBackupPolicies.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('common.modal.delete.content', {
            name: form.getValues().name,
          }).md()}

          <Switch
            label={t('pages.admin.systemBackupPolicies.tabs.general.page.modal.delete.form.deleteBackups', {})}
            name='deleteBackups'
            checked={deleteBackups}
            onChange={(e) => setDeleteBackups(e.target.checked)}
          />

          {deleteBackups ? (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.admin.systemBackupPolicies.tabs.general.page.modal.delete.alert.deleteBackupsWarning', {})}
            </Alert>
          ) : (
            <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.admin.systemBackupPolicies.tabs.general.page.modal.delete.alert.releaseWarning', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ConfirmationModal
        opened={openModal === 'trigger'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.systemBackupPolicies.tabs.general.page.modal.trigger.title', {})}
        confirm={t('pages.admin.systemBackupPolicies.tabs.general.page.button.runNow', {})}
        onConfirmed={doTrigger}
      >
        {t('pages.admin.systemBackupPolicies.tabs.general.page.modal.trigger.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.systemBackupPolicies.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan
            action={contextSystemBackupPolicy ? 'system-backup-policies.update' : 'system-backup-policies.create'}
            cantSave
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextSystemBackupPolicy && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextSystemBackupPolicy && (
            <>
              <AdminCan action='system-backup-policies.update'>
                <Button
                  variant='default'
                  onClick={() => setOpenModal('trigger')}
                  loading={loading || !!contextSystemBackupPolicy.triggered}
                >
                  {t('pages.admin.systemBackupPolicies.tabs.general.page.button.runNow', {})}
                </Button>
              </AdminCan>
              <AdminCan action='system-backup-policies.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            </>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
