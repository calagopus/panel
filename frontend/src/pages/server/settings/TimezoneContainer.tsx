import { faClock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { zones } from 'tzdata';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateTimezone from '@/api/server/settings/updateTimezone.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { serverSettingsTimezoneSchema } from '@/lib/schemas/server/settings.ts';
import { formatDateTimeAsTimezone } from '@/lib/time.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const timezones = Object.keys(zones)
  .sort()
  .map((zone) => ({
    value: zone,
    label: zone,
  }));

export default function TimezoneContainer() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const form = useForm<z.infer<typeof serverSettingsTimezoneSchema>>({
    initialValues: {
      timezone: server.timezone ?? null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverSettingsTimezoneSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    updateTimezone(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.server.settings.timezone.toast.updated', {}), 'success');
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
    <TitleCard
      title={t('pages.server.settings.timezone.title', {})}
      icon={<FontAwesomeIcon icon={faClock} />}
      className='h-full order-40'
    >
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <Stack gap='xs'>
            <Select
              withAsterisk
              label={t('pages.server.settings.timezone.form.timezone', {})}
              placeholder={t('pages.server.settings.timezone.form.system', {})}
              data={timezones}
              allowDeselect
              clearable
              searchable
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
