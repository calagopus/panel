import { faSkull } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateAutokill from '@/api/server/settings/updateAutokill.ts';
import Button from '@/elements/Button.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { serverSettingsAutokillSchema } from '@/lib/schemas/server/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function AutokillContainer() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof serverSettingsAutokillSchema>>({
    initialValues: {
      enabled: server.autoKill.enabled,
      seconds: server.autoKill.seconds,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverSettingsAutokillSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    updateAutokill(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.server.settings.autokill.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.server.settings.autokill.title', {})}
      icon={<FontAwesomeIcon icon={faSkull} />}
      className='h-full order-20'
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <Switch
            label={t('pages.server.settings.autokill.form.enabled', {})}
            {...form.getInputProps('enabled', { type: 'checkbox' })}
          />
          <NumberInput
            label={t('pages.server.settings.autokill.form.secondsUntilAutoKill', {})}
            {...form.getInputProps('seconds')}
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
