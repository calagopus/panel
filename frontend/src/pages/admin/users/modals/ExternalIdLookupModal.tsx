import { faEye, faMagnifyingGlass, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getUserByExternalId from '@/api/admin/users/getUserByExternalId.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ExternalIdLookupModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [externalId, setExternalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<z.infer<typeof adminFullUserSchema> | null>(null);
  const [notFound, setNotFound] = useState(false);

  const doSearch = () => {
    if (!externalId.trim()) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);

    getUserByExternalId(externalId.trim())
      .then((user) => setResult(user))
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
    setExternalId('');
    setResult(null);
    setNotFound(false);
    props.onClose();
  };

  const goToUser = () => {
    if (!result) return;
    navigate(`/admin/users/${result.uuid}`);
  };

  return (
    <Modal title={t('pages.admin.users.externalIdLookup.modal.title', {})} {...props} onClose={handleClose}>
      <Stack>
        <Group align='flex-end'>
          <TextInput
            label={t('pages.admin.users.externalIdLookup.modal.form.externalId', {})}
            placeholder={t('pages.admin.users.externalIdLookup.modal.form.externalIdPlaceholder', {})}
            value={externalId}
            onChange={(e) => {
              setExternalId(e.target.value);
              setResult(null);
              setNotFound(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            style={{ flex: 1 }}
          />
          <Button onClick={doSearch} loading={loading} disabled={!externalId.trim()}>
            {t('pages.admin.users.externalIdLookup.modal.form.search', {})}
          </Button>
        </Group>

        {notFound && (
          <Alert icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}>
            {t('pages.admin.users.externalIdLookup.modal.notFound', {})}
          </Alert>
        )}

        {result && (
          <TitleCard
            title={t('pages.admin.users.externalIdLookup.modal.result.title', {})}
            icon={<FontAwesomeIcon icon={faUser} />}
          >
            <Stack gap='xs'>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.users.externalIdLookup.modal.result.username', {})}
                </Text>
                <Text size='sm'>{result.username}</Text>
              </Group>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.users.externalIdLookup.modal.result.email', {})}
                </Text>
                <Text size='sm'>{result.email}</Text>
              </Group>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.users.externalIdLookup.modal.result.role', {})}
                </Text>
                <Text size='sm'>{result.role?.name ?? '-'}</Text>
              </Group>
            </Stack>
          </TitleCard>
        )}
      </Stack>

      <ModalFooter>
        {result && (
          <Button color='blue' leftSection={<FontAwesomeIcon icon={faEye} />} onClick={goToUser}>
            {t('pages.admin.users.externalIdLookup.modal.result.viewUser', {})}
          </Button>
        )}
        <Button variant='default' onClick={handleClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
