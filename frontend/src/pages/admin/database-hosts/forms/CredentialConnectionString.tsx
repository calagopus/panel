import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { adminDatabaseCredentialsConnectionStringSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function CredentialConnectionString({
  form,
}: {
  form: UseFormReturnType<{ credentials: z.infer<typeof adminDatabaseCredentialsConnectionStringSchema> }>;
}) {
  const { t } = useTranslations();

  return (
    <Stack mt='md'>
      <PasswordInput
        withAsterisk
        label={t('pages.admin.databaseHosts.tabs.general.page.form.connectionString', {})}
        placeholder='mysql://username:password@host:port'
        key={form.key('credentials.connectionString')}
        {...form.getInputProps('credentials.connectionString')}
      />
    </Stack>
  );
}
