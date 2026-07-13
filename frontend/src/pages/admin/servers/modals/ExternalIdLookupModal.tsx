import { faEye, faMagnifyingGlass, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getServerByExternalId from '@/api/admin/servers/getServerByExternalId.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ExternalIdLookupModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [externalId, setExternalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<z.infer<typeof adminServerSchema> | null>(null);
  const [notFound, setNotFound] = useState(false);

  const doSearch = () => {
    if (!externalId.trim()) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);

    getServerByExternalId(externalId.trim())
      .then((server) => setResult(server))
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

  const goToServer = () => {
    if (!result) return;
    navigate(`/admin/servers/${result.uuid}`);
  };

  return (
    <Modal title={t('pages.admin.servers.externalIdLookup.modal.title', {})} {...props} onClose={handleClose}>
      <Stack>
        <Group align='flex-end'>
          <TextInput
            label={t('pages.admin.servers.externalIdLookup.modal.form.externalId', {})}
            placeholder={t('pages.admin.servers.externalIdLookup.modal.form.externalIdPlaceholder', {})}
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
            {t('pages.admin.servers.externalIdLookup.modal.form.search', {})}
          </Button>
        </Group>

        {notFound && (
          <Alert icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}>
            {t('pages.admin.servers.externalIdLookup.modal.notFound', {})}
          </Alert>
        )}

        {result && (
          <TitleCard
            title={t('pages.admin.servers.externalIdLookup.modal.result.title', {})}
            icon={<FontAwesomeIcon icon={faServer} />}
          >
            <Stack gap='xs'>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.servers.externalIdLookup.modal.result.name', {})}
                </Text>
                <Text size='sm'>{result.name}</Text>
              </Group>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.servers.externalIdLookup.modal.result.owner', {})}
                </Text>
                <Text size='sm'>{result.owner.username}</Text>
              </Group>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.servers.externalIdLookup.modal.result.node', {})}
                </Text>
                <Text size='sm'>{result.node.name}</Text>
              </Group>
            </Stack>
          </TitleCard>
        )}
      </Stack>

      <ModalFooter>
        {result && (
          <Button color='blue' leftSection={<FontAwesomeIcon icon={faEye} />} onClick={goToServer}>
            {t('pages.admin.servers.externalIdLookup.modal.result.viewServer', {})}
          </Button>
        )}
        <Button variant='default' onClick={handleClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
