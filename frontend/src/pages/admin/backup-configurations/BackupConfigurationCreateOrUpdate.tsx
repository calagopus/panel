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
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<BackupConfigFormValues>('admin.backupConfigurations.createOrUpdate', {
    schema: adminBackupConfigurationUpdateSchema.unwrap(),
    initialValues: backupConfigurationEmptyFormValues,
    validateInputOnBlur: true,
  });

  const s3Form = useFormEngine<z.infer<typeof adminBackupConfigurationS3Schema>>('admin.backupConfigurations.s3', {
    schema: adminBackupConfigurationS3Schema,
    initialValues: backupConfigurationS3EmptyFormValues,
    validateInputOnBlur: true,
  });

  const resticForm = useFormEngine<z.infer<typeof adminBackupConfigurationResticSchema>>(
    'admin.backupConfigurations.restic',
    {
      schema: adminBackupConfigurationResticSchema,
      initialValues: backupConfigurationResticEmptyFormValues,
      validateInputOnBlur: true,
    },
  );

  const pbsForm = useFormEngine<z.infer<typeof adminBackupConfigurationPbsSchema>>('admin.backupConfigurations.pbs', {
    schema: adminBackupConfigurationPbsSchema,
    initialValues: backupConfigurationPbsEmptyFormValues,
    validateInputOnBlur: true,
  });

  const kopiaForm = useFormEngine<z.infer<typeof adminBackupConfigurationKopiaSchema>>(
    'admin.backupConfigurations.kopia',
    {
      schema: adminBackupConfigurationKopiaSchema,
      initialValues: backupConfigurationKopiaEmptyFormValues,
      validateInputOnBlur: true,
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

  const buildBackupConfigs = () => ({
    s3: s3Form.isDirty() ? adminBackupConfigurationS3Schema.parse(s3Form.getValues()) : null,
    restic: resticForm.isDirty() ? adminBackupConfigurationResticSchema.parse(resticForm.getValues()) : null,
    pbs: pbsForm.isDirty() ? adminBackupConfigurationPbsSchema.parse(pbsForm.getValues()) : null,
    kopia: kopiaForm.isDirty() ? adminBackupConfigurationKopiaSchema.parse(kopiaForm.getValues()) : null,
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
        ...adminBackupConfigurationUpdateSchema.parse(form.getValues()),
        backupConfigs: buildBackupConfigs(),
      }),
    updateFn: contextBackupConfiguration
      ? () =>
          updateBackupConfiguration(contextBackupConfiguration.uuid, {
            ...adminBackupConfigurationUpdateSchema.parse(form.getValues()),
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
        {t('common.modal.delete.content', {
          name: form.getValues().name ?? '',
        }).md()}
      </ConfirmationModal>

      {contextBackupConfiguration && (
        <BackupConfigurationDuplicateModal
          backupConfiguration={contextBackupConfiguration}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      {activeAlert && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
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

        {providerVisible(flags.s3) && <BackupS3 form={s3Form} />}
        {providerVisible(flags.restic) && <BackupRestic form={resticForm} />}
        {providerVisible(flags.pbs) && <BackupPBS form={pbsForm} />}
        {providerVisible(flags.kopia) && <BackupKopia form={kopiaForm} />}
      </form>
    </AdminContentContainer>
  );
}
