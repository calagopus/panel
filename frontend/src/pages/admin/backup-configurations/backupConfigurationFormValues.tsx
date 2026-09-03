import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { backupDiskLabelMapping } from '@/lib/enums.ts';
import {
  adminBackupConfigurationKopiaSchema,
  adminBackupConfigurationPbsSchema,
  adminBackupConfigurationResticSchema,
  adminBackupConfigurationS3Schema,
  adminBackupConfigurationSchema,
  adminBackupConfigurationUpdateSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type BackupConfigFormValues = Partial<z.infer<typeof adminBackupConfigurationUpdateSchema>>;

export const backupConfigurationEmptyFormValues: BackupConfigFormValues = {
  name: '',
  description: null,
  maintenanceEnabled: false,
  shared: false,
  backupDisk: 'local',
};

export const backupConfigurationS3EmptyFormValues: z.infer<typeof adminBackupConfigurationS3Schema> = {
  accessKey: '',
  secretKey: '',
  bucket: '',
  region: '',
  endpoint: '',
  compressionType: 'zstd',
  partSize: 1024 * 1024 * 1024,
  pathStyle: true,
};

export const backupConfigurationResticEmptyFormValues: z.infer<typeof adminBackupConfigurationResticSchema> = {
  repository: '',
  retryLockSeconds: 0,
  environment: {},
  pruneJobs: [],
};

export const backupConfigurationPbsEmptyFormValues: z.infer<typeof adminBackupConfigurationPbsSchema> = {
  url: '',
  datastore: '',
  namespace: '',
  tokenId: '',
  tokenSecret: '',
  fingerprint: '',
  backupIdPrefix: '',
};

export const backupConfigurationKopiaEmptyFormValues: z.infer<typeof adminBackupConfigurationKopiaSchema> = {
  url: '',
  username: '',
  password: '',
  fingerprint: '',
  tags: {},
};

export const backupConfigurationToFormValues = (
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>,
): BackupConfigFormValues => ({
  name: backupConfiguration.name,
  description: backupConfiguration.description,
  maintenanceEnabled: backupConfiguration.maintenanceEnabled,
  shared: backupConfiguration.shared,
  backupDisk: backupConfiguration.backupDisk,
});

export function useBackupConfigurationFormFields(): FieldDef<BackupConfigFormValues>[] {
  const { t } = useTranslations();

  return [
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
}
