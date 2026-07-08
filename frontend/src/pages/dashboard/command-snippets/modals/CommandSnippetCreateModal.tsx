import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import createCommandSnippet from '@/api/me/command-snippets/createCommandSnippet.ts';
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
import { userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

export default function CommandSnippetCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const addCommandSnippet = useUserStore((state) => state.addCommandSnippet);

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
      command: 'say hello world',
    },
    validate: zod4Resolver(userCommandSnippetUpdateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const snippet = await createCommandSnippet(values);
      addToast(t('pages.account.commandSnippets.modal.createCommandSnippet.toast.created', {}), 'success');
      addCommandSnippet(snippet);
    },
  });

  return (
    <FormModal
      title={t('pages.account.commandSnippets.modal.createCommandSnippet.title', {})}
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
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
