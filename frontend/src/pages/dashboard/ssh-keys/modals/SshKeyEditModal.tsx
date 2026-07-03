import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateSshKey from '@/api/me/ssh-keys/updateSshKey.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const schema = z.object({
  name: z.string().min(3).max(31),
});

type Props = ModalProps & {
  sshKey: z.infer<typeof userSshKeySchema>;
};

export default function SshKeyEditModal({ sshKey, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      name: sshKey.name,
    },
    validate: zod4Resolver(schema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateSshKey(sshKey.uuid, values);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.sshKeys.all() });
      addToast(t('pages.account.sshKeys.modal.editSshKey.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.account.sshKeys.modal.editSshKey.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

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
