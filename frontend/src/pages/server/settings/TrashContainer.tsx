import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateTrash from '@/api/server/settings/updateTrash.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import TrashSettingsInput from '@/elements/input/TrashSettingsInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { serverSettingsTrashSchema } from '@/lib/schemas/server/settings.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function TrashContainer() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const updateServer = useServerStore((state) => state.updateServer);
  const allowChangingTrashSettings = useGlobalStore((state) => state.settings.server.allowChangingTrashSettings);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof serverSettingsTrashSchema>>({
    initialValues: {
      custom: server.trash.custom
        ? { retention: server.trash.retention ?? 0, usageThreshold: server.trash.usageThreshold ?? 0 }
        : null,
    },
    ...liveValidation,
    validate: zod4Resolver(serverSettingsTrashSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    updateTrash(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.server.settings.trash.toast.updated', {}), 'success');

        const effective = form.values.custom ?? server.trash.defaults;
        updateServer({
          trash: {
            ...server.trash,
            custom: form.values.custom !== null,
            retention: effective.retention === 0 ? null : effective.retention,
            usageThreshold: effective.usageThreshold === 0 ? null : effective.usageThreshold,
          },
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  if (!allowChangingTrashSettings) return null;

  return (
    <TitleCard title={t('pages.server.settings.trash.title', {})} icon={faTrashCan} className='h-full order-50'>
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <TrashSettingsInput
            value={form.values.custom}
            defaults={server.trash.defaults}
            onChange={(custom) => form.setFieldValue('custom', custom)}
            errors={{
              retention: form.errors['custom.retention'],
              usageThreshold: form.errors['custom.usageThreshold'],
            }}
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
