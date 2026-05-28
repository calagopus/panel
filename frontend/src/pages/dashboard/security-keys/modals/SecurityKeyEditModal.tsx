import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateSecurityKey from '@/api/me/security-keys/updateSecurityKey.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

const schema = z.object({
  name: z.string().min(3).max(31),
});

type Props = ModalProps & {
  securityKey: z.infer<typeof userSecurityKeySchema>;
};

export default function SecurityKeyEditModal({ securityKey, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateSecurityKey: updateStateSecurityKey } = useUserStore();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      name: securityKey.name,
    },
    validate: zod4Resolver(schema),
    onClose,
    onSubmit: async (values) => {
      await updateSecurityKey(securityKey.uuid, values);
      updateStateSecurityKey(securityKey.uuid, values);
      addToast(t('pages.account.securityKeys.modal.editSecurityKey.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.account.securityKeys.modal.editSecurityKey.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.name', {})}
          placeholder={t('common.form.name', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
