import { ModalProps } from '@mantine/core';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props extends ModalProps {
  packageName: string;
  licenseText: string;
  onAccept: () => void;
}

export default function LicenseModal({ packageName, licenseText, onAccept, onClose, ...rest }: Props) {
  const { t } = useTranslations();
  return (
    <Modal title={t('pages.admin.extensions.modal.license.title', {})} size='lg' onClose={onClose} {...rest}>
      <p className='text-sm text-(--mantine-color-dimmed) mb-3'>
        {t('pages.admin.extensions.modal.license.description', { packageName }).md()}
      </p>
      <div>{licenseText.md()}</div>

      <ModalFooter>
        <Button color='green' onClick={onAccept}>
          {t('pages.admin.extensions.button.accept', {})}
        </Button>
        <Button variant='default' onClick={() => onClose()}>
          {t('pages.admin.extensions.button.decline', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
