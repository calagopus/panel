import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import Alert from '@/elements/Alert.tsx';
import Code from '@/elements/Code.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsStorageS3Schema } from '@/lib/schemas/admin/settings.ts';

export default function StorageS3({ form }: { form: UseFormReturnType<z.infer<typeof adminSettingsStorageS3Schema>> }) {
  useEffect(() => {
    form.setValues({
      accessKey: form.values.accessKey ?? '',
      secretKey: form.values.secretKey ?? '',
      bucket: form.values.bucket ?? '',
      region: form.values.region ?? '',
      endpoint: form.values.endpoint ?? '',
      pathStyle: form.values.pathStyle ?? false,
    });
  }, []);

  return (
    <Stack mt='md'>
      <Alert icon={<FontAwesomeIcon icon={faInfoCircle} />} title='Note on Permissions' color='blue'>
        To ensure that the storage backend works correctly, please make sure the following subdirectories are publicly
        accessible over the "Public URL" you provided:
        <ul className='mt-2'>
          <li>
            <Code>assets/</Code>: This is where all admin assets (e.g., icons) will be stored.
          </li>
          <li>
            <Code>avatars/</Code>: This is where all user avatars will be stored.
          </li>
          <li>
            <Code>publicdata/</Code>: This is where extensions can store public data (e.g., images).
          </li>
        </ul>
      </Alert>

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
          label='Public URL'
          placeholder='Public URL'
          key={form.key('publicUrl')}
          {...form.getInputProps('publicUrl')}
        />
        <TextInput
          withAsterisk
          label='Endpoint'
          placeholder='Endpoint'
          key={form.key('endpoint')}
          {...form.getInputProps('endpoint')}
        />
      </Group>

      <Switch
        label={form.values.pathStyle ? 'Using path-style URLs' : 'Using virtual-hosted-style URLs'}
        key={form.key('pathStyle')}
        {...form.getInputProps('pathStyle', { type: 'checkbox' })}
      />
    </Stack>
  );
}
