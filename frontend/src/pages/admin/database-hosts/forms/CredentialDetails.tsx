import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { adminDatabaseCredentialsDetailsSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type CredentialsValues = { credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema> };
type CredentialsForm = UseFormReturnType<CredentialsValues>;

export default function CredentialDetails({ form }: { form: CredentialsForm }) {
  const { t } = useTranslations();

  const fields: FieldDef<CredentialsValues>[] = [
    {
      type: 'text',
      name: 'credentials.username',
      label: t('common.form.username', {}),
      required: true,
      props: ignorePasswordManagerProps,
    },
    { type: 'password', name: 'credentials.password', label: t('common.form.password', {}), required: true },
    { type: 'text', name: 'credentials.host', label: t('common.form.host', {}), required: true },
    { type: 'number', name: 'credentials.port', label: t('common.form.port', {}), required: true },
  ];

  return <FormEngine id='admin.databaseHosts.credentialDetails' form={form} fields={fields} className='mt-4' />;
}
