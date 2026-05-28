import { Group, Stack } from '@mantine/core';
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
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function ActivityContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
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
        addToast(t('pages.admin.settings.tabs.activity.page.toast.updated', {}), 'success');
        updateSettings({ activity: adminSettingsActivitySchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.activity.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <Group grow>
            <NumberInput
              withAsterisk
              label={t('pages.admin.settings.tabs.activity.page.form.adminLogRetentionDays', {})}
              placeholder={t('pages.admin.settings.tabs.activity.page.form.adminLogRetentionDays', {})}
              key={form.key('adminLogRetentionDays')}
              {...form.getInputProps('adminLogRetentionDays')}
            />

            <NumberInput
              withAsterisk
              label={t('pages.admin.settings.tabs.activity.page.form.userLogRetentionDays', {})}
              placeholder={t('pages.admin.settings.tabs.activity.page.form.userLogRetentionDays', {})}
              key={form.key('userLogRetentionDays')}
              {...form.getInputProps('userLogRetentionDays')}
            />

            <NumberInput
              withAsterisk
              label={t('pages.admin.settings.tabs.activity.page.form.serverLogRetentionDays', {})}
              placeholder={t('pages.admin.settings.tabs.activity.page.form.serverLogRetentionDays', {})}
              key={form.key('serverLogRetentionDays')}
              {...form.getInputProps('serverLogRetentionDays')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label={t('pages.admin.settings.tabs.activity.page.form.adminLogRetentionCount', {})}
              placeholder={t('pages.admin.settings.tabs.activity.page.form.adminLogRetentionCount', {})}
              key={form.key('adminLogRetentionCount')}
              {...form.getInputProps('adminLogRetentionCount')}
            />

            <NumberInput
              label={t('pages.admin.settings.tabs.activity.page.form.userLogRetentionCount', {})}
              placeholder={t('pages.admin.settings.tabs.activity.page.form.userLogRetentionCount', {})}
              key={form.key('userLogRetentionCount')}
              {...form.getInputProps('userLogRetentionCount')}
            />

            <NumberInput
              label={t('pages.admin.settings.tabs.activity.page.form.serverLogRetentionCount', {})}
              placeholder={t('pages.admin.settings.tabs.activity.page.form.serverLogRetentionCount', {})}
              key={form.key('serverLogRetentionCount')}
              {...form.getInputProps('serverLogRetentionCount')}
            />
          </Group>

          <Group grow>
            <Switch
              label={t('pages.admin.settings.tabs.activity.page.form.serverLogAdminActivity', {})}
              description={t('pages.admin.settings.tabs.activity.page.form.serverLogAdminActivityDescription', {})}
              key={form.key('serverLogAdminActivity')}
              {...form.getInputProps('serverLogAdminActivity', { type: 'checkbox' })}
            />

            <Switch
              label={t('pages.admin.settings.tabs.activity.page.form.serverLogScheduleActivity', {})}
              description={t('pages.admin.settings.tabs.activity.page.form.serverLogScheduleActivityDescription', {})}
              key={form.key('serverLogScheduleActivity')}
              {...form.getInputProps('serverLogScheduleActivity', { type: 'checkbox' })}
            />
          </Group>
        </Stack>

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
