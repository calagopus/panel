import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateSecurityKey from '@/api/me/security-keys/updateSecurityKey.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const schema = z.object({
  name: z.string().min(3).max(31),
});

type Props = ModalProps & {
  securityKey: z.infer<typeof userSecurityKeySchema>;
};

export default function SecurityKeyEditModal({ securityKey, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      name: securityKey.name,
    },
    validate: zod4Resolver(schema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateSecurityKey(securityKey.uuid, values);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.securityKeys.all() });
      addToast(t('pages.account.securityKeys.modal.editSecurityKey.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.account.securityKeys.modal.editSecurityKey.title', {})}
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
