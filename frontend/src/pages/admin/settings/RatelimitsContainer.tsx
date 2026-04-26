import { Group, Paper, SimpleGrid, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateRatelimitSettings from '@/api/admin/settings/updateRatelimitSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

type RatelimitsSchema = z.infer<typeof adminSettingsRatelimitsSchema>;
type RatelimitsSchemaKey = keyof RatelimitsSchema;

interface Endpoint {
  label: string;
  key: RatelimitsSchemaKey;
}

const ENDPOINTS: Endpoint[] = [
  { label: 'auth/register', key: 'authRegister' },
  { label: 'auth/login', key: 'authLogin' },
  { label: 'auth/login/checkpoint', key: 'authLoginCheckpoint' },
  { label: 'auth/login/security-key', key: 'authLoginSecurityKey' },
  { label: 'auth/password/forgot', key: 'authPasswordForgot' },
  { label: 'client', key: 'client' },
  { label: 'client/servers/backups/create', key: 'clientServersBackupsCreate' },
  { label: 'client/servers/files/pull', key: 'clientServersFilesPull' },
  { label: 'client/servers/files/pull/query', key: 'clientServersFilesPullQuery' },
];

const DEFAULT_VALUES: RatelimitsSchema = Object.fromEntries(
  ENDPOINTS.map(({ key }) => [key, { hits: 0, windowSeconds: 0 }]),
) as RatelimitsSchema;

export default function RatelimitsContainer() {
  const { addToast } = useToast();
  const { ratelimits } = useAdminStore();
  const [loading, setLoading] = useState(false);

  const form = useForm<RatelimitsSchema>({
    initialValues: DEFAULT_VALUES,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsRatelimitsSchema),
  });

  useEffect(() => {
    form.setValues({
      ...ratelimits,
    });
  }, [ratelimits]);

  const doUpdate = () => {
    setLoading(true);
    updateRatelimitSettings(adminSettingsRatelimitsSchema.parse(form.getValues()))
      .then(() => addToast('Rate limit settings updated.', 'success'))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title='Ratelimit Settings' titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing='sm'>
          {ENDPOINTS.map(({ label, key }) => (
            <Paper key={key} withBorder radius='md' p='md'>
              <Stack gap='xs'>
                <Code w='fit-content' title={label}>
                  {label}
                </Code>
                <Group grow>
                  <NumberInput
                    withAsterisk
                    label='Hits'
                    description='Max requests'
                    key={form.key(`${key}.hits`)}
                    {...form.getInputProps(`${key}.hits`)}
                  />
                  <NumberInput
                    withAsterisk
                    label='Window'
                    description='Seconds'
                    key={form.key(`${key}.windowSeconds`)}
                    {...form.getInputProps(`${key}.windowSeconds`)}
                  />
                </Group>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>

        <Group mt='md'>
          <AdminCan
            action='settings.update'
            renderOnCant={
              <Tooltip label='You do not have permission to update settings.'>
                <Button disabled>Save</Button>
              </Tooltip>
            }
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
