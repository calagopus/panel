import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateSshKey from '@/api/me/ssh-keys/updateSshKey.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

const schema = z.object({
  name: z.string().min(3).max(31),
});

type Props = ModalProps & {
  sshKey: z.infer<typeof userSshKeySchema>;
};

export default function SshKeyEditModal({ sshKey, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateSshKey: updateStateSshKey } = useUserStore();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      name: sshKey.name,
    },
    validate: zod4Resolver(schema),
    onClose,
    onSubmit: async (values) => {
      await updateSshKey(sshKey.uuid, values);
      updateStateSshKey(sshKey.uuid, values);
      addToast(t('pages.account.sshKeys.modal.editSshKey.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.account.sshKeys.modal.editSshKey.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
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
