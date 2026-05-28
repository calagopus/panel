import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import Anchor from '@/elements/Anchor.tsx';
import Button from '@/elements/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function SftpDetailsModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const { server } = useServerStore();

  return (
    <Modal title={t('pages.server.files.modal.sftpDetails.title', {})} onClose={onClose} opened={opened}>
      <div className='grid grid-cols-4 gap-2'>
        <CopyOnClick content='SFTP' className='text-left'>
          <TextInput
            label={t('pages.server.files.modal.sftpDetails.form.protocol', {})}
            value='SFTP'
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>
        <CopyOnClick content={server.sftpPort.toString()} className='text-left'>
          <TextInput
            label={t('pages.server.files.modal.sftpDetails.form.port', {})}
            value={server.sftpPort}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>
        <CopyOnClick content={server.sftpHost} className='col-span-2 text-left'>
          <TextInput
            label={t('pages.server.files.modal.sftpDetails.form.host', {})}
            value={server.sftpHost}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>

        <CopyOnClick content={`${user!.username}.${server.uuidShort}`} className='col-span-4 text-left'>
          <TextInput
            label={t('pages.server.files.modal.sftpDetails.form.username', {})}
            value={`${user!.username}.${server.uuidShort}`}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>

        <TextInput
          label={t('pages.server.files.modal.sftpDetails.form.password', {})}
          value={t('pages.server.files.modal.sftpDetails.form.yourPassword', {})}
          className='col-span-4 pointer-events-none'
          readOnly
        />
      </div>

      <ModalFooter>
        <Anchor href={`sftp://${user!.username}.${server.uuidShort}@${server.sftpHost}:${server.sftpPort}`}>
          <Button onClick={onClose} leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
            {t('pages.server.files.modal.sftpDetails.launch', {})}
          </Button>
        </Anchor>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
