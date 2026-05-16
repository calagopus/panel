import { Group, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateUserSettings from '@/api/admin/settings/updateUserSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { adminSettingsUserSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function UserContainer() {
  const { addToast } = useToast();
  const { user, updateSettings: updateAdminSettings } = useAdminStore();
  const { updateSettings } = useGlobalStore();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsUserSchema>>({
    initialValues: {
      maxServerGroupCount: 0,
      maxApiKeyCount: 0,
      maxCommandSnippetCount: 0,
      maxSecurityKeyCount: 0,
      maxSshKeyCount: 0,
      allowChangingLanguage: true,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsUserSchema),
  });

  useEffect(() => {
    form.setValues({
      ...user,
    });
  }, [user]);

  const doUpdate = () => {
    setLoading(true);

    updateUserSettings(adminSettingsUserSchema.parse(form.getValues()))
      .then(() => {
        addToast('User settings updated.', 'success');
        updateSettings({ user: { ...form.getValues() } });
        updateAdminSettings({ user: adminSettingsUserSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title='User Settings' titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <NumberInput
            withAsterisk
            label='Max Server Groups'
            placeholder='Max Server Groups'
            key={form.key('maxServerGroupCount')}
            {...form.getInputProps('maxServerGroupCount')}
          />
          <NumberInput
            withAsterisk
            label='Max API Keys'
            placeholder='Max API Keys'
            key={form.key('maxApiKeyCount')}
            {...form.getInputProps('maxApiKeyCount')}
          />
          <NumberInput
            withAsterisk
            label='Max Command Snippets'
            placeholder='Max Command Snippets'
            key={form.key('maxCommandSnippetCount')}
            {...form.getInputProps('maxCommandSnippetCount')}
          />
          <NumberInput
            withAsterisk
            label='Max Security Keys'
            placeholder='Max Security Keys'
            key={form.key('maxSecurityKeyCount')}
            {...form.getInputProps('maxSecurityKeyCount')}
          />
          <NumberInput
            withAsterisk
            label='Max SSH Keys'
            placeholder='Max SSH Keys'
            key={form.key('maxSshKeyCount')}
            {...form.getInputProps('maxSshKeyCount')}
          />

          <Switch
            label='Allow Changing Language'
            description='If enabled, users will be able to change their language preferences.'
            key={form.key('allowChangingLanguage')}
            {...form.getInputProps('allowChangingLanguage', { type: 'checkbox' })}
          />
        </div>

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
