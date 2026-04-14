import { Group, Stack, Title, Tooltip } from '@mantine/core';
import { UseFormReturnType, useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateRatelimitSettings from '@/api/admin/settings/updateRatelimitSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

function RatelimitConfigurationInput({
  label,
  hitsKey,
  windowSecondsKey,
  form,
}: {
  label: string;
  hitsKey: keyof z.infer<typeof adminSettingsRatelimitsSchema>;
  windowSecondsKey: keyof z.infer<typeof adminSettingsRatelimitsSchema>;
  form: UseFormReturnType<z.infer<typeof adminSettingsRatelimitsSchema>>;
}) {
  return (
    <div className='flex flex-col'>
      <Title order={4}>
        <Code>{label}</Code>
      </Title>

      <Group grow>
        <NumberInput
          withAsterisk
          label='Hits'
          key={form.key(`${hitsKey}.hits`)}
          {...form.getInputProps(`${hitsKey}.hits`)}
        />

        <NumberInput
          withAsterisk
          label='Window Seconds'
          key={form.key(`${windowSecondsKey}.windowSeconds`)}
          {...form.getInputProps(`${windowSecondsKey}.windowSeconds`)}
        />
      </Group>
    </div>
  );
}

export default function RatelimitsContainer() {
  const { addToast } = useToast();
  const { ratelimits } = useAdminStore();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsRatelimitsSchema>>({
    initialValues: {
      authRegister: {
        hits: 0,
        windowSeconds: 0,
      },
      authLogin: {
        hits: 0,
        windowSeconds: 0,
      },
      authLoginCheckpoint: {
        hits: 0,
        windowSeconds: 0,
      },
      authLoginSecurityKey: {
        hits: 0,
        windowSeconds: 0,
      },
      authPasswordForgot: {
        hits: 0,
        windowSeconds: 0,
      },
      client: {
        hits: 0,
        windowSeconds: 0,
      },
      clientServersBackupsCreate: {
        hits: 0,
        windowSeconds: 0,
      },
      clientServersFilesPull: {
        hits: 0,
        windowSeconds: 0,
      },
      clientServersFilesPullQuery: {
        hits: 0,
        windowSeconds: 0,
      },
    },
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
      .then(() => {
        addToast('Ratelimit settings updated.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title='Ratelimit Settings' titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <RatelimitConfigurationInput
            label='auth/register'
            hitsKey='authRegister'
            windowSecondsKey='authRegister'
            form={form}
          />

          <Divider />

          <RatelimitConfigurationInput
            label='auth/login'
            hitsKey='authLogin'
            windowSecondsKey='authLogin'
            form={form}
          />

          <Divider />

          <RatelimitConfigurationInput
            label='auth/login/checkpoint'
            hitsKey='authLoginCheckpoint'
            windowSecondsKey='authLoginCheckpoint'
            form={form}
          />

          <Divider />

          <RatelimitConfigurationInput
            label='auth/login/security-key'
            hitsKey='authLoginSecurityKey'
            windowSecondsKey='authLoginSecurityKey'
            form={form}
          />

          <Divider />

          <RatelimitConfigurationInput
            label='auth/password/forgot'
            hitsKey='authPasswordForgot'
            windowSecondsKey='authPasswordForgot'
            form={form}
          />

          <RatelimitConfigurationInput label='client' hitsKey='client' windowSecondsKey='client' form={form} />

          <Divider />

          <RatelimitConfigurationInput
            label='client/servers/backups/create'
            hitsKey='clientServersBackupsCreate'
            windowSecondsKey='clientServersBackupsCreate'
            form={form}
          />

          <Divider />

          <RatelimitConfigurationInput
            label='client/servers/files/pull'
            hitsKey='clientServersFilesPull'
            windowSecondsKey='clientServersFilesPull'
            form={form}
          />

          <Divider />

          <RatelimitConfigurationInput
            label='client/servers/files/pull/query'
            hitsKey='clientServersFilesPullQuery'
            windowSecondsKey='clientServersFilesPullQuery'
            form={form}
          />
        </Stack>

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
