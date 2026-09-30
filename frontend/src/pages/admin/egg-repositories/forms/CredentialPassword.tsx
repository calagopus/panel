import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { adminEggRepositoryCredentialsPasswordSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type CredentialsValues = { credentials: z.infer<typeof adminEggRepositoryCredentialsPasswordSchema> };
type CredentialsForm = UseFormReturnType<CredentialsValues>;

export default function CredentialPassword({ form }: { form: CredentialsForm }) {
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
      name: 'credentials.password',
      label: t('pages.admin.eggRepositories.tabs.general.page.form.password', {}),
      required: true,
    },
  ];

  return <FormEngine id='admin.eggRepositories.credentialPassword' form={form} fields={fields} className='mt-4' />;
}
