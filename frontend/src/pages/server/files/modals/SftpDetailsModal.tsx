import { faExternalLink, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import Button from '@/elements/buttons/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';
import { useRedactedAddress } from '@/plugins/privacy/useRedactAddresses.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function SftpDetailsModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const passwordLoginEnabled = useGlobalStore((state) => state.settings.app.passwordLoginEnabled);
  const server = useServerStore((state) => state.server);
  const displayHost = useRedactedAddress(server.sftpHost);

  return (
    <Modal title={t('pages.server.files.modal.sftpDetails.title', {})} {...props}>
      <div className='grid grid-cols-4 gap-2'>
        <CopyOnClick content='SFTP' className='text-left'>
          <TextInput label={t('common.form.protocol', {})} value='SFTP' className='pointer-events-none' readOnly />
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
          <TextInput label={t('common.form.host', {})} value={displayHost} className='pointer-events-none' readOnly />
        </CopyOnClick>

        <CopyOnClick content={`${user!.username}.${server.uuidShort}`} className='col-span-4 text-left'>
          <TextInput
            label={t('common.form.username', {})}
            value={`${user!.username}.${server.uuidShort}`}
            className='pointer-events-none'
            readOnly
          />
        </CopyOnClick>

        {user!.hasPassword && passwordLoginEnabled && !user!.passwordLoginDisabled ? (
          <TextInput
            label={t('common.form.password', {})}
            value={t('common.form.yourControlPanelPassword', {})}
            className='col-span-4 pointer-events-none'
            readOnly
          />
        ) : (
          <Alert className='col-span-4' color='yellow' icon={faTriangleExclamation}>
            {t('common.alert.passwordAuthUnavailable', {})}
          </Alert>
        )}
      </div>

      <ModalFooter>
        <Anchor href={`sftp://${user!.username}.${server.uuidShort}@${server.sftpHost}:${server.sftpPort}`}>
          <Button onClick={props.onClose} leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
            {t('pages.server.files.modal.sftpDetails.launch', {})}
          </Button>
        </Anchor>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
