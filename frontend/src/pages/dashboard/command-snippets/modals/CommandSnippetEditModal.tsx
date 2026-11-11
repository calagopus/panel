import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import updateCommandSnippet from '@/api/me/command-snippets/updateCommandSnippet.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userCommandSnippetSchema, userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CommandSnippetMatcherBuilder from '../CommandSnippetMatcherBuilder.tsx';

type Props = ModalProps & {
  commandSnippet: z.infer<typeof userCommandSnippetSchema>;
};

export default function CommandSnippetEditModal({ commandSnippet, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userCommandSnippetUpdateSchema>
  >({
    initialValues: {
      name: '',
      matcher: { type: 'all' },
      command: '',
    },
    schema: userCommandSnippetUpdateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateCommandSnippet(commandSnippet.uuid, values);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.commandSnippets.all() });
      addToast(t('pages.account.commandSnippets.modal.editCommandSnippet.toast.updated', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = {
        name: commandSnippet.name,
        matcher: commandSnippet.matcher,
        command: commandSnippet.command,
      };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

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

        <Stack gap='xs'>
          <div>
            <Text fw={500}>{t('pages.account.commandSnippets.form.matcher', {})}</Text>
            <Text size='xs' c='dimmed'>
              {t('pages.account.commandSnippets.form.matcherDescription', {})}
            </Text>
          </div>
          <CommandSnippetMatcherBuilder
            matcher={form.values.matcher}
            onChange={(matcher) => form.setFieldValue('matcher', matcher)}
          />
        </Stack>

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
