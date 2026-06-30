import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateOAuthProvider from '@/api/admin/oauth-providers/duplicateOAuthProvider.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function OAuthProviderDuplicateModal({
  oauthProvider,
  ...props
}: ModalProps & { oauthProvider: z.infer<typeof adminOAuthProviderSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => setName(`${oauthProvider.name} (copy)`), [oauthProvider, props.opened]);

  const doDuplicate = () => {
    setLoading(true);

    duplicateOAuthProvider(oauthProvider.uuid, name)
      .then((duplicated) => {
        addToast(
          t('common.toast.duplicated', { resource: t('pages.admin.oAuthProviders.resourceName', {}) }),
          'success',
        );
        props.onClose();
        navigate(`/admin/oauth-providers/${duplicated.uuid}`);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('common.modal.duplicate.title', { resource: t('pages.admin.oAuthProviders.resourceName', {}) })}
      {...props}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.newName', {})}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <ModalFooter>
          <Button onClick={doDuplicate} loading={loading} disabled={name.length < 1}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
