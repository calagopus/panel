import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import deleteServer from '@/api/admin/servers/deleteServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerDeleteModal({
  server,
  ...props
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [deleteDoForce, setDeleteDoForce] = useState(false);
  const [deleteDoDeleteBackups, setDeleteDoDeleteBackups] = useState(false);
  const [deleteServerName, setDeleteServerName] = useState('');

  const doDelete = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    deleteServer(server.uuid, {
      force: deleteDoForce,
      deleteBackups: deleteDoDeleteBackups,
    })
      .then(() => {
        addToast(t('pages.admin.servers.tabs.management.page.delete.toast.deleted', {}), 'success');
        props.onClose();
        navigate('/admin/servers');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <FormModal
        title={t('pages.admin.servers.tabs.management.page.delete.modal.title', {})}
        loading={loading}
        {...props}
        onSubmit={doDelete}
      >
        <Stack>
          <Text size='sm'>
            {t('pages.admin.servers.tabs.management.page.delete.modal.description', { name: server.name }).md()}
          </Text>

          <Switch
            label={t('pages.admin.servers.tabs.management.page.delete.modal.form.force', {})}
            name='force'
            color='red'
            defaultChecked={deleteDoForce}
            onChange={(e) => setDeleteDoForce(e.target.checked)}
          />

          {deleteDoForce && (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.admin.servers.tabs.management.page.delete.modal.form.forceWarning', {})}
            </Alert>
          )}

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
          <Button color='red' type='submit' disabled={server.name != deleteServerName} loading={loading}>
            {t('common.button.delete', {})}
          </Button>
          <Button variant='default' onClick={() => props.onClose()}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </FormModal>
    </>
  );
}
