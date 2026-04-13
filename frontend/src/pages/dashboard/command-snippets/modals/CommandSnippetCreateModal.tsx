import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createCommandSnippet from '@/api/me/command-snippets/createCommandSnippet.ts';
import getUserEggs from '@/api/me/servers/eggs/getUserEggs.ts';
import Button from '@/elements/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverEggSchema } from '@/lib/schemas/server/server.ts';
import { userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

export default function CommandSnippetCreateModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { addCommandSnippet } = useUserStore();

  const [loading, setLoading] = useState(false);

  const eggs = useSearchableResource<z.infer<typeof serverEggSchema>>({
    fetcher: (search) => getUserEggs(1, search),
  });

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof userCommandSnippetUpdateSchema>>(
    {
      initialValues: {
        name: '',
        eggs: [],
        command: 'say hello world',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(userCommandSnippetUpdateSchema),
    },
    onClose,
  );

  const doCreate = () => {
    setLoading(true);

    createCommandSnippet(form.values)
      .then((snippet) => {
        addToast(t('pages.account.commandSnippets.modal.createCommandSnippet.toast.created', {}), 'success');

        handleClose();
        addCommandSnippet(snippet);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.account.commandSnippets.modal.createCommandSnippet.title', {})}
      onClose={handleClose}
      opened={opened}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.name', {})}
          placeholder={t('common.form.name', {})}
          {...form.getInputProps('name')}
        />

        <MultiSelect
          label={t('pages.account.commandSnippets.form.eggs', {})}
          placeholder={t('pages.account.commandSnippets.form.eggs', {})}
          data={eggs.items.map((egg) => ({
            label: egg.name,
            value: egg.uuid,
          }))}
          searchable
          searchValue={eggs.search}
          onSearchChange={eggs.setSearch}
          loading={eggs.loading}
          {...form.getInputProps('eggs')}
        />

        <TextArea
          withAsterisk
          label={t('pages.account.commandSnippets.form.command', {})}
          placeholder={t('pages.account.commandSnippets.form.command', {})}
          rows={3}
          resize='none'
          {...form.getInputProps('command')}
        />

        <ModalFooter>
          <Button onClick={doCreate} loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
