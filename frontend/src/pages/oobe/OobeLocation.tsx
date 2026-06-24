import { faAddressCard, faChevronLeft, faFloppyDisk, faRainbow } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { basename } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import createBackupConfiguration from '@/api/admin/backup-configurations/createBackupConfiguration.ts';
import updateBackupConfiguration from '@/api/admin/backup-configurations/updateBackupConfiguration.ts';
import createLocation from '@/api/admin/locations/createLocation.ts';
import updateLocation from '@/api/admin/locations/updateLocation.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { backupDiskLabelMapping } from '@/lib/enums.ts';
import {
  adminBackupConfigurationKopiaSchema,
  adminBackupConfigurationPbsSchema,
  adminBackupConfigurationResticSchema,
  adminBackupConfigurationS3Schema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import { oobeLocationSchema } from '@/lib/schemas/oobe.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';
import BackupKopia from '../admin/backupConfigurations/forms/BackupKopia.tsx';
import BackupPBS from '../admin/backupConfigurations/forms/BackupPBS.tsx';
import BackupRestic from '../admin/backupConfigurations/forms/BackupRestic.tsx';
import BackupS3 from '../admin/backupConfigurations/forms/BackupS3.tsx';

const flags = import.meta.glob('/node_modules/svg-country-flags/svg/*.svg', { import: 'metadata' });

export default function OobeLocation({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { t, language } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const existingLocation = data.locations[0];
  const existingBackupConfig = existingLocation?.backupConfiguration;
  const isEdit = !!existingLocation;

  const form = useForm<z.infer<typeof oobeLocationSchema>>({
    initialValues: {
      locationName: existingLocation?.name ?? '',
      locationFlag: existingLocation?.flag ?? null,
      backupName: existingBackupConfig?.name ?? '',
      backupDisk: existingBackupConfig?.backupDisk ?? 'local',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(oobeLocationSchema),
  });

  const backupConfigS3Form = useForm<z.infer<typeof adminBackupConfigurationS3Schema>>({
    initialValues: existingBackupConfig?.backupConfigs?.s3 ?? {
      accessKey: '',
      secretKey: '',
      bucket: '',
      region: '',
      endpoint: '',
      pathStyle: true,
      compressionType: 'zstd',
      partSize: 0,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationS3Schema),
  });

  const backupConfigResticForm = useForm<z.infer<typeof adminBackupConfigurationResticSchema>>({
    initialValues: existingBackupConfig?.backupConfigs?.restic ?? {
      repository: '',
      retryLockSeconds: 0,
      environment: {},
      pruneJobs: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationResticSchema),
  });

  const backupConfigPbsForm = useForm<z.infer<typeof adminBackupConfigurationPbsSchema>>({
    initialValues: existingBackupConfig?.backupConfigs?.pbs
      ? {
          ...existingBackupConfig.backupConfigs.pbs,
          namespace: existingBackupConfig.backupConfigs.pbs.namespace ?? '',
          backupIdPrefix: existingBackupConfig.backupConfigs.pbs.backupIdPrefix ?? '',
        }
      : {
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
    initialValues: existingBackupConfig?.backupConfigs?.kopia
      ? {
          ...existingBackupConfig.backupConfigs.kopia,
          tags: existingBackupConfig.backupConfigs.kopia.tags ?? {},
        }
      : {
          url: '',
          username: '',
          password: '',
          fingerprint: '',
          tags: {},
        },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationKopiaSchema),
  });

  const onSubmit = async () => {
    setLoading(true);

    try {
      const backupConfigs = {
        s3: form.values.backupDisk === 's3' ? backupConfigS3Form.values : null,
        restic: form.values.backupDisk === 'restic' ? backupConfigResticForm.values : null,
        pbs:
          form.values.backupDisk === 'proxmox-backup-server'
            ? adminBackupConfigurationPbsSchema.parse(backupConfigPbsForm.values)
            : null,
        kopia:
          form.values.backupDisk === 'kopia'
            ? adminBackupConfigurationKopiaSchema.parse(backupConfigKopiaForm.values)
            : null,
      };

      if (isEdit) {
        await updateBackupConfiguration(existingBackupConfig!.uuid, {
          name: form.values.backupName,
          description: existingBackupConfig!.description,
          maintenanceEnabled: existingBackupConfig!.maintenanceEnabled,
          shared: existingBackupConfig!.shared,
          backupDisk: form.values.backupDisk,
          backupConfigs,
        });
        await updateLocation(existingLocation.uuid, {
          name: form.values.locationName,
          description: existingLocation.description,
          flag: form.values.locationFlag,
          backupConfigurationUuid: existingBackupConfig!.uuid,
        });
      } else {
        const backupConfig = await createBackupConfiguration({
          name: form.values.backupName,
          description: null,
          maintenanceEnabled: false,
          shared:
            form.values.backupDisk === 's3' ||
            form.values.backupDisk === 'restic' ||
            form.values.backupDisk === 'proxmox-backup-server' ||
            form.values.backupDisk === 'kopia',
          backupDisk: form.values.backupDisk,
          backupConfigs,
        });
        await createLocation({
          name: form.values.locationName,
          description: null,
          flag: form.values.locationFlag,
          backupConfigurationUuid: backupConfig.uuid,
        });
      }

      data.refetch();
      onNext();
    } catch (msg) {
      setError(httpErrorToHuman(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.location.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <form onSubmit={form.onSubmit(() => onSubmit())}>
        <Stack gap='xl'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col md:flex-row gap-4'>
              <TextInput
                label={t('pages.oobe.location.form.locationName', {})}
                placeholder={t('pages.oobe.location.form.locationNamePlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faAddressCard} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('locationName')}
              />
              <Select
                label={t('pages.oobe.location.form.locationFlag', {})}
                placeholder={t('pages.oobe.location.form.locationFlagPlaceholder', {})}
                renderOption={({ option }) => (
                  <div className='flex items-center gap-2'>
                    <img
                      src={`/flags/${option.value}.svg`}
                      alt={option.label}
                      className='w-4 h-4 rounded-md shrink-0'
                    />
                    <span className='truncate'>{option.label}</span>
                  </div>
                )}
                data={Object.keys(flags)
                  .filter((flag) => basename(flag, '.svg').length === 2)
                  .map((flag) => {
                    const countryCode = basename(flag, '.svg');
                    const regionNames = new Intl.DisplayNames([language], { type: 'region' });

                    return {
                      label: regionNames.of(countryCode.toUpperCase()) || countryCode,
                      value: countryCode,
                    };
                  })}
                clearable
                searchable
                {...form.getInputProps('locationFlag')}
              />
            </div>
            <div className='flex flex-col md:flex-row gap-4'>
              <TextInput
                label={t('pages.oobe.location.form.backupName', {})}
                placeholder={t('pages.oobe.location.form.backupNamePlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faRainbow} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('backupName')}
              />
              <Select
                withAsterisk
                label={t('pages.oobe.location.form.backupDisk', {})}
                placeholder={t('pages.oobe.location.form.backupDiskPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faFloppyDisk} size='sm' />}
                data={Object.entries(backupDiskLabelMapping).map(([value, label]) => ({
                  value,
                  label,
                }))}
                {...form.getInputProps('backupDisk')}
              />
            </div>
            {form.values.backupDisk === 's3' ? <BackupS3 form={backupConfigS3Form} /> : null}
            {form.values.backupDisk === 'restic' ? <BackupRestic form={backupConfigResticForm} /> : null}
            {form.values.backupDisk === 'proxmox-backup-server' ? <BackupPBS form={backupConfigPbsForm} /> : null}
            {form.values.backupDisk === 'kopia' ? <BackupKopia form={backupConfigKopiaForm} /> : null}
          </div>

          <Group justify='flex-end'>
            {canGoBack && (
              <Button variant='subtle' onClick={onBack} leftSection={<FontAwesomeIcon icon={faChevronLeft} />}>
                Back
              </Button>
            )}
            {!isEdit && (
              <Button variant='outline' onClick={() => skipFrom('location')}>
                {t('common.button.skip', {})}
              </Button>
            )}
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {isEdit ? t('common.button.save', {}) : t('pages.oobe.location.button.create', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
