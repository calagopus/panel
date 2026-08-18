import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminEggRepositoryCredentialsPrivateKeySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type CredentialsForm = UseFormReturnType<{
  credentials: z.infer<typeof adminEggRepositoryCredentialsPrivateKeySchema>;
}>;

export default function CredentialPrivateKey({ form }: { form: CredentialsForm }) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      credentials: {
        type: 'private_key',
        username: form.values.credentials.username ?? 'git',
        privateKey: form.values.credentials.privateKey ?? '',
        passphrase: form.values.credentials.passphrase ?? null,
      },
    });
  }, []);

  const fields: FieldDef<{ credentials: z.infer<typeof adminEggRepositoryCredentialsPrivateKeySchema> }>[] = [
    {
      type: 'custom',
      name: 'username',
      render: (f) => (
        <TextInput
          withAsterisk
          label={t('common.form.username', {})}
          key={f.key('credentials.username')}
          {...f.getInputProps('credentials.username')}
        />
      ),
    },
    {
      type: 'custom',
      name: 'passphrase',
      render: (f) => (
        <PasswordInput
          label={t('pages.admin.eggRepositories.tabs.general.page.form.passphrase', {})}
          key={f.key('credentials.passphrase')}
          {...f.getInputProps('credentials.passphrase')}
        />
      ),
    },
    {
      type: 'custom',
      name: 'privateKey',
      colSpan: 'full',
      render: (f) => (
        <TextArea
          withAsterisk
          rows={8}
          label={t('pages.admin.eggRepositories.tabs.general.page.form.privateKey', {})}
          placeholder='-----BEGIN OPENSSH PRIVATE KEY-----'
          key={f.key('credentials.privateKey')}
          {...f.getInputProps('credentials.privateKey')}
        />
      ),
    },
  ];

  return <FormEngine id='admin.eggRepositories.credentialPrivateKey' form={form} fields={fields} className='mt-4' />;
}
