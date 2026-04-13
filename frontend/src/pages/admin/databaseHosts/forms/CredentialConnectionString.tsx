import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import { adminDatabaseCredentialsConnectionStringSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default function CredentialConnectionString({
  form,
}: {
  form: UseFormReturnType<{ credentials: z.infer<typeof adminDatabaseCredentialsConnectionStringSchema> }>;
}) {
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
        label='Connection String'
        placeholder='mysql://username:password@host:port'
        key={form.key('credentials.connectionString')}
        {...form.getInputProps('credentials.connectionString')}
      />
    </Stack>
  );
}
