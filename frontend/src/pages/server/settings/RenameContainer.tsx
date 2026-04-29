import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import renameServer from '@/api/server/settings/renameServer.ts';
import Button from '@/elements/Button.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { serverSettingsRenameSchema } from '@/lib/schemas/server/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function RenameContainer() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, updateServer } = useServerStore();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof serverSettingsRenameSchema>>({
    initialValues: {
      name: server.name,
      description: server.description,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverSettingsRenameSchema),
  });

  const doUpdate = () => {
    setLoading(true);
    renameServer(server.uuid, serverSettingsRenameSchema.parse(form.values))
      .then(() => {
        addToast(t('pages.server.settings.rename.toast.renamed', {}), 'success');
        updateServer(form.values);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.server.settings.rename.title', {})}
      icon={<FontAwesomeIcon icon={faPenToSquare} />}
      className='h-full order-10'
    >
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <TextInput
            withAsterisk
            label={t('pages.server.settings.rename.form.serverName', {})}
            placeholder={t('pages.server.settings.rename.form.serverName', {})}
            {...form.getInputProps('name')}
          />

          <TextArea
            label={t('common.form.description', {})}
            placeholder={t('common.form.description', {})}
            rows={3}
            {...form.getInputProps('description')}
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
