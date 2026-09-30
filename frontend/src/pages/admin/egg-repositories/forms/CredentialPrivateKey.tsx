import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { adminEggRepositoryCredentialsPrivateKeySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type CredentialsValues = { credentials: z.infer<typeof adminEggRepositoryCredentialsPrivateKeySchema> };
type CredentialsForm = UseFormReturnType<CredentialsValues>;

export default function CredentialPrivateKey({ form }: { form: CredentialsForm }) {
  const { t } = useTranslations();

  const fields: FieldDef<CredentialsValues>[] = [
    {
      type: 'text',
      name: 'credentials.username',
      label: t('common.form.username', {}),
      required: true,
      props: ignorePasswordManagerProps,
    },
    {
      type: 'password',
      name: 'credentials.passphrase',
      label: t('pages.admin.eggRepositories.tabs.general.page.form.passphrase', {}),
    },
    {
      type: 'textarea',
      name: 'credentials.privateKey',
      label: t('pages.admin.eggRepositories.tabs.general.page.form.privateKey', {}),
      required: true,
      rows: 8,
      colSpan: 'full',
      props: { placeholder: '-----BEGIN OPENSSH PRIVATE KEY-----' },
    },
  ];

  return <FormEngine id='admin.eggRepositories.credentialPrivateKey' form={form} fields={fields} className='mt-4' />;
}
