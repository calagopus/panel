import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createSecurityKey from '@/api/me/security-keys/createSecurityKey.ts';
import deleteSecurityKey from '@/api/me/security-keys/deleteSecurityKey.ts';
import postSecurityKeyChallenge from '@/api/me/security-keys/postSecurityKeyChallenge.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const schema = z.object({
  name: z.string().min(3).max(31),
});

export default function SecurityKeyCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(schema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const [key, options] = await createSecurityKey(values);

      let credential: Credential | null;
      try {
        credential = await window.navigator.credentials.create(options);
      } catch (error) {
        console.error(error);
        addToast(t('pages.account.securityKeys.modal.createSecurityKey.toast.aborted', {}), 'error');
        deleteSecurityKey(key.uuid);
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
        deleteSecurityKey(key.uuid);
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
      <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!form.isValid()}>
          {t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
