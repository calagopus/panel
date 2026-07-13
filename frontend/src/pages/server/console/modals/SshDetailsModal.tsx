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

export default function SshDetailsModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const server = useServerStore((state) => state.server);

  return (
    <Modal title={t('pages.server.console.modal.sshDetails.title', {})} {...props}>
      <div className='grid grid-cols-4 gap-2'>
        <CopyOnClick content='SSH' className='text-left'>
          <TextInput label={t('common.form.protocol', {})} value='SSH' className='pointer-events-none' readOnly />
        </CopyOnClick>
        <CopyOnClick content={server.sftpPort.toString()} className='text-left'>
          <TextInput
            label={t('common.form.port', {})}
            value={server.sftpPort}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>
        <CopyOnClick content={server.sftpHost} className='col-span-2 text-left'>
          <TextInput
            label={t('common.form.host', {})}
            value={server.sftpHost}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>

        <CopyOnClick content={`${user!.username}.${server.uuidShort}`} className='col-span-4 text-left'>
          <TextInput
            label={t('common.form.username', {})}
            value={`${user!.username}.${server.uuidShort}`}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>

        <TextInput
          label={t('common.form.password', {})}
          value={t('common.form.yourControlPanelPassword', {})}
          className='col-span-4 pointer-events-none'
          readOnly
        />

        <CopyOnClick
          content={`ssh ${user!.username}.${server.uuidShort}@${server.sftpHost} -p ${server.sftpPort}`}
          className='col-span-4 text-left'
        >
          <TextInput
            label={t('pages.server.console.modal.sshDetails.form.command', {})}
            value={`ssh ${user!.username}.${server.uuidShort}@${server.sftpHost} -p ${server.sftpPort}`}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>
      </div>

      <ModalFooter>
        <Anchor href={`ssh://${user!.username}.${server.uuidShort}@${server.sftpHost}:${server.sftpPort}`}>
          <Button onClick={props.onClose} leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
            {t('pages.server.console.modal.sshDetails.launch', {})}
          </Button>
        </Anchor>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
