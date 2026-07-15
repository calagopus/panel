import { faEye, faMagnifyingGlass, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getOAuthProviderUserByIdentifier from '@/api/admin/oauth-providers/users/getOAuthProviderUserByIdentifier.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminOAuthUserLinkSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function IdentifierLookupModal({
  oauthProviderUuid,
  ...props
}: ModalProps & { oauthProviderUuid: string }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<z.infer<typeof adminOAuthUserLinkSchema> | null>(null);
  const [notFound, setNotFound] = useState(false);

  const doSearch = () => {
    if (!identifier.trim()) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);

    getOAuthProviderUserByIdentifier(oauthProviderUuid, identifier.trim())
      .then((userOAuthLink) => setResult(userOAuthLink))
      .catch((err) => {
        const status =
          err && typeof err === 'object' && 'response' in err && (err as { response?: { status?: number } }).response
            ? (err as { response: { status: number } }).response.status
            : null;

        if (status === 404) {
          setNotFound(true);
        } else {
          addToast(httpErrorToHuman(err), 'error');
        }
      })
      .finally(() => setLoading(false));
  };

  const handleClose = () => {
    setIdentifier('');
    setResult(null);
    setNotFound(false);
    props.onClose();
  };

  const goToUser = () => {
    if (!result) return;
    navigate(`/admin/users/${result.user.uuid}`);
  };

  return (
    <Modal
      title={t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.title', {})}
      {...props}
      onClose={handleClose}
    >
      <Stack>
        <Group align='flex-end'>
          <TextInput
            label={t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.form.identifier', {})}
            placeholder={t(
              'pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.form.identifierPlaceholder',
              {},
            )}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setResult(null);
              setNotFound(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            style={{ flex: 1 }}
          />
          <Button onClick={doSearch} loading={loading} disabled={!identifier.trim()}>
            {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.form.search', {})}
          </Button>
        </Group>

        {notFound && (
          <Alert icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}>
            {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.notFound', {})}
          </Alert>
        )}

        {result && (
          <TitleCard
            title={t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.result.title', {})}
            icon={<FontAwesomeIcon icon={faUser} />}
          >
            <Stack gap='xs'>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.result.username', {})}
                </Text>
                <Text size='sm'>{result.user.username}</Text>
              </Group>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.result.email', {})}
                </Text>
                <Text size='sm'>{result.user.email}</Text>
              </Group>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.result.identifier', {})}
                </Text>
                <Text size='sm'>{result.identifier}</Text>
              </Group>
            </Stack>
          </TitleCard>
        )}
      </Stack>

      <ModalFooter>
        {result && (
          <Button color='blue' leftSection={<FontAwesomeIcon icon={faEye} />} onClick={goToUser}>
            {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.modal.result.viewUser', {})}
          </Button>
        )}
        <Button variant='default' onClick={handleClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
