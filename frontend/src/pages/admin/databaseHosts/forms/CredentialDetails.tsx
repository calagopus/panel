import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminDatabaseCredentialsDetailsSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type CredentialsForm = UseFormReturnType<{ credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema> }>;

export default function CredentialDetails({ form }: { form: CredentialsForm }) {
  const { t } = useTranslations();
  useEffect(() => {
    form.setValues({
      credentials: {
        type: 'details',
        username: form.values.credentials.username ?? '',
        password: form.values.credentials.password ?? '',
        host: form.values.credentials.host ?? '',
        port: form.values.credentials.port ?? 3306,
      },
    });
  }, []);

  const fields: FieldDef<{ credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema> }>[] = [
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
      name: 'password',
      render: (f) => (
        <PasswordInput
          withAsterisk
          label={t('common.form.password', {})}
          key={f.key('credentials.password')}
          {...f.getInputProps('credentials.password')}
        />
      ),
    },
    {
      type: 'custom',
      name: 'host',
      render: (f) => (
        <TextInput
          withAsterisk
          label={t('common.form.host', {})}
          key={f.key('credentials.host')}
          {...f.getInputProps('credentials.host')}
        />
      ),
    },
    {
      type: 'custom',
      name: 'port',
      render: (f) => (
        <NumberInput
          withAsterisk
          label={t('common.form.port', {})}
          key={f.key('credentials.port')}
          {...f.getInputProps('credentials.port')}
        />
      ),
    },
  ];

  return <FormEngine id='admin.databaseHosts.credentialDetails' form={form} fields={fields} className='mt-4' />;
}
