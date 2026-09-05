import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import Alert from '@/elements/feedback/Alert.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminSettingsStorageSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import type { DiscriminatedVariant } from '../DiscriminatedSettingsForm.tsx';

type StorageFormValues = z.infer<typeof adminSettingsStorageSchema>;
type StorageDriver = StorageFormValues['type'];

export const storageEmptyFormValues: StorageFormValues = { type: 'filesystem', path: '' };

export const storageToFormValues = (driver: StorageFormValues): Partial<StorageFormValues> => ({ ...driver });

export function useStorageDriverVariants(): Partial<Record<StorageDriver, DiscriminatedVariant<StorageFormValues>>> {
  const { t } = useTranslations();

  return {
    filesystem: {
      formId: 'admin.settings.storage.filesystem',
      defaults: { path: '' },
      fields: [{ type: 'text', name: 'path', label: t('common.form.path', {}), required: true, colSpan: 'full' }],
    },
    s3: {
      formId: 'admin.settings.storage.s3',
      defaults: { accessKey: '', secretKey: '', bucket: '', region: '', publicUrl: '', endpoint: '', pathStyle: false },
      before: (
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
      ),
      fields: [
        { type: 'text', name: 'accessKey', label: t('common.form.accessKey', {}), required: true },
        { type: 'password', name: 'secretKey', label: t('common.form.secretKey', {}), required: true },
        { type: 'text', name: 'bucket', label: t('common.form.bucket', {}), required: true },
        { type: 'text', name: 'region', label: t('common.form.region', {}), required: true },
        { type: 'text', name: 'publicUrl', label: t('common.form.publicUrl', {}), required: true },
        { type: 'text', name: 'endpoint', label: t('common.form.endpoint', {}), required: true },
        {
          type: 'switch',
          name: 'pathStyle',
          label: t('pages.admin.settings.tabs.storage.page.s3.form.pathStyle', {}),
          colSpan: 'full',
        },
      ],
    },
  };
}
