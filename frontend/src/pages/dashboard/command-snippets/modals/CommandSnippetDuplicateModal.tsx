import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import duplicateCommandSnippet from '@/api/me/command-snippets/duplicateCommandSnippet.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const duplicateCommandSnippetSchema = z.object({
  name: z.string().min(1).max(31),
});

type Props = ModalProps & {
  commandSnippet: z.infer<typeof userCommandSnippetSchema>;
};

export default function CommandSnippetDuplicateModal({ commandSnippet, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof duplicateCommandSnippetSchema>
  >({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(duplicateCommandSnippetSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await duplicateCommandSnippet(commandSnippet.uuid, values.name);
      addToast(t('pages.account.commandSnippets.modal.duplicateCommandSnippet.toast.duplicated', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.user.commandSnippets.all() });
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = { name: `${commandSnippet.name} (copy)`.slice(0, 31) };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.account.commandSnippets.modal.duplicateCommandSnippet.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.newName', {})} {...form.getInputProps('name')} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
