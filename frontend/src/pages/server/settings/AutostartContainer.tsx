import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateAutostart from '@/api/server/settings/updateAutostart.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { serverSettingsAutostartSchema } from '@/lib/schemas/server/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function AutostartContainer() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const updateServer = useServerStore((state) => state.updateServer);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof serverSettingsAutostartSchema>>({
    initialValues: {
      behavior: server.autoStartBehavior,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverSettingsAutostartSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    updateAutostart(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.server.settings.autostart.toast.updated', {}), 'success');
        updateServer({ autoStartBehavior: form.values.behavior });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.server.settings.autostart.title', {})}
      icon={<FontAwesomeIcon icon={faPlay} />}
      className='h-full order-30'
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <Select
            withAsterisk
            label={t('pages.server.settings.autostart.form.behavior', {})}
            data={[
              {
                label: t('common.enum.serverAutoStartBehavior.always', {}),
                value: 'always',
              },
              {
                label: t('common.enum.serverAutoStartBehavior.unlessStopped', {}),
                value: 'unless_stopped',
              },
              {
                label: t('common.enum.serverAutoStartBehavior.never', {}),
                value: 'never',
              },
            ]}
            {...form.getInputProps('behavior')}
          />

          <Group mt='auto'>
            <Button type='submit' loading={loading} disabled={!form.isValid()}>
              {t('common.button.save', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </TitleCard>
  );
}
