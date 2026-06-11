import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import { adminDatabaseCredentialsConnectionStringSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function CredentialConnectionString({
  form,
}: {
  form: UseFormReturnType<{ credentials: z.infer<typeof adminDatabaseCredentialsConnectionStringSchema> }>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      credentials: {
        type: 'connection_string',
        connectionString: form.values.credentials.connectionString ?? '',
      },
    });
  }, []);

  return (
    <Stack mt='md'>
      <PasswordInput
        withAsterisk
        label={t('pages.admin.databaseHosts.tabs.general.page.form.connectionString', {})}
        placeholder={t('pages.admin.databaseHosts.tabs.general.page.form.connectionStringPlaceholder', {})}
        key={form.key('credentials.connectionString')}
        {...form.getInputProps('credentials.connectionString')}
      />
    </Stack>
  );
}
