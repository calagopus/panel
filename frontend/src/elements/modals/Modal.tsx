import { Group, Modal as MantineModal, ModalProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

export const Modal = makeComponentHookable(
  forwardRef<HTMLDivElement, ModalProps>(({ children, className, ...rest }, ref) => {
    return (
      <MantineModal
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        removeScrollProps={{ removeScrollBar: false }}
        ref={ref}
        className={className}
        {...rest}
      >
        {children}
      </MantineModal>
    );
  }),
  {
    Stack: MantineModal.Stack,
  },
);

export const ModalFooter = makeComponentHookable(({ children }: { children: React.ReactNode }) => {
  return (
    <Group mt='md' justify='flex-end'>
      {children}
    </Group>
  );
});
