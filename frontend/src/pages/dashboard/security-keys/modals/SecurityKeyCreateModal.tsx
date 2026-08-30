import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createSecurityKey from '@/api/me/security-keys/createSecurityKey.ts';
import deleteSecurityKey from '@/api/me/security-keys/deleteSecurityKey.ts';
import postSecurityKeyChallenge from '@/api/me/security-keys/postSecurityKeyChallenge.ts';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userSecurityKeyCreateSchema } from '@/lib/schemas/user/securityKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function SecurityKeyCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const settings = useGlobalStore((state) => state.settings);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userSecurityKeyCreateSchema>
  >({
    initialValues: {
      name: '',
      allowUsernamelessLogin: settings.webauthn?.allowDiscoverable !== false,
      password: '',
    },
    validate: zod4Resolver(
      userSecurityKeyCreateSchema.extend({
        password: user?.hasPassword
          ? z.string().min(1, t('common.form.passwordRequired', {})).max(512)
          : z.string().max(512),
      }),
    ),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const [key, options] = await createSecurityKey({
        ...values,
        password: user?.hasPassword ? values.password : 'aaa',
      });

      let credential: Credential | null;
      try {
        credential = await window.navigator.credentials.create(options);
      } catch (error) {
        console.error(error);

        let message = t('pages.account.securityKeys.modal.createSecurityKey.toast.aborted', {});
        if (error instanceof DOMException) {
          switch (error.name) {
            case 'InvalidStateError':
              message = t('pages.auth.login.passkey.error.invalidState', {});
              break;
            case 'NotSupportedError':
              message = t('pages.auth.login.passkey.error.notSupportedType', {});
              break;
            case 'SecurityError':
              message = t('pages.auth.login.passkey.error.securityError', {});
              break;
            case 'UnknownError':
              message = t('pages.auth.login.passkey.error.authenticatorError', {});
              break;
            case 'ConstraintError':
              message = t('pages.auth.login.passkey.error.constraintError', {});
              break;
          }
        }

        addToast(message, 'error');
        deleteSecurityKey(key.uuid).catch(() => null);
        return;
      }

      try {
        const credentialId = await postSecurityKeyChallenge(key.uuid, credential as PublicKeyCredential);
        addToast(t('pages.account.securityKeys.modal.createSecurityKey.toast.created', {}), 'success');

        key.credentialId = credentialId;
        queryClient.invalidateQueries({ queryKey: queryKeys.user.securityKeys.all() });
      } catch (error) {
        console.error(error);
        addToast(httpErrorToHuman(error), 'error');
        deleteSecurityKey(key.uuid).catch(() => null);
      }
    },
  });

  return (
    <FormModal
      title={t('pages.account.securityKeys.modal.createSecurityKey.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        {settings.webauthn?.allowDiscoverable !== false && (
          <Switch
            label={t('pages.account.securityKeys.modal.createSecurityKey.allowUsernamelessLogin', {})}
            description={t('pages.account.securityKeys.modal.createSecurityKey.allowUsernamelessLoginDescription', {})}
            name='allowUsernamelessLogin'
            {...form.getInputProps('allowUsernamelessLogin', { type: 'checkbox' })}
          />
        )}

        {user?.hasPassword && (
          <PasswordInput
            withAsterisk
            label={t('common.form.password', {})}
            autoComplete='current-password'
            {...form.getInputProps('password')}
          />
        )}

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
