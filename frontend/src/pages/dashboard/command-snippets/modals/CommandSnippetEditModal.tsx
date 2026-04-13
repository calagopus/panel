import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateCommandSnippet from '@/api/me/command-snippets/updateCommandSnippet.ts';
import getUserEggs from '@/api/me/servers/eggs/getUserEggs.ts';
import Button from '@/elements/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverEggSchema } from '@/lib/schemas/server/server.ts';
import { userCommandSnippetSchema, userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

type Props = ModalProps & {
  commandSnippet: z.infer<typeof userCommandSnippetSchema>;
};

export default function CommandSnippetEditModal({ commandSnippet, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateCommandSnippet: updateStateCommandSnippet } = useUserStore();

  const [loading, setLoading] = useState(false);

  const eggs = useSearchableResource<z.infer<typeof serverEggSchema>>({
    fetcher: (search) => getUserEggs(1, search),
  });

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof userCommandSnippetUpdateSchema>>(
    {
      initialValues: {
        name: '',
        eggs: [],
        command: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(userCommandSnippetUpdateSchema),
    },
    onClose,
  );

  useEffect(() => {
    form.setValues({
      name: commandSnippet.name,
      eggs: commandSnippet.eggs,
      command: commandSnippet.command,
    });
  }, []);

  const doUpdate = () => {
    setLoading(true);

    updateCommandSnippet(commandSnippet.uuid, form.values)
      .then(() => {
        updateStateCommandSnippet(commandSnippet.uuid, form.values);

        handleClose();
        addToast(t('pages.account.commandSnippets.modal.editCommandSnippet.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.account.commandSnippets.modal.editCommandSnippet.title', {})}
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
          <Button onClick={doUpdate} loading={loading} disabled={!form.isValid()}>
            {t('common.button.edit', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
