import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminDatabaseCredentialsDetailsSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default function CredentialDetails({
  form,
}: {
  form: UseFormReturnType<{ credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema> }>;
}) {
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

  return (
    <Stack mt='md'>
      <Group grow>
        <TextInput
          withAsterisk
          label='Username'
          placeholder='Username'
          key={form.key('credentials.username')}
          {...form.getInputProps('credentials.username')}
        />
        <PasswordInput
          withAsterisk
          label='Password'
          placeholder='Password'
          key={form.key('credentials.password')}
          {...form.getInputProps('credentials.password')}
        />
      </Group>

      <Group grow>
        <TextInput
          withAsterisk
          label='Host'
          placeholder='Host'
          key={form.key('credentials.host')}
          {...form.getInputProps('credentials.host')}
        />
        <TextInput
          withAsterisk
          label='Port'
          placeholder='Port'
          key={form.key('credentials.port')}
          {...form.getInputProps('credentials.port')}
        />
      </Group>
    </Stack>
  );
}
