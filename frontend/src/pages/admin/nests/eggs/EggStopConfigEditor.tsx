import { faStop } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { useState } from 'react';
import { z } from 'zod';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import { adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const SIGNALS = ['SIGABRT', 'SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGKILL'];

export default function EggStopConfigEditor({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminEggUpdateSchema>>;
}) {
  const { t } = useTranslations();

  const [stopType, setStopType] = useState(() => form.getValues().configStop.type);
  form.watch('configStop.type', ({ value }) => setStopType(value));

  return (
    <TitleCard
      title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.card.stopConfiguration', {})}
      icon={<FontAwesomeIcon icon={faStop} size='sm' />}
    >
      <Group grow>
        <Select
          withAsterisk
          label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stopType', {})}
          data={[
            {
              label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.enum.stopType.command', {}),
              value: 'command',
            },
            {
              label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.enum.stopType.signal', {}),
              value: 'signal',
            },
            {
              label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.enum.stopType.docker', {}),
              value: 'docker',
            },
          ]}
          key={form.key('configStop.type')}
          {...form.getInputProps('configStop.type')}
          onChange={(value) => {
            if (!value) return;
            form.setFieldValue('configStop.type', value as 'command' | 'signal' | 'docker');

            if (value === 'signal' && !SIGNALS.includes(form.getValues().configStop.value ?? '')) {
              form.setFieldValue('configStop.value', 'SIGKILL');
            }
          }}
        />
        {stopType === 'command' ? (
          <TextInput
            withAsterisk
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stopCommand', {})}
            key={form.key('configStop.value')}
            {...form.getInputProps('configStop.value')}
          />
        ) : stopType === 'signal' ? (
          <Select
            withAsterisk
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stopSignal', {})}
            data={[
              { label: 'SIGABRT', value: 'SIGABRT' },
              { label: 'SIGINT (^C)', value: 'SIGINT' },
              { label: 'SIGTERM', value: 'SIGTERM' },
              { label: 'SIGQUIT', value: 'SIGQUIT' },
              { label: 'SIGKILL', value: 'SIGKILL' },
            ]}
            key={form.key('configStop.value')}
            {...form.getInputProps('configStop.value')}
          />
        ) : null}
      </Group>
    </TitleCard>
  );
}
