import { faClock } from '@fortawesome/free-solid-svg-icons';
import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getTimezone from '@/api/server/settings/getTimezone.ts';
import updateTimezone from '@/api/server/settings/updateTimezone.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import TimezoneInput from '@/elements/input/TimezoneInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { formatDateTimeAsTimezone } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSettingsTimezoneSchema } from '@/lib/schemas/server/settings.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function TimezoneContainer() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const updateServer = useServerStore((state) => state.updateServer);

  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const { data: timezoneSettings } = useQuery({
    queryKey: queryKeys.server(server.uuid).settings.timezone(),
    queryFn: () => getTimezone(server.uuid),
  });

  const form = useForm<z.infer<typeof serverSettingsTimezoneSchema>>({
    initialValues: {
      timezone: server.timezone ?? null,
    },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsTimezoneSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    updateTimezone(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.server.settings.timezone.toast.updated', {}), 'success');
        updateServer({ timezone: form.values.timezone });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (form.values.timezone) {
      setTime(formatDateTimeAsTimezone(new Date(), form.values.timezone, true));

      const interval = setInterval(() => {
        setTime(formatDateTimeAsTimezone(new Date(), form.values.timezone!, true));
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTime(null);
    }
  }, [form.values.timezone]);

  return (
    <TitleCard title={t('pages.server.settings.timezone.title', {})} icon={faClock} className='h-full order-40'>
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <Stack gap='xs'>
            <TimezoneInput
              withAsterisk
              placeholder={timezoneSettings?.defaultTimezone ?? t('common.form.timezoneSystem', {})}
              allowDeselect
              clearable
              {...form.getInputProps('timezone')}
            />
            {time && <p>{time}</p>}
          </Stack>

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
