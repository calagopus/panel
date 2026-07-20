import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'motion/react';
import { FC, MouseEvent as ReactMouseEvent, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Notification from '@/elements/Notification.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { userToastPosition } from '@/lib/schemas/user.ts';
import { Toast, ToastAction, ToastContext, ToastType } from '@/providers/contexts/toastContext.ts';

const toastTimeout = 7500;

const ToastActionButton: FC<{ action: ToastAction }> = ({ action }) => {
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const firedRef = useRef(false);

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (firedRef.current) return;
      firedRef.current = true;
      setTriggered(true);

      const res = action.onClick(e);

      if (res instanceof Promise) {
        setLoading(true);

        Promise.resolve(res).finally(() => setLoading(false));
      }
    },
    [action],
  );

  return (
    <Tooltip label={action.name} zIndex={1000}>
      <ActionIcon
        size='sm'
        variant='subtle'
        color='gray'
        loading={loading}
        disabled={action.disabled || triggered}
        onClick={onClick}
      >
        <FontAwesomeIcon icon={action.icon} size='sm' />
      </ActionIcon>
    </Tooltip>
  );
};

const getToastColor = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'teal';
  }
};

const getToastPositionClasses = (position: z.infer<typeof userToastPosition>) => {
  switch (position) {
    case 'top_left':
      return 'top-4 left-4';
    case 'top_center':
      return 'top-4 left-1/2 -translate-x-1/2';
    case 'top_right':
      return 'top-4 right-4';
    case 'bottom_left':
      return 'bottom-4 left-4';
    case 'bottom_center':
      return 'bottom-4 left-1/2 -translate-x-1/2';
    case 'bottom_right':
      return 'bottom-4 right-4';
  }
};

const getToastPositionInitial = (position: z.infer<typeof userToastPosition>) => {
  switch (position) {
    case 'top_left':
      return { opacity: 0, x: -50, y: 0 };
    case 'top_center':
      return { opacity: 0, x: 0, y: -75 };
    case 'top_right':
      return { opacity: 0, x: 50, y: 0 };
    case 'bottom_left':
      return { opacity: 0, x: -50, y: 0 };
    case 'bottom_center':
      return { opacity: 0, x: 0, y: 75 };
    case 'bottom_right':
      return { opacity: 0, x: 50, y: 0 };
  }
};

const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toastPosition, setToastPosition] = useState<z.infer<typeof userToastPosition>>('bottom_right');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const addToast = useCallback(
    (message: ReactNode, typeOrActions?: ToastType | ToastAction[], maybeActions?: ToastAction[]) => {
      const type = Array.isArray(typeOrActions) ? 'success' : (typeOrActions ?? 'success');
      const actions = Array.isArray(typeOrActions) ? typeOrActions : maybeActions;

      const id = toastId.current++;
      setToasts((prev) => [...prev, { id, message, type, actions }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toastTimeout);

      return id;
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = useMemo(
    () => ({
      toastPosition,
      setToastPosition,
      addToast,
      dismissToast,
    }),
    [toastPosition, setToastPosition, addToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={classNames('fixed z-999 space-y-2', getToastPositionClasses(toastPosition))}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={`toast_${toast.id}`}
              initial={getToastPositionInitial(toastPosition)}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={getToastPositionInitial(toastPosition)}
              transition={{ duration: 0.3 }}
              className='w-72'
            >
              <div className='relative mt-2'>
                <Notification
                  color={getToastColor(toast.type)}
                  withCloseButton
                  onClose={() => dismissToast(toast.id)}
                  styles={
                    toast.actions?.length ? { description: { paddingInlineEnd: toast.actions.length * 30 } } : undefined
                  }
                >
                  {toast.message}
                </Notification>
                {toast.actions?.length ? (
                  <div className='absolute top-1/2 right-9 flex -translate-y-1/2 items-center gap-1'>
                    {toast.actions.map((action, i) => (
                      <ToastActionButton key={i} action={action} />
                    ))}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export { useToast } from './contexts/toastContext.ts';
export { ToastProvider };
