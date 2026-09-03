import { DefaultMantineColor, ModalProps } from '@mantine/core';
import { MouseEvent as ReactMouseEvent, ReactNode, useCallback, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { Modal, ModalFooter } from './Modal.tsx';

type ConfirmationProps = Omit<ModalProps, 'children'> & {
  confirm?: string | undefined;
  confirmColor?: DefaultMantineColor;
  onConfirmed: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void | Promise<void>;
  children: ReactNode;
};

function ConfirmationModal({ confirm, confirmColor = 'red', onConfirmed, children, ...props }: ConfirmationProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);

  const onConfirmedAlt = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
      const res = onConfirmed(e);

      if (res instanceof Promise) {
        setLoading(true);

        Promise.resolve(res)
          .catch((error) => addToast(httpErrorToHuman(error), 'error'))
          .finally(() => setLoading(false));
      }
    },
    [onConfirmed, addToast],
  );

  return (
    <Modal {...props}>
      {children}

      <ModalFooter>
        <Button color={confirmColor} loading={loading} onClick={onConfirmedAlt}>
          {confirm ?? t('common.button.okay', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default makeComponentHookable(ConfirmationModal);
