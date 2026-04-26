import { Divider, Group, Stack, Title } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminBackupConfigurationS3Schema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default function BackupS3({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminBackupConfigurationS3Schema>>;
}) {
  return (
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Title order={2}>S3 Settings</Title>
        <Divider />
      </Stack>

      <Stack>
        <Group grow>
          <TextInput
            withAsterisk
            label='Access Key'
            placeholder='Access Key'
            key={form.key('accessKey')}
            {...form.getInputProps('accessKey')}
          />
          <PasswordInput
            withAsterisk
            label='Secret Key'
            placeholder='Secret Key'
            key={form.key('secretKey')}
            {...form.getInputProps('secretKey')}
          />
        </Group>

        <Group grow>
          <TextInput
            withAsterisk
            label='Bucket'
            placeholder='Bucket'
            key={form.key('bucket')}
            {...form.getInputProps('bucket')}
          />
          <TextInput
            withAsterisk
            label='Region'
            placeholder='Region'
            key={form.key('region')}
            {...form.getInputProps('region')}
          />
        </Group>

        <Group grow>
          <TextInput
            withAsterisk
            label='Endpoint'
            placeholder='Endpoint'
            key={form.key('endpoint')}
            {...form.getInputProps('endpoint')}
          />
          <SizeInput
            withAsterisk
            label='Part Size'
            mode='b'
            min={0}
            value={form.values.partSize}
            onChange={(v) => form.setFieldValue('partSize', v)}
          />
        </Group>

        <Switch label='Using path-style URLs' {...form.getInputProps('pathStyle', { type: 'checkbox' })} />
      </Stack>
    </Stack>
  );
}
