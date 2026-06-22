import { faExclamationTriangle, faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createBackupConfiguration from '@/api/admin/backup-configurations/createBackupConfiguration.ts';
import deleteBackupConfiguration from '@/api/admin/backup-configurations/deleteBackupConfiguration.ts';
import updateBackupConfiguration from '@/api/admin/backup-configurations/updateBackupConfiguration.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { backupDiskLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminBackupConfigurationKopiaSchema,
  adminBackupConfigurationPbsSchema,
  adminBackupConfigurationResticSchema,
  adminBackupConfigurationS3Schema,
  adminBackupConfigurationSchema,
  adminBackupConfigurationUpdateSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import BackupPBS from '@/pages/admin/backupConfigurations/forms/BackupPBS.tsx';
import BackupRestic from '@/pages/admin/backupConfigurations/forms/BackupRestic.tsx';
import BackupS3 from '@/pages/admin/backupConfigurations/forms/BackupS3.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupKopia from './forms/BackupKopia.tsx';

type BackupConfigFormValues = Partial<z.infer<typeof adminBackupConfigurationUpdateSchema>>;

export default function BackupConfigurationCreateOrUpdate({
  contextBackupConfiguration,
}: {
  contextBackupConfiguration?: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<BackupConfigFormValues>({
    initialValues: {
      name: '',
      description: null,
      maintenanceEnabled: false,
      shared: false,
      backupDisk: 'local',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationUpdateSchema),
  });

  const backupConfigS3Form = useForm<z.infer<typeof adminBackupConfigurationS3Schema>>({
    initialValues: {
      accessKey: '',
      secretKey: '',
      bucket: '',
      region: '',
      endpoint: '',
      pathStyle: true,
      partSize: 1024 * 1024 * 1024,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationS3Schema),
  });

  const backupConfigResticForm = useForm<z.infer<typeof adminBackupConfigurationResticSchema>>({
    initialValues: {
      repository: '',
      retryLockSeconds: 0,
      environment: {},
      pruneJobs: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationResticSchema),
  });

  const backupConfigPbsForm = useForm<z.infer<typeof adminBackupConfigurationPbsSchema>>({
    initialValues: {
      url: '',
      datastore: '',
      namespace: '',
      tokenId: '',
      tokenSecret: '',
      fingerprint: '',
      backupIdPrefix: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationPbsSchema),
  });

  const backupConfigKopiaForm = useForm<z.infer<typeof adminBackupConfigurationKopiaSchema>>({
    initialValues: {
      url: '',
      username: '',
      password: '',
      fingerprint: '',
      tags: {},
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationKopiaSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    BackupConfigFormValues,
    z.infer<typeof adminBackupConfigurationSchema>
  >({
    form,
    createFn: () =>
      createBackupConfiguration({
        ...adminBackupConfigurationUpdateSchema.parse(form.getValues()),
        backupConfigs: {
          s3: backupConfigS3Form.isDirty()
            ? adminBackupConfigurationS3Schema.parse(backupConfigS3Form.getValues())
            : null,
          restic: backupConfigResticForm.isDirty()
            ? adminBackupConfigurationResticSchema.parse(backupConfigResticForm.getValues())
            : null,
          pbs: backupConfigPbsForm.isDirty()
            ? adminBackupConfigurationPbsSchema.parse(backupConfigPbsForm.getValues())
            : null,
          kopia: backupConfigKopiaForm.isDirty()
            ? adminBackupConfigurationKopiaSchema.parse(backupConfigKopiaForm.getValues())
            : null,
        },
      }),
    updateFn: contextBackupConfiguration
      ? () =>
          updateBackupConfiguration(contextBackupConfiguration.uuid, {
            ...adminBackupConfigurationUpdateSchema.parse(form.getValues()),
            backupConfigs: {
              s3: backupConfigS3Form.isDirty()
                ? adminBackupConfigurationS3Schema.parse(backupConfigS3Form.getValues())
                : null,
              restic: backupConfigResticForm.isDirty()
                ? adminBackupConfigurationResticSchema.parse(backupConfigResticForm.getValues())
                : null,
              pbs: backupConfigPbsForm.isDirty()
                ? adminBackupConfigurationPbsSchema.parse(backupConfigPbsForm.getValues())
                : null,
              kopia: backupConfigKopiaForm.isDirty()
                ? adminBackupConfigurationKopiaSchema.parse(backupConfigKopiaForm.getValues())
                : null,
            },
          })
      : undefined,
    deleteFn: contextBackupConfiguration ? () => deleteBackupConfiguration(contextBackupConfiguration.uuid) : undefined,
    doUpdate: !!contextBackupConfiguration,
    basePath: '/admin/backup-configurations',
    resourceName: t('pages.admin.backupConfigurations.resourceName', {}),
  });

  useEffect(() => {
    if (contextBackupConfiguration) {
      form.setValues({
        name: contextBackupConfiguration.name,
        description: contextBackupConfiguration.description,
        maintenanceEnabled: contextBackupConfiguration.maintenanceEnabled,
        shared: contextBackupConfiguration.shared,
        backupDisk: contextBackupConfiguration.backupDisk,
      });
      if (contextBackupConfiguration.backupConfigs?.s3) {
        backupConfigS3Form.setValues(contextBackupConfiguration.backupConfigs.s3);
      }
      if (contextBackupConfiguration.backupConfigs?.restic) {
        backupConfigResticForm.setValues({
          ...contextBackupConfiguration.backupConfigs.restic,
          pruneJobs: contextBackupConfiguration.backupConfigs.restic.pruneJobs ?? [],
        });
      }
      if (contextBackupConfiguration.backupConfigs?.pbs) {
        backupConfigPbsForm.setValues({
          ...contextBackupConfiguration.backupConfigs.pbs,
          namespace: contextBackupConfiguration.backupConfigs.pbs.namespace ?? '',
          backupIdPrefix: contextBackupConfiguration.backupConfigs.pbs.backupIdPrefix ?? '',
        });
      }
      if (contextBackupConfiguration.backupConfigs?.kopia) {
        backupConfigKopiaForm.setValues({
          ...contextBackupConfiguration.backupConfigs.kopia,
          tags: contextBackupConfiguration.backupConfigs.kopia.tags ?? {},
        });
      }
    }
  }, [contextBackupConfiguration]);

  const fields: FieldDef<BackupConfigFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'backupDisk',
      label: t('pages.admin.backupConfigurations.tabs.general.page.form.backupDisk', {}),
      required: true,
      options: Object.entries(backupDiskLabelMapping).map(([value, label]) => ({ value, label })),
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3, colSpan: 'full' },
    {
      type: 'switch',
      name: 'maintenanceEnabled',
      label: t('common.form.maintenanceEnabled', {}),
      description: t('pages.admin.backupConfigurations.tabs.general.page.form.maintenanceEnabledDescription', {}),
    },
    {
      type: 'switch',
      name: 'shared',
      label: t('pages.admin.backupConfigurations.tabs.general.page.form.shared', {}),
      description: t('pages.admin.backupConfigurations.tabs.general.page.form.sharedDescription', {}),
    },
  ];

  return (
    <AdminContentContainer
      title={t(
        contextBackupConfiguration
          ? 'pages.admin.backupConfigurations.tabs.general.page.titleUpdate'
          : 'pages.admin.backupConfigurations.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextBackupConfiguration}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.backupConfigurations.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.backupConfigurations.tabs.general.page.modal.delete.content', {
          name: form.getValues().name ?? '',
        }).md()}
      </ConfirmationModal>

      {form.values.backupDisk === 'ddup-bak' && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
          {t('pages.admin.backupConfigurations.tabs.general.page.alert.ddupBak', {})}
        </Alert>
      )}
      {form.values.backupDisk === 'btrfs' && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
          {t('pages.admin.backupConfigurations.tabs.general.page.alert.btrfs', {
            docsUrl: 'https://calagopus.com/docs/wings/disk-limiters/btrfs-subvolume',
          }).md()}
        </Alert>
      )}
      {form.values.backupDisk === 'zfs' && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
          {t('pages.admin.backupConfigurations.tabs.general.page.alert.zfs', {
            docsUrl: 'https://calagopus.com/docs/wings/disk-limiters/zfs-dataset',
          }).md()}
        </Alert>
      )}
      {form.values.backupDisk === 'proxmox-backup-server' && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
          {t('pages.admin.backupConfigurations.tabs.general.page.alert.pbs', {}).md()}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.backupConfigurations.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan
            action={contextBackupConfiguration ? 'backup-configurations.update' : 'backup-configurations.create'}
            cantSave
          >
            <Button
              type='submit'
              disabled={
                !form.isValid() ||
                ((form.getValues().backupDisk === 's3' || backupConfigS3Form.isDirty()) &&
                  !backupConfigS3Form.isValid()) ||
                ((form.getValues().backupDisk === 'restic' || backupConfigResticForm.isDirty()) &&
                  !backupConfigResticForm.isValid()) ||
                ((form.getValues().backupDisk === 'proxmox-backup-server' || backupConfigPbsForm.isDirty()) &&
                  !backupConfigPbsForm.isValid()) ||
                ((form.getValues().backupDisk === 'kopia' || backupConfigKopiaForm.isDirty()) &&
                  !backupConfigKopiaForm.isValid())
              }
              loading={loading}
            >
              {t('common.button.save', {})}
            </Button>
            {!contextBackupConfiguration && (
              <Button
                onClick={() => doCreateOrUpdate(true)}
                disabled={
                  !form.isValid() ||
                  ((form.getValues().backupDisk === 's3' || backupConfigS3Form.isDirty()) &&
                    !backupConfigS3Form.isValid()) ||
                  ((form.getValues().backupDisk === 'restic' || backupConfigResticForm.isDirty()) &&
                    !backupConfigResticForm.isValid()) ||
                  ((form.getValues().backupDisk === 'proxmox-backup-server' || backupConfigPbsForm.isDirty()) &&
                    !backupConfigPbsForm.isValid()) ||
                  ((form.getValues().backupDisk === 'kopia' || backupConfigKopiaForm.isDirty()) &&
                    !backupConfigKopiaForm.isValid())
                }
                loading={loading}
              >
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextBackupConfiguration && (
            <AdminCan action='backup-configurations.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
          <a
            href='https://calagopus.com/docs/advanced/setting-up-backup-configurations'
            target='_blank'
            rel='noopener noreferrer'
          >
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              {t('common.button.viewDocumentation', {})}
            </Button>
          </a>
        </Group>

        {(form.getValues().backupDisk === 's3' || backupConfigS3Form.isDirty() || backupConfigS3Form.isTouched()) && (
          <BackupS3 form={backupConfigS3Form} />
        )}
        {(form.getValues().backupDisk === 'restic' ||
          backupConfigResticForm.isDirty() ||
          backupConfigResticForm.isTouched()) && <BackupRestic form={backupConfigResticForm} />}
        {(form.getValues().backupDisk === 'proxmox-backup-server' ||
          backupConfigPbsForm.isDirty() ||
          backupConfigPbsForm.isTouched()) && <BackupPBS form={backupConfigPbsForm} />}
        {(form.getValues().backupDisk === 'kopia' ||
          backupConfigKopiaForm.isDirty() ||
          backupConfigKopiaForm.isTouched()) && <BackupKopia form={backupConfigKopiaForm} />}
      </form>
    </AdminContentContainer>
  );
}
