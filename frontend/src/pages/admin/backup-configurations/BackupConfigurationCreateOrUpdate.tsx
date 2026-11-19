import { faExclamationTriangle, faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createBackupConfiguration from '@/api/admin/backup-configurations/createBackupConfiguration.ts';
import deleteBackupConfiguration from '@/api/admin/backup-configurations/deleteBackupConfiguration.ts';
import updateBackupConfiguration from '@/api/admin/backup-configurations/updateBackupConfiguration.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
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
import BackupPBS from '@/pages/admin/backup-configurations/forms/BackupPBS.tsx';
import BackupRestic from '@/pages/admin/backup-configurations/forms/BackupRestic.tsx';
import BackupS3 from '@/pages/admin/backup-configurations/forms/BackupS3.tsx';
import BackupConfigurationDuplicateModal from '@/pages/admin/backup-configurations/modals/BackupConfigurationDuplicateModal.tsx';
import BackupConfigurationTestModal from '@/pages/admin/backup-configurations/modals/BackupConfigurationTestModal.tsx';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  backupConfigurationEmptyFormValues,
  backupConfigurationKopiaEmptyFormValues,
  backupConfigurationPbsEmptyFormValues,
  backupConfigurationResticEmptyFormValues,
  backupConfigurationS3EmptyFormValues,
  backupConfigurationToFormValues,
  useBackupConfigurationFormFields,
} from './backupConfigurationFormValues.tsx';
import BackupKopia from './forms/BackupKopia.tsx';

type BackupConfigFormValues = Partial<z.infer<typeof adminBackupConfigurationUpdateSchema>>;
type BackupDisk = z.infer<typeof adminBackupConfigurationSchema>['backupDisk'];
type TranslationKey = Parameters<ReturnType<typeof useTranslations>['t']>[0];

const PROVIDER_DISKS = {
  s3: 's3',
  restic: 'restic',
  pbs: 'proxmox-backup-server',
  kopia: 'kopia',
} as const satisfies Record<string, BackupDisk>;

function providerFlags<V extends Record<string, unknown>>(disk: BackupDisk, form: UseFormReturnType<V>) {
  return { disk, dirty: form.isDirty(), touched: form.isTouched(), valid: form.isValid() };
}

const DISK_ALERTS: Partial<Record<BackupDisk, { key: TranslationKey; params?: Record<string, string> }>> = {
  'ddup-bak': { key: 'pages.admin.backupConfigurations.tabs.general.page.alert.ddupBak' },
  btrfs: {
    key: 'pages.admin.backupConfigurations.tabs.general.page.alert.btrfs',
    params: { docsUrl: 'https://calagopus.com/docs/wings/disk-limiters/btrfs-subvolume' },
  },
  zfs: {
    key: 'pages.admin.backupConfigurations.tabs.general.page.alert.zfs',
    params: { docsUrl: 'https://calagopus.com/docs/wings/disk-limiters/zfs-dataset' },
  },
  'proxmox-backup-server': { key: 'pages.admin.backupConfigurations.tabs.general.page.alert.pbs' },
};

function blankNulls<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
  const next = { ...obj };
  for (const key of keys) {
    if (next[key] === null || next[key] === undefined) {
      next[key] = '' as T[keyof T];
    }
  }
  return next;
}

