import { ModalProps } from '@mantine/core';
import { ReactNode, SubmitEventHandler } from 'react';
import { Modal } from './Modal.tsx';

type FormModalProps = Omit<ModalProps, 'children' | 'onSubmit'> & {
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  isDirty?: boolean;
  loading?: boolean;
  children: ReactNode;
};

export default function FormModal({ onSubmit, isDirty = false, loading = false, children, ...props }: FormModalProps) {
  return (
    <Modal {...props} closeOnEscape={!isDirty && !loading}>
      <form onSubmit={onSubmit}>{children}</form>
    </Modal>
  );
}
