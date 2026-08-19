import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import createSystemBackupPolicy from '@/api/admin/system-backup-policies/createSystemBackupPolicy.ts';
import deleteSystemBackupPolicy from '@/api/admin/system-backup-policies/deleteSystemBackupPolicy.ts';
import triggerSystemBackupPolicy from '@/api/admin/system-backup-policies/triggerSystemBackupPolicy.ts';
import updateSystemBackupPolicy from '@/api/admin/system-backup-policies/updateSystemBackupPolicy.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import CronInput from '@/elements/input/CronInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import {
  adminSystemBackupPolicySchema,
  adminSystemBackupPolicyUpdateSchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type SystemBackupPolicyFormValues = z.infer<typeof adminSystemBackupPolicyUpdateSchema>;

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
    initialValues: {
      name: '',
      description: null,
      backupConfigurationUuid: null,
      enabled: true,
      cron: '0 0 0 * * *',
      retentionCount: null,
      retentionDays: null,
      parallelism: 2,
    },
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

  useEffect(() => {
    if (contextSystemBackupPolicy) {
      form.setValues({
        name: contextSystemBackupPolicy.name,
        description: contextSystemBackupPolicy.description,
        backupConfigurationUuid: contextSystemBackupPolicy.backupConfiguration?.uuid ?? null,
        enabled: contextSystemBackupPolicy.enabled,
        cron: contextSystemBackupPolicy.cron,
        retentionCount: contextSystemBackupPolicy.retentionCount,
        retentionDays: contextSystemBackupPolicy.retentionDays,
        parallelism: contextSystemBackupPolicy.parallelism,
      });
    }
  }, [contextSystemBackupPolicy]);

  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextSystemBackupPolicy?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  const fields: FieldDef<SystemBackupPolicyFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid })),
      props: {
        placeholder: t('pages.admin.systemBackupPolicies.form.backupConfigurationPlaceholder', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadBackupConfigurations,
        loading: backupConfigurations.loading,
      },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3, colSpan: 'full' },
    {
      type: 'custom',
      name: 'cron',
      render: (form) => {
        const inputProps = form.getInputProps('cron');

        return (
          <CronInput
            label={t('pages.admin.systemBackupPolicies.form.cron', {})}
            description={t('pages.admin.systemBackupPolicies.form.cronDescription', {})}
            required
            placeholder='0 0 0 * * *'
            value={form.values.cron}
            onChange={inputProps.onChange}
            onBlur={inputProps.onBlur}
            error={inputProps.error}
          />
        );
      },
    },
    {
      type: 'number',
      name: 'parallelism',
      label: t('pages.admin.systemBackupPolicies.form.parallelism', {}),
      description: t('pages.admin.systemBackupPolicies.form.parallelismDescription', {}),
      required: true,
      props: { min: 1, max: 100, allowDecimal: false },
    },
    {
      type: 'number',
      name: 'retentionCount',
      label: t('pages.admin.systemBackupPolicies.form.retentionCount', {}),
      description: t('pages.admin.systemBackupPolicies.form.retentionCountDescription', {}),
      props: { min: 1, allowDecimal: false },
    },
    {
      type: 'number',
      name: 'retentionDays',
      label: t('pages.admin.systemBackupPolicies.form.retentionDays', {}),
      description: t('pages.admin.systemBackupPolicies.form.retentionDaysDescription', {}),
      props: { min: 1, allowDecimal: false },
    },
    {
      type: 'switch',
      name: 'enabled',
      label: t('common.form.enabled', {}),
      description: t('pages.admin.systemBackupPolicies.form.enabledDescription', {}),
    },
  ];

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
          {t('pages.admin.systemBackupPolicies.tabs.general.page.modal.delete.content', {
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
