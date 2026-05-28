import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import Alert from '@/elements/Alert.tsx';
import Code from '@/elements/Code.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsStorageS3Schema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function StorageS3({ form }: { form: UseFormReturnType<z.infer<typeof adminSettingsStorageS3Schema>> }) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      accessKey: form.values.accessKey ?? '',
      secretKey: form.values.secretKey ?? '',
      bucket: form.values.bucket ?? '',
      region: form.values.region ?? '',
      endpoint: form.values.endpoint ?? '',
      pathStyle: form.values.pathStyle ?? false,
    });
  }, []);

  return (
    <Stack mt='md'>
      <Alert
        icon={<FontAwesomeIcon icon={faInfoCircle} />}
        title={t('pages.admin.settings.tabs.storage.page.s3.alert.permissionsTitle', {})}
        color='blue'
      >
        {t('pages.admin.settings.tabs.storage.page.s3.alert.permissionsIntro', {})}
        <ul className='mt-2'>
          <li>
            <Code>assets/</Code>: {t('pages.admin.settings.tabs.storage.page.s3.alert.permissionsAssets', {})}
          </li>
          <li>
            <Code>avatars/</Code>: {t('pages.admin.settings.tabs.storage.page.s3.alert.permissionsAvatars', {})}
          </li>
          <li>
            <Code>publicdata/</Code>: {t('pages.admin.settings.tabs.storage.page.s3.alert.permissionsPublicData', {})}
          </li>
        </ul>
      </Alert>

      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.accessKey', {})}
          placeholder={t('common.form.accessKey', {})}
          key={form.key('accessKey')}
          {...form.getInputProps('accessKey')}
        />
        <PasswordInput
          withAsterisk
          label={t('common.form.secretKey', {})}
          placeholder={t('common.form.secretKey', {})}
          key={form.key('secretKey')}
          {...form.getInputProps('secretKey')}
        />
      </Group>

      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.bucket', {})}
          placeholder={t('common.form.bucket', {})}
          key={form.key('bucket')}
          {...form.getInputProps('bucket')}
        />
        <TextInput
          withAsterisk
          label={t('common.form.region', {})}
          placeholder={t('common.form.region', {})}
          key={form.key('region')}
          {...form.getInputProps('region')}
        />
      </Group>

      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.publicUrl', {})}
          placeholder={t('common.form.publicUrl', {})}
          key={form.key('publicUrl')}
          {...form.getInputProps('publicUrl')}
        />
        <TextInput
          withAsterisk
          label={t('common.form.endpoint', {})}
          placeholder={t('common.form.endpoint', {})}
          key={form.key('endpoint')}
          {...form.getInputProps('endpoint')}
        />
      </Group>

      <Switch
        label={
          form.values.pathStyle
            ? t('pages.admin.settings.tabs.storage.page.s3.form.pathStyleOn', {})
            : t('pages.admin.settings.tabs.storage.page.s3.form.pathStyleOff', {})
        }
        key={form.key('pathStyle')}
        {...form.getInputProps('pathStyle', { type: 'checkbox' })}
      />
    </Stack>
  );
}