export default function BackupConfigurationCreateOrUpdate({
  contextBackupConfiguration,
}: {
  contextBackupConfiguration?: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | 'test' | null>(null);
  const [removeProvider, setRemoveProvider] = useState<typeof backupDisk | null>(null);

  const form = useFormEngine<BackupConfigFormValues, z.infer<typeof adminBackupConfigurationUpdateSchema>>(
    'admin.backupConfigurations.createOrUpdate',
    {
      schema: adminBackupConfigurationUpdateSchema.unwrap(),
      initialValues: backupConfigurationEmptyFormValues,
    },
  );

  const s3Form = useFormEngine<z.infer<typeof adminBackupConfigurationS3Schema>>('admin.backupConfigurations.s3', {
    schema: adminBackupConfigurationS3Schema,
    initialValues: backupConfigurationS3EmptyFormValues,
  });

  const resticForm = useFormEngine<z.infer<typeof adminBackupConfigurationResticSchema>>(
    'admin.backupConfigurations.restic',
    {
      schema: adminBackupConfigurationResticSchema,
      initialValues: backupConfigurationResticEmptyFormValues,
    },
  );

  const pbsForm = useFormEngine<z.infer<typeof adminBackupConfigurationPbsSchema>>('admin.backupConfigurations.pbs', {
    schema: adminBackupConfigurationPbsSchema,
    initialValues: backupConfigurationPbsEmptyFormValues,
  });

  const kopiaForm = useFormEngine<z.infer<typeof adminBackupConfigurationKopiaSchema>>(
    'admin.backupConfigurations.kopia',
    {
      schema: adminBackupConfigurationKopiaSchema,
      initialValues: backupConfigurationKopiaEmptyFormValues,
    },
  );

  const backupDisk = form.values.backupDisk;

  const flags = {
    s3: providerFlags(PROVIDER_DISKS.s3, s3Form),
    restic: providerFlags(PROVIDER_DISKS.restic, resticForm),
    pbs: providerFlags(PROVIDER_DISKS.pbs, pbsForm),
    kopia: providerFlags(PROVIDER_DISKS.kopia, kopiaForm),
  };

  const providerVisible = (f: ReturnType<typeof providerFlags>) => backupDisk === f.disk || f.dirty || f.touched;

  const resetProviderForm = (provider: typeof backupDisk) => {
    switch (provider) {
      case 's3':
        s3Form.reset();
        break;
      case 'restic':
        resticForm.reset();
        break;
      case 'proxmox-backup-server':
        pbsForm.reset();
        break;
      case 'kopia':
        kopiaForm.reset();
        break;
    }
  };

  const buildBackupConfigs = () => ({
    s3: s3Form.isDirty() ? s3Form.getTransformedValues() : null,
    restic: resticForm.isDirty() ? resticForm.getTransformedValues() : null,
    pbs: pbsForm.isDirty() ? pbsForm.getTransformedValues() : null,
    kopia: kopiaForm.isDirty() ? kopiaForm.getTransformedValues() : null,
  });

  const submitDisabled =
    !form.isValid() || Object.values(flags).some((f) => (backupDisk === f.disk || f.dirty) && !f.valid);

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    BackupConfigFormValues,
    z.infer<typeof adminBackupConfigurationSchema>
  >({
    form,
    createFn: () =>
      createBackupConfiguration({
        ...form.getTransformedValues(),
        backupConfigs: buildBackupConfigs(),
      }),
    updateFn: contextBackupConfiguration
      ? () =>
          updateBackupConfiguration(contextBackupConfiguration.uuid, {
            ...form.getTransformedValues(),
            backupConfigs: buildBackupConfigs(),
          })
      : undefined,
    deleteFn: contextBackupConfiguration ? () => deleteBackupConfiguration(contextBackupConfiguration.uuid) : undefined,
    doUpdate: !!contextBackupConfiguration,
    basePath: '/admin/backup-configurations',
    resourceName: t('pages.admin.backupConfigurations.resourceName', {}),
  });

  useEffect(() => {
    if (!contextBackupConfiguration) {
      return;
    }

    form.setValues(backupConfigurationToFormValues(contextBackupConfiguration));

    const configs = contextBackupConfiguration.backupConfigs;
    if (configs?.s3) {
      s3Form.setValues(configs.s3);
    }
    if (configs?.restic) {
      resticForm.setValues({ ...configs.restic, pruneJobs: configs.restic.pruneJobs ?? [] });
    }
    if (configs?.pbs) {
      pbsForm.setValues(blankNulls(configs.pbs, ['namespace', 'fingerprint', 'backupIdPrefix']));
    }
    if (configs?.kopia) {
      kopiaForm.setValues({ ...blankNulls(configs.kopia, ['fingerprint']), tags: configs.kopia.tags ?? {} });
    }
  }, [contextBackupConfiguration]);

  const fields = useBackupConfigurationFormFields();

  const activeAlert = backupDisk ? DISK_ALERTS[backupDisk] : undefined;

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
        <Alert color='yellow' icon={faExclamationTriangle} mb='md'>
          {t('pages.admin.backupConfigurations.tabs.general.page.modal.delete.alert.detachWarning', {})}
        </Alert>
        {t('common.modal.delete.content', {
          name: form.getValues().name ?? '',
        }).md()}
      </ConfirmationModal>

      <ConfirmationModal
        opened={removeProvider !== null}
        onClose={() => setRemoveProvider(null)}
        title={t('pages.admin.backupConfigurations.tabs.general.page.modal.removeProvider.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={() => {
          if (removeProvider) {
            resetProviderForm(removeProvider);
          }
          setRemoveProvider(null);
        }}
      >
        {t('pages.admin.backupConfigurations.tabs.general.page.modal.removeProvider.content', {
          provider: removeProvider ? backupDiskLabelMapping[removeProvider] : '',
        }).md()}
      </ConfirmationModal>

      {backupDisk && (
        <BackupConfigurationTestModal
          opened={openModal === 'test'}
          onClose={() => setOpenModal(null)}
          buildTest={() => ({ backupDisk, backupConfigs: buildBackupConfigs() })}
        />
      )}

      {contextBackupConfiguration && (
        <BackupConfigurationDuplicateModal
          backupConfiguration={contextBackupConfiguration}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      {activeAlert && (
        <Alert color='yellow' icon={faExclamationTriangle} mb='md'>
          {t(activeAlert.key, activeAlert.params ?? {}).md()}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.backupConfigurations.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan
            action={contextBackupConfiguration ? 'backup-configurations.update' : 'backup-configurations.create'}
            cantSave
          >
            <Button type='submit' disabled={submitDisabled} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextBackupConfiguration && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={submitDisabled} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
            <Button variant='default' onClick={() => setOpenModal('test')} disabled={submitDisabled}>
              {t('common.button.test', {})}
            </Button>
          </AdminCan>
          {contextBackupConfiguration && (
            <AdminCan action='backup-configurations.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextBackupConfiguration && (
            <AdminCan action='backup-configurations.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
          <a
            href='https://calagopus.com/docs/wings/advanced/backup-configurations'
            target='_blank'
            rel='noopener noreferrer'
          >
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              {t('common.button.viewDocumentation', {})}
            </Button>
          </a>
        </Group>

        {providerVisible(flags.s3) && (
          <BackupS3
            form={s3Form}
            onRemove={backupDisk !== PROVIDER_DISKS.s3 ? () => setRemoveProvider('s3') : undefined}
          />
        )}
        {providerVisible(flags.restic) && (
          <BackupRestic
            form={resticForm}
            onRemove={backupDisk !== PROVIDER_DISKS.restic ? () => setRemoveProvider('restic') : undefined}
          />
        )}
        {providerVisible(flags.pbs) && (
          <BackupPBS
            form={pbsForm}
            onRemove={backupDisk !== PROVIDER_DISKS.pbs ? () => setRemoveProvider('proxmox-backup-server') : undefined}
          />
        )}
        {providerVisible(flags.kopia) && (
          <BackupKopia
            form={kopiaForm}
            onRemove={backupDisk !== PROVIDER_DISKS.kopia ? () => setRemoveProvider('kopia') : undefined}
          />
        )}
      </form>
    </AdminContentContainer>
  );
}
