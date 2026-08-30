import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import deleteSecurityKey from '@/api/me/security-keys/deleteSecurityKey.ts';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userSecurityKeyDeleteSchema, userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  securityKey: z.infer<typeof userSecurityKeySchema>;
};

export default function SecurityKeyDeleteModal({ securityKey, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userSecurityKeyDeleteSchema>
  >({
    initialValues: {
      password: '',
    },
    validate: zod4Resolver(
      userSecurityKeyDeleteSchema.extend({
        password: user?.hasPassword
          ? z.string().min(1, t('common.form.passwordRequired', {})).max(512)
          : z.string().max(512),
      }),
    ),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await deleteSecurityKey(securityKey.uuid, {
        password: user?.hasPassword ? values.password : 'aaa',
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.user.securityKeys.all() });
      addToast(t('pages.account.securityKeys.modal.deleteSecurityKey.toast.deleted', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.account.securityKeys.modal.deleteSecurityKey.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text>
          {t('pages.account.securityKeys.modal.deleteSecurityKey.content', {
            key: securityKey.name,
          }).md()}
        </Text>

        {user?.hasPassword && (
          <PasswordInput
            withAsterisk
            label={t('common.form.password', {})}
            autoComplete='current-password'
            {...form.getInputProps('password')}
          />
        )}

        <ModalFooter>
          <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.delete', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
