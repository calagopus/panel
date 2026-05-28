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

export default function ServerDeleteModal({
  server,
  opened,
  onClose,
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
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
        addToast('Server deleted.', 'success');
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
      <Modal title='Confirm Server Deletion' onClose={onClose} opened={opened}>
        <Stack>
          <Text size='sm'>
            You are about to delete <span className='font-bold'>{server.name}</span>. Are you sure?
          </Text>

          <Switch
            label='Do you want to forcefully delete this server?'
            name='force'
            defaultChecked={deleteDoForce}
            onChange={(e) => setDeleteDoForce(e.target.checked)}
          />

          <Switch
            label='Do you want to delete backups of this server?'
            name='deleteBackups'
            defaultChecked={deleteDoDeleteBackups}
            onChange={(e) => setDeleteDoDeleteBackups(e.target.checked)}
          />

          <TextInput
            withAsterisk
            label='Confirm Server Name'
            placeholder='Server Name'
            value={deleteServerName}
            onChange={(e) => setDeleteServerName(e.target.value)}
          />
        </Stack>

        <ModalFooter>
          <Button color='red' disabled={server.name != deleteServerName} loading={loading} onClick={doDelete}>
            Delete
          </Button>
          <Button variant='default' onClick={() => onClose()}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
