import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import updateServer from '@/api/admin/servers/updateServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import TrashSettingsInput from '@/elements/input/TrashSettingsInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer, adminServerTrashSchema } from '@/lib/schemas/admin/servers.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TrashCard({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminServerTrashSchema>>({
    initialValues: {
      trash: server.trash,
    },
    ...liveValidation,
    validate: zod4Resolver(adminServerTrashSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    updateServer(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.admin.servers.tabs.management.page.trash.toast.updated', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.admin.servers.tabs.management.page.trash.title', {})}
      icon={faTrashCan}
      className='order-50'
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <TrashSettingsInput
            value={form.values.trash}
            defaults={server.trashDefaults}
            onChange={(trash) => form.setFieldValue('trash', trash)}
            errors={{
              retention: form.errors['trash.retention'],
              usageThreshold: form.errors['trash.usageThreshold'],
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
