import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { ReactNode } from 'react';
import Alert from '@/elements/feedback/Alert.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ForceDeleteModalProps = Omit<ModalProps, 'children'> & {
  title: string;
  name: string;
  force: boolean;
  onForceChange: (force: boolean) => void;
  forceWarning: ReactNode;
  confirm?: string;
  onConfirmed: () => void | Promise<void>;
  children?: ReactNode;
};

export default function ForceDeleteModal({
  title,
  name,
  force,
  onForceChange,
  forceWarning,
  confirm,
  onConfirmed,
  children,
  onClose,
  ...props
}: ForceDeleteModalProps) {
  const { t } = useTranslations();

  const handleClose = () => {
    onForceChange(false);
    onClose();
  };

  return (
    <ConfirmationModal
      title={title}
      confirm={confirm ?? t('common.button.delete', {})}
      onConfirmed={onConfirmed}
      onClose={handleClose}
      {...props}
    >
      <Stack>
        <Text size='sm'>{t('common.modal.delete.content', { name }).md()}</Text>

        {children}

        <Switch
          label={t('common.form.force', {})}
          name='force'
          color='red'
          checked={force}
          onChange={(e) => onForceChange(e.target.checked)}
        />

        {force && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
            {forceWarning}
          </Alert>
        )}
      </Stack>
    </ConfirmationModal>
  );
}
