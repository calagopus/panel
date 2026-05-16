import { Group, Stack, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateActivitySettings from '@/api/admin/settings/updateActivitySettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { adminSettingsActivitySchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function ActivityContainer() {
  const { addToast } = useToast();
  const { activity, updateSettings } = useAdminStore();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsActivitySchema>>({
    initialValues: {
      adminLogRetentionDays: 1,
      adminLogRetentionCount: null,
      userLogRetentionDays: 1,
      userLogRetentionCount: null,
      serverLogRetentionDays: 1,
      serverLogRetentionCount: null,
      serverLogAdminActivity: false,
      serverLogScheduleActivity: false,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsActivitySchema),
  });

  useEffect(() => {
    form.setValues({
      ...activity,
    });
  }, [activity]);

  const doUpdate = () => {
    setLoading(true);

    updateActivitySettings(adminSettingsActivitySchema.parse(form.getValues()))
      .then(() => {
        addToast('Activity settings updated.', 'success');
        updateSettings({ activity: adminSettingsActivitySchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title='Activity Settings' titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <Group grow>
            <NumberInput
              withAsterisk
              label='Admin Activity Retention Days'
              placeholder='Admin Activity Retention Days'
              key={form.key('adminLogRetentionDays')}
              {...form.getInputProps('adminLogRetentionDays')}
            />

            <NumberInput
              withAsterisk
              label='User Activity Retention Days'
              placeholder='User Activity Retention Days'
              key={form.key('userLogRetentionDays')}
              {...form.getInputProps('userLogRetentionDays')}
            />

            <NumberInput
              withAsterisk
              label='Server Activity Retention Days'
              placeholder='Server Activity Retention Days'
              key={form.key('serverLogRetentionDays')}
              {...form.getInputProps('serverLogRetentionDays')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label='Admin Activity Retention Count'
              placeholder='Admin Activity Retention Count'
              key={form.key('adminLogRetentionCount')}
              {...form.getInputProps('adminLogRetentionCount')}
            />

            <NumberInput
              label='User Activity Retention Count'
              placeholder='User Activity Retention Count'
              key={form.key('userLogRetentionCount')}
              {...form.getInputProps('userLogRetentionCount')}
            />

            <NumberInput
              label='Server Activity Retention Count'
              placeholder='Server Activity Retention Count'
              key={form.key('serverLogRetentionCount')}
              {...form.getInputProps('serverLogRetentionCount')}
            />
          </Group>

          <Group grow>
            <Switch
              label='Log Server Admin Activity'
              description="Enable or disable logging of admin activity on servers where the admin isn't an owner or subuser."
              key={form.key('serverLogAdminActivity')}
              {...form.getInputProps('serverLogAdminActivity', { type: 'checkbox' })}
            />

            <Switch
              label='Log Server Schedule Activity'
              description='Enable or disable logging of activity done by server schedules.'
              key={form.key('serverLogScheduleActivity')}
              {...form.getInputProps('serverLogScheduleActivity', { type: 'checkbox' })}
            />
          </Group>
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
