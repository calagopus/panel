import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import updateCommandSnippet from '@/api/me/command-snippets/updateCommandSnippet.ts';
import getUserEggs from '@/api/me/servers/eggs/getUserEggs.ts';
import Button from '@/elements/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
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

export default function CommandSnippetEditModal({ commandSnippet, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const updateStateCommandSnippet = useUserStore((state) => state.updateCommandSnippet);

  const eggs = useSearchableResource<z.infer<typeof serverEggSchema>>({
    queryKey: [...queryKeys.user.servers.all(), 'eggs'],
    fetcher: (search) => getUserEggs(1, search),
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userCommandSnippetUpdateSchema>
  >({
    initialValues: {
      name: '',
      eggs: [],
      command: '',
    },
    validate: zod4Resolver(userCommandSnippetUpdateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateCommandSnippet(commandSnippet.uuid, values);
      updateStateCommandSnippet(commandSnippet.uuid, values);
      addToast(t('pages.account.commandSnippets.modal.editCommandSnippet.toast.updated', {}), 'success');
    },
  });

  useEffect(() => {
    form.setValues({
      name: commandSnippet.name,
      eggs: commandSnippet.eggs,
      command: commandSnippet.command,
    });
  }, [commandSnippet]);

  return (
    <FormModal
      title={t('pages.account.commandSnippets.modal.editCommandSnippet.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <MultiSelect
          label={t('common.form.eggs', {})}
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
          label={t('common.form.command', {})}
          rows={3}
          resize='none'
          {...form.getInputProps('command')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.edit', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
