import { ModalProps, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import deleteServer from '@/api/admin/servers/deleteServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerDeleteModal({
  server,
  opened,
  onClose,
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [deleteDoForce, setDeleteDoForce] = useState(false);
  const [deleteDoDeleteBackups, setDeleteDoDeleteBackups] = useState(false);
  const [deleteServerName, setDeleteServerName] = useState('');

  const doDelete = () => {
    setLoading(true);
    deleteServer(server.uuid, {
      force: deleteDoForce,
      deleteBackups: deleteDoDeleteBackups,
    })
      .then(() => {
        addToast(t('pages.admin.servers.tabs.management.page.delete.toast.deleted', {}), 'success');
        onClose();
        navigate('/admin/servers');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Modal
        title={t('pages.admin.servers.tabs.management.page.delete.modal.title', {})}
        onClose={onClose}
        opened={opened}
      >
        <Stack>
          <Text size='sm'>
            {t('pages.admin.servers.tabs.management.page.delete.modal.description', { name: server.name }).md()}
          </Text>

          <Switch
            label={t('pages.admin.servers.tabs.management.page.delete.modal.form.force', {})}
            name='force'
            defaultChecked={deleteDoForce}
            onChange={(e) => setDeleteDoForce(e.target.checked)}
          />

          <Switch
            label={t('pages.admin.servers.tabs.management.page.delete.modal.form.deleteBackups', {})}
            name='deleteBackups'
            defaultChecked={deleteDoDeleteBackups}
            onChange={(e) => setDeleteDoDeleteBackups(e.target.checked)}
          />

          <TextInput
            withAsterisk
            label={t('pages.admin.servers.tabs.management.page.delete.modal.form.confirmServerName', {})}
            placeholder={t(
              'pages.admin.servers.tabs.management.page.delete.modal.form.confirmServerNamePlaceholder',
              {},
            )}
            value={deleteServerName}
            onChange={(e) => setDeleteServerName(e.target.value)}
          />
        </Stack>

        <ModalFooter>
          <Button color='red' disabled={server.name != deleteServerName} loading={loading} onClick={doDelete}>
            {t('common.button.delete', {})}
          </Button>
          <Button variant='default' onClick={() => onClose()}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
