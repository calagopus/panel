import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import deleteSecurityKey from '@/api/me/security-keys/deleteSecurityKey.ts';
import Button from '@/elements/buttons/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { withTwoFactorMethod } from '@/lib/auth/twoFactor.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userSecurityKeyDeleteSchema, userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type Props = ModalProps & {
  securityKey: z.infer<typeof userSecurityKeySchema>;
  total: number;
};

export default function SecurityKeyDeleteModal({ securityKey, total, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuth();
  const twoFactorAcceptedMethods = useGlobalStore((state) => state.settings.app.twoFactorAcceptedMethods);

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

      if (total <= 1) {
        setUser(withTwoFactorMethod(user!, twoFactorAcceptedMethods, 'security_key', false));
      }
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
