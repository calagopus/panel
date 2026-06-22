import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import Alert from '@/elements/Alert.tsx';
import Code from '@/elements/Code.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsStorageS3Schema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type S3Values = z.infer<typeof adminSettingsStorageS3Schema>;

export default function StorageS3({ form }: { form: UseFormReturnType<S3Values> }) {
  const { t } = useTranslations();
  const { formExtension } = useFormExtensions('admin.settings.storage.s3');

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

  const fields: FieldDef<S3Values>[] = [
    {
      type: 'text',
      name: 'accessKey',
      label: t('common.form.accessKey', {}),
      required: true,
    },
    {
      type: 'password',
      name: 'secretKey',
      label: t('common.form.secretKey', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'bucket',
      label: t('common.form.bucket', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'region',
      label: t('common.form.region', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'publicUrl',
      label: t('common.form.publicUrl', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'endpoint',
      label: t('common.form.endpoint', {}),
      required: true,
    },
    {
      type: 'custom',
      name: 'pathStyle',
      colSpan: 'full',
      render: (f) => (
        <Switch
          label={
            f.values.pathStyle
              ? t('pages.admin.settings.tabs.storage.page.s3.form.pathStyleOn', {})
              : t('pages.admin.settings.tabs.storage.page.s3.form.pathStyleOff', {})
          }
          key={f.key('pathStyle')}
          {...f.getInputProps('pathStyle', { type: 'checkbox' })}
        />
      ),
    },
  ];

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
      <FormEngine form={form} fields={fields} extensions={[formExtension]} />
    </Stack>
  );
}
